'use strict';

/**
 * commands/setmenuimage.js — Reply to a photo or video with .setmenuimage
 * to set it as the bot's persistent menu image (shown in every menu reply).
 * Owner-only command.
 */

const store = require('../lib/store');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'setmenuimage';
const ALIASES = ['setmenuimg', 'setmenu'];
const DESC = 'Reply to a photo/video to set it as the menu image. Owner only.';

async function run({ sock, msg, jid, isOwner }) {
  if (!isOwner) {
    return sock.sendMessage(jid, { text: '❌ Owner only command.' });
  }

  // The user must reply to a media message
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    return sock.sendMessage(jid, {
      text: '⚠️ Reply to a photo or video with this command.\n\nHow:\n1. Tap and hold a photo/video\n2. Tap Reply\n3. Send: .setmenuimage',
    });
  }

  // Detect media type
  let mediaMsg = null;
  let mime = null;
  let extension = null;
  let isVideo = false;

  if (quoted.imageMessage) {
    mediaMsg = quoted.imageMessage;
    mime = quoted.imageMessage.mimetype || 'image/jpeg';
    extension = mime.includes('png') ? 'png' : 'jpg';
  } else if (quoted.videoMessage) {
    mediaMsg = quoted.videoMessage;
    mime = quoted.videoMessage.mimetype || 'video/mp4';
    extension = 'mp4';
    isVideo = true;
  } else if (quoted.stickerMessage) {
    mediaMsg = quoted.stickerMessage;
    mime = 'image/webp';
    extension = 'webp';
  }

  if (!mediaMsg) {
    return sock.sendMessage(jid, {
      text: '❌ The replied message must be a photo or video.',
    });
  }

  // Download the media to a buffer
  try {
    const buffer = await downloadMediaMessage(
      { message: quoted, key: msg.key },
      'buffer',
      {},
      sock
    );

    // Save to assets/menu-image.<ext>
    const assetsDir = path.join(__dirname, '..', 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    const filename = `menu-image.${extension}`;
    const filePath = path.join(assetsDir, filename);

    // Remove any existing menu image
    fs.readdirSync(assetsDir).forEach(f => {
      if (f.startsWith('menu-image.')) fs.unlinkSync(path.join(assetsDir, f));
    });

    fs.writeFileSync(filePath, buffer);

    // Save in store
    store.update({
      menuImagePath: filePath,
      menuImageMime: mime,
    });

    await sock.sendMessage(jid, {
      text: `✅ Menu image saved!\n\nType: ${mime}\nSize: ${(buffer.length / 1024).toFixed(1)} KB\n\nNext time someone uses .menu, this image will appear at the top.`,
    });
  } catch (err) {
    console.error('[setmenuimage] download error:', err);
    await sock.sendMessage(jid, { text: '❌ Failed to download media: ' + (err.message || err) });
  }
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
