'use strict';

/**
 * lib/messages.js — Baileys message helpers.
 * Builds listMessage buttons, contact cards (vCard), media attachments.
 */

const { proto } = require('@whiskeysockets/baileys');
const fs = require('fs');

/**
 * Build a listMessage with a header image/video + footer text.
 * The footer is the "status" text (with contact-card info).
 * Lists show as a single button that opens a menu of options.
 */
function buildMenuList({ title, sections, footer, mediaPath, mediaMime }) {
  const msg = {
    title: title || 'yobbyking XD',
    description: 'Tap a button below to use a command 👇',
    footerText: footer || '© yobbyking XD bot',
    buttonText: '📋 Menu',
    sections,
    listType: 1, // SINGLE_SELECT
  };

  // If we have a menu image/video, attach it as the context (header)
  if (mediaPath && fs.existsSync(mediaPath)) {
    return {
      image: { url: mediaPath },
      caption: msg.title + '\n\n' + msg.description,
      footer: msg.footerText,
      title: msg.buttonText,
      buttonText: msg.buttonText,
      // We can't send image + listMessage together; send image with footer + menu as separate msg
    };
  }

  return { listMessage: msg };
}

/**
 * Build a simple buttonsMessage (template buttons — 3 max).
 * NOTE: Many WhatsApp clients don't render template buttons;
 * we use listMessage instead for compatibility.
 */
function buildButtons({ text, footer, buttons }) {
  return {
    text,
    footer,
    buttons: buttons.map((b, i) => ({
      buttonId: b.id || `btn_${i}`,
      buttonText: { displayText: b.text },
      type: 1,
    })),
    headerType: 1,
  };
}

/**
 * Build a vCard contact card for the bot.
 * WhatsApp will render this as a "Contact Card" the user can tap to save.
 */
function buildContactCard({ name, number }) {
  const vcard =
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    'FN:' + name + '\n' +
    'ORG:' + name + ';\n' +
    'TEL;type=CELL;type=VOICE;waid=' + number.replace(/[^0-9]/g, '') + ':' + number + '\n' +
    'END:VCARD';

  return {
    contacts: {
      displayName: name,
      contacts: [{ vcard }],
    },
  };
}

/**
 * Send a media message (image or video) with caption.
 */
async function sendMedia(sock, jid, { path, mime, caption, footer }) {
  if (!fs.existsSync(path)) return null;
  let message;
  if (mime === 'video/mp4') {
    message = {
      video: { url: path },
      caption: caption,
      footer: footer,
      gifPlayback: false,
    };
  } else {
    message = {
      image: { url: path },
      caption: caption,
      footer: footer,
    };
  }
  return await sock.sendMessage(jid, message);
}

module.exports = { buildMenuList, buildButtons, buildContactCard, sendMedia };
