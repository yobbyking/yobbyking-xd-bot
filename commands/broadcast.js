'use strict';

const store = require('../lib/store');

const NAME = 'broadcast';
const ALIASES = ['bc'];
const DESC = 'Owner only. Broadcast to all users.';

async function run({ sock, jid, args, isOwner }) {
  if (!isOwner) return sock.sendMessage(jid, { text: '❌ Owner only.' });
  const msg = (args || []).join(' ').trim();
  if (!msg) return sock.sendMessage(jid, { text: '⚠️ Usage: .broadcast <message>' });
  const state = store.load();
  const users = Object.keys(state.userUsage || {});
  let sent = 0, failed = 0;
  for (const u of users) {
    try { await sock.sendMessage(u, { text: '📢 *Broadcast:*\n\n' + msg }); sent++; }
    catch { failed++; }
  }
  await sock.sendMessage(jid, { text: `✅ Broadcast done.\nSent: ${sent} · Failed: ${failed}` });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
