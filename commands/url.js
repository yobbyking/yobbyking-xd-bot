'use strict';

/**
 * commands/url.js — Upload media (image/video/audio/doc) and get a permanent URL.
 *
 * Uses ImgBB for images (permanent, 32MB max) and telegra.ph for everything else.
 * Inspired by Klaus-Bot's .url command but rewritten for official Baileys.
 *
 * Usage:
 *   Reply to any media + send .url → returns a permanent shareable URL
 *   .url <image_url>             → re-uploads from URL
 *
 * The previous version in Klaus-Bot was broken because it passed a plain object
 * instead of the actual `sock` instance to downloadMediaMessage (4th arg).
 * This version passes `sock` directly — the official Baileys signature.
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ImgBB API key (same as Klaus-Bot's embedded key)
const IMGBB_KEY = '60c3e5e339bbed1a90470b2938feab62';
const IMGBB_URL = 'https://api.imgbb.com/1/upload?key=' + IMGBB_KEY;

// Telegraph for images (no API key needed, 5MB max)
const TELEGRAPH_URL = 'https://telegra.ph/upload';

// 0x0.st for any file (no API key, 512MB max, kept ~14 days)
const ZEROXZERO_URL = 'https://0x0.st';

// File.io for any file (no API key, 2GB max, single-download)
const FILEIO_URL = 'https://file.io';

const SUPPORTED_IMG = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const SUPPORTED_ALL = '*';

const NAME = 'url';
const ALIASES = ['upload', 'geturl', 'link'];
const DESC = 'Reply to any media + .url → get a permanent shareable URL';

function fileExt(filename) {
  return path.extname(filename || '').toLowerCase();
}
function isImage(filename) {
  return SUPPORTED_IMG.includes(fileExt(filename));
}
function randomName(filename) {
  const ext = fileExt(filename) || '.bin';
  return crypto.randomBytes(8).toString('hex') + ext;
}

/**
 * Upload to ImgBB (images only, permanent URL).
 */
async function uploadImgBB(buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', buffer.toString('base64'));
  form.append('name', filename);
  const fetchOpts = {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  };
  const res = await fetch(IMGBB_URL, fetchOpts);
  const data = await res.json();
  if (data?.data?.url) return { url: data.data.url, thumb: data.data.thumb?.url || data.data.url, success: true };
  return { success: false, error: data?.error?.message || 'ImgBB upload failed' };
}

/**
 * Upload to Telegraph (images only, permanent URL).
 */
async function uploadTelegraph(buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, { filename: filename || 'image.jpg', contentType: 'image/jpeg' });
  const res = await fetch(TELEGRAPH_URL, { method: 'POST', body: form });
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.src) return { url: 'https://telegra.ph' + data[0].src, success: true };
  return { success: false, error: data?.error || 'Telegraph upload failed' };
}

/**
 * Upload to 0x0.st (any file, 14-day URL).
 */
async function upload0x0(buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, filename || 'file');
  const res = await fetch(ZEROXZERO_URL, { method: 'POST', body: form });
  const text = await res.text();
  if (text && text.startsWith('http')) return { url: text.trim(), success: true };
  return { success: false, error: '0x0.st upload failed: ' + text.slice(0, 100) };
}

/**
 * Upload to file.io (any file, single-download URL).
 */
async function uploadFileIo(buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, filename || 'file');
  const res = await fetch(FILEIO_URL, { method: 'POST', body: form });
  const data = await res.json();
  if (data?.link) return { url: data.link, success: true };
  return { success: false, error: data?.message || 'File.io upload failed' };
}

/**
 * Try services in priority order based on file type.
 */
