'use strict';

/**
 * commands/contact.js — send the bot's contact card (vCard).
 * Anyone can use this.
 */

const store = require('../lib/store');
const { buildContactCard } = require('../lib/messages');

const NAME = 'contact';
const ALIASES = ['card', 'save', 'savecontact'];
const DESC = 'Get the bot\'s contact card to save';

async function run({ sock, jid }) {
  const state = store.load();
  if (!state.botNumber) {
    return sock.sendMessage(jid, { text: '❌ Bot number not yet known.' });
  }
  await sock.sendMessage(jid, buildContactCard({
    name: state.botName,
    number: state.botNumber,
  }));
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
