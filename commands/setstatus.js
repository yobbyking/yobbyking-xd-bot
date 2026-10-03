'use strict';

/**
 * commands/setstatus.js — set the footer status text (owner only).
 */

const store = require('../lib/store');

const NAME = 'setstatus';
const ALIASES = ['status', 'setfooter'];
const DESC = 'Set the status text shown on every menu footer. Owner only.';

async function run({ sock, jid, args, isOwner }) {
  if (!isOwner) {
    return sock.sendMessage(jid, { text: '❌ Owner only command. Run .setowner first to claim the bot.' });
  }
  const text = (args || []).join(' ').trim();
  if (!text) {
    return sock.sendMessage(jid, {
      text: '⚠️ Usage: .setstatus <text>\n\nExample: .setstatus 🚀 yobbyking XD — your daily bot\n\nThis text appears as a footer on every menu reply.',
    });
  }
  store.update({ statusText: text });
  await sock.sendMessage(jid, {
    text: `✅ Status updated!\n\nNew status: ${text}`,
  });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
