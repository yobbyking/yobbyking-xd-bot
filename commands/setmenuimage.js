'use strict';

/**
 * commands/setmenuimage.js — Set the bot's menu image.
 *
 * Supported inputs (owner only):
 *   • Reply to an image    → uses that image as the menu header
 *   • Reply to a video/GIF  → uses it as animated menu header (mp4)
 *   • Reply to a sticker    → uses it (converted to image)
 *   • Send with caption     → uses attached media
 *   • Reply to a user       → uses their profile picture
 *   • .setmenuimage <URL>   → downloads + sets image from URL
 *   • .setmenuimage off      → removes the menu image
 *
 * Fixed bug from Klaus-Bot: passed `{ reuploadRequest: ..., logger: ... }` to
 * downloadMediaMessage instead of the actual `sock` instance. This version
 * passes `sock` directly — the official Baileys signature.
 */

const store = require('../lib/store');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'setmenuimage';
const ALIASES = ['smi', 'mi', 'setmenuimg'];
const DESC = 'Set the menu image. Reply to photo/video/sticker/user, or use URL. Owner only.';

async function downloadMedia(buffer, msg, quoted, sock) {
  return await downloadMediaMessage(
    { key: msg.key, message: quoted },
    'buffer',
    {},
    sock  // ⚠️ pass sock directly — Klaus passed a plain object here, breaking downloads
  );
}

async function downloadFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function run({ sock, msg, jid, args, isOwner }) {
  if (!isOwner) {
    return sock.sendMessage(jid, { text: '❌ Owner only command. Run .setowner first to claim the bot.' });
  }

  // Special: .setmenuimage off — clear menu image
  if (args[0]?.toLowerCase() === 'off' || args[0]?.toLowerCase() === 'remove') {
    // Delete saved menu image files
    const assetsDir = path.join(__dirname, '..', 'assets');
    if (fs.existsSync(assetsDir)) {
      fs.readdirSync(assetsDir).forEach(f => {
        if (f.startsWith('menu-image.')) {
          try { fs.unlinkSync(path.join(assetsDir, f)); } catch {}
        }
      });
    }
    store.update({ menuImagePath: null, menuImageMime: null });
    return sock.sendMessage(jid, { text: '✅ Menu image removed.' });
  }

  // Special: .setmenuimage <url> — download from URL
  if (args[0] && /^https?:\/\//.test(args[0])) {
    try {
      const url = args[0];
      const buffer = await downloadFromUrl(url);
      const ext = path.extname(url.split('?')[0]).toLowerCase();
      let mime = 'image/jpeg';
      let extension = 'jpg';
      if (ext === '.png') { mime = 'image/png'; extension = 'png'; }
      else if (ext === '.webp') { mime = 'image/webp'; extension = 'webp'; }
      else if (ext === '.gif') { mime = 'image/gif'; extension = 'gif'; }
      else if (ext === '.mp4') { mime = 'video/mp4'; extension = 'mp4'; }

      const savedPath = await saveMenuImage(buffer, mime, extension);
      store.update({ menuImagePath: savedPath, menuImageMime: mime });
      await sock.sendMessage(jid, {
        text: `✅ Menu image set from URL!\n\nType: ${mime}\nSize: ${(buffer.length / 1024).toFixed(1)} KB`,
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: '❌ Failed to download from URL: ' + (err.message || err) });
    }
    return;
  }

  // Detect what the user is replying to
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
  const quoted = contextInfo.quotedMessage;

  let mediaMsg = null;
  let mime = null;
  let extension = null;
  let mediaType = null; // 'image' | 'video' | 'sticker' | 'profile'

  // Direct media (sent with caption ".setmenuimage")
  if (msg.message?.imageMessage) {
    mediaMsg = msg.message.imageMessage;
    mime = mediaMsg.mimetype || 'image/jpeg';
    extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    mediaType = 'image';
  } else if (msg.message?.videoMessage) {
    mediaMsg = msg.message.videoMessage;
    mime = mediaMsg.mimetype || 'video/mp4';
    extension = 'mp4';
    mediaType = 'video';
  }
  // Quoted media
  else if (quoted) {
    if (quoted.imageMessage) {
      mediaMsg = quoted.imageMessage;
      mime = quoted.imageMessage.mimetype || 'image/jpeg';
      extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      mediaType = 'image';
    } else if (quoted.videoMessage) {
      mediaMsg = quoted.videoMessage;
      mime = quoted.videoMessage.mimetype || 'video/mp4';
      extension = 'mp4';
      mediaType = 'video';
    } else if (quoted.stickerMessage) {
      mediaMsg = quoted.stickerMessage;
      mime = 'image/webp';
      extension = 'webp';
      mediaType = 'sticker';
    }
  }

  // Reply to a user (mentioned or quoted participant) → use their profile pic
  const mentioned = contextInfo.mentionedJid?.[0];
  const quotedParticipant = contextInfo.participant;
  const targetUser = mentioned || quotedParticipant;

  if (!mediaMsg && !targetUser) {
    return sock.sendMessage(jid, {
      text:
        '🖼️ *Set Menu Image*\n\n' +
        'How to use:\n' +
        '• Reply to a photo + send `.setmenuimage` — sets image\n' +
        '• Reply to a video/GIF + send `.setmenuimage` — animated menu!\n' +
        '• Reply to a sticker + send `.setmenuimage` — converts to image\n' +
        '• Reply to a user + send `.setmenuimage` — uses their profile pic\n' +
        '• Mention someone: `.setmenuimage @user`\n' +
        '• From URL: `.setmenuimage https://example.com/photo.jpg`\n' +
        '• Remove: `.setmenuimage off`\n\n' +
        'Supported: JPG, PNG, WebP, GIF, MP4 (max 32MB)',
    });
  }

  // React hourglass
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    let buffer;
    let finalMime = mime;
    let finalExtension = extension;

    if (targetUser && !mediaMsg) {
      // Download profile picture
      try {
        buffer = await sock.profilePicture(targetUser, 'image');
        finalMime = 'image/jpeg';
        finalExtension = 'jpg';
        mediaType = 'profile';
      } catch (err) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, {
          text: '❌ Failed to download profile picture. The user might have privacy mode enabled.',
        });
      }
    } else {
      // Download the media (using the FIXED signature — pass sock directly)
      buffer = await downloadMedia(buffer, msg, quoted, sock);
      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, {
          text: '❌ Failed to download media. Try sending a fresh photo/video instead of replying to an old one.',
        });
      }
    }

    const savedPath = await saveMenuImage(buffer, finalMime, finalExtension);
    store.update({ menuImagePath: savedPath, menuImageMime: finalMime });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    await sock.sendMessage(jid, {
      text:
        `✅ Menu image saved!\n\n` +
        `📁 Type: ${finalMime}\n` +
        `📦 Size: ${(buffer.length / 1024).toFixed(1)} KB\n` +
        `🎯 Source: ${mediaType}\n\n` +
        `Next time someone uses .menu, this ${mediaType === 'video' ? 'video' : 'image'} will appear at the top.`,
    });
  } catch (err) {
    console.error('[setmenuimage] error:', err);
    try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch {}
    await sock.sendMessage(jid, { text: '❌ Failed: ' + (err.message || err) });
  }
}

async function saveMenuImage(buffer, mime, extension) {
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  // Remove any existing menu image (any extension)
  fs.readdirSync(assetsDir).forEach(f => {
    if (f.startsWith('menu-image.')) {
      try { fs.unlinkSync(path.join(assetsDir, f)); } catch {}
    }
  });
  const filename = 'menu-image.' + extension;
  const filePath = path.join(assetsDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
