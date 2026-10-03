'use strict';

/**
 * commands/info.js — bot info (name, uptime, user count).
 */

const store = require('../lib/store');
const os = require('os');

const NAME = 'info';
const ALIASES = ['about', 'botinfo'];
const DESC = 'Show bot info (name, uptime, total users)';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

async function run({ sock, jid }) {
  const state = store.load();
  const userCount = Object.keys(state.userUsage || {}).length;
  const uptime = formatUptime(os.uptime());

  const text = `🤖 *${state.botName}* — Bot Info

• Name: ${state.botName}
• Uptime: ${uptime}
• Total users: ${userCount}
• Owner: ${state.owner ? '✅ set' : '❌ not set (run .setowner to claim)'}
• Menu image: ${state.menuImagePath ? '✅ set' : '❌ not set (.setmenuimage to set)'}
• Status: ${state.statusText}

Made with ❤️ by yobbyking XD`;
  await sock.sendMessage(jid, { text });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