async function uploadFile(buffer, filename) {
  // Images → try ImgBB first (permanent), then Telegraph, then 0x0.st
  if (isImage(filename)) {
    let r = await uploadImgBB(buffer, filename);
    if (r.success) return { ...r, service: 'ImgBB', permanent: true };
    console.log('[url] ImgBB failed:', r.error, '— falling back to Telegraph');
    r = await uploadTelegraph(buffer, filename);
    if (r.success) return { ...r, service: 'Telegraph', permanent: true };
    console.log('[url] Telegraph failed:', r.error, '— falling back to 0x0.st');
  }
  // Anything else → 0x0.st
  let r = await upload0x0(buffer, filename);
  if (r.success) return { ...r, service: '0x0.st', permanent: false };
  // Last resort → file.io
  r = await uploadFileIo(buffer, filename);
  if (r.success) return { ...r, service: 'File.io', permanent: false };
  return { success: false, error: 'All upload services failed' };
}

async function run({ sock, msg, jid, args, isOwner }) {
  try {
    // React with hourglass
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const hasUrl = args.length > 0 && /^https?:\/\//.test(args[0]);

    if (!quoted && !hasUrl) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, {
        text:
          '📤 *URL Upload*\n\n' +
          'Usage:\n' +
          '• Reply to any media + send `.url` — uploads it and returns a permanent link\n' +
          '• `.url <image_url>` — re-uploads from URL\n\n' +
          'Supported: images, videos, audio, documents (max 32MB images, 512MB other)\n\n' +
          'Powered by ImgBB (images) + 0x0.st (other)',
      });
    }

    let buffer, filename;

    if (hasUrl) {
      // Download from URL
      const url = args[0];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        buffer = Buffer.from(ab);
        filename = randomName(path.basename(url.split('?')[0]) || 'file.bin');
      } catch (err) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, { text: '❌ *URL download failed:* ' + (err.message || err) });
      }
    } else {
      // Download quoted media — pass `sock` directly (the bug in Klaus was passing a plain object)
      const messageObj = { key: msg.key, message: quoted };
      try {
        buffer = await downloadMediaMessage(messageObj, 'buffer', {}, sock);
        if (!buffer || buffer.length === 0) throw new Error('Empty buffer');
      } catch (err) {
        console.error('[url] download error:', err);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, {
          text: '❌ *Failed to download media.*\n\nTip: try sending a fresh media message instead of replying to an old one.',
        });
      }
      // Detect filename from message type
      let baseName = 'file.bin';
      if (quoted.documentMessage?.fileName) baseName = quoted.documentMessage.fileName;
      else if (quoted.imageMessage) baseName = 'image.jpg';
      else if (quoted.videoMessage) baseName = 'video.mp4';
      else if (quoted.audioMessage) {
        const m = quoted.audioMessage.mimetype || '';
        baseName = m.includes('ogg') ? 'audio.ogg' : m.includes('mp4') || m.includes('m4a') ? 'audio.m4a' : 'audio.mp3';
      } else if (quoted.stickerMessage) baseName = 'sticker.webp';
      filename = randomName(baseName);
    }

    // React upload
    await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } });

    const result = await uploadFile(buffer, filename);
    if (!result.success) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: '❌ *Upload failed:* ' + result.error });
    }

    const sizeKb = (buffer.length / 1024).toFixed(1);
    const permanentTag = result.permanent ? '✅ Permanent' : '⚠️ Temporary (14 days)';
    const successText =
      `✅ *Upload successful!*\n\n` +
      `URL: ${result.url}\n\n` +
      `📦 Service: ${result.service}\n` +
      `📁 Size: ${sizeKb} KB\n` +
      `${permanentTag}\n\n` +
      `Powered by yobbyking XD`;

    // Send as text with the URL prominently displayed
    await sock.sendMessage(jid, {
      text: successText,
      contextInfo: {
        externalAdReply: {
          title: 'yobbyking XD — URL uploaded',
          body: `${sizeKb} KB via ${result.service}`,
          thumbnailUrl: result.thumb || result.url,
          mediaType: 1,
          sourceUrl: result.url,
        },
      },
    });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (err) {
    console.error('[url] error:', err);
    try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch {}
    await sock.sendMessage(jid, { text: '❌ *Error:* ' + (err.message || err) });
  }
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
