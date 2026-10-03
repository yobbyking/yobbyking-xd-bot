'use strict';

/**
 * commands/sticker.js — make a sticker from a replied photo.
 * Anyone can use this command.
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

const NAME = 'sticker';
const ALIASES = ['s', 'st'];
const DESC = 'Reply to a photo with .sticker to make a sticker';

async function run({ sock, msg, jid }) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (!quoted || !quoted.imageMessage) {
    return sock.sendMessage(jid, {
      text: '⚠️ Reply to a photo with .sticker to make a sticker.',
    });
  }

  try {
    const buffer = await downloadMediaMessage(
      { message: quoted, key: msg.key },
      'buffer',
      {},
      sock
    );

    // Convert to webp sticker using sharp
    const webpBuffer = await sharp(buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    await sock.sendMessage(jid, {
      sticker: webpBuffer,
      pack: 'yobbyking XD',
      author: 'Bot',
    });
  } catch (err) {
    console.error('[sticker] error:', err);
    await sock.sendMessage(jid, { text: '❌ Failed to make sticker: ' + (err.message || err) });
  }
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
