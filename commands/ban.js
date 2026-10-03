'use strict';

const store = require('../lib/store');

const NAME = 'ban';
const ALIASES = ['block'];
const DESC = 'Owner only. Ban a user from using the bot.';

async function run({ sock, msg, jid, isOwner }) {
  if (!isOwner) return sock.sendMessage(jid, { text: '❌ Owner only.' });
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const replied = msg.message?.extendedTextMessage?.contextInfo?.participant;
  const target = mentioned || replied;
  if (!target) return sock.sendMessage(jid, { text: '⚠️ Reply to the user or mention them. Usage: .ban @user' });
  const state = store.load();
  const banned = [...(state.banned || []), target];
  store.update({ banned });
  await sock.sendMessage(jid, { text: '🚫 Banned user: ' + target.split('@')[0] });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
