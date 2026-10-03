'use strict';

/**
 * commands/setowner.js — claim ownership of the bot.
 * First user to run .setowner becomes the owner. After that, only the owner can transfer it.
 */

const store = require('../lib/store');

const NAME = 'setowner';
const ALIASES = ['claim'];
const DESC = 'Claim ownership of the bot (first run only)';

async function run({ sock, jid, sender, args }) {
  const state = store.load();

  if (state.owner) {
    return sock.sendMessage(jid, {
      text: '❌ Owner already set. Only the current owner can transfer ownership.\n\nTo transfer, the owner runs: .setowner @newUser',
    });
  }

  // First user to run this becomes owner
  store.update({ owner: sender });
  await sock.sendMessage(jid, {
    text: `✅ You are now the bot owner!\n\nYou can use admin commands like:\n• .setmenuimage — set menu image\n• .setstatus — change status text\n• .broadcast — message all users\n• .ban — ban a user`,
  });
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
