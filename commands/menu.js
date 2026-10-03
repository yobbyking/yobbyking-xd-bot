'use strict';

/**
 * commands/menu.js — main menu with listMessage buttons.
 * Replies with the menu image (if set) + contact card + list of commands.
 */

const store = require('../lib/store');
const { sendMedia, buildContactCard } = require('../lib/messages');
const fs = require('fs');

const NAME = 'menu';
const ALIASES = ['help', 'start', 'm', 'menu'];
const DESC = 'Show the bot menu with tap buttons';

const SECTIONS = [
  {
    title: '🎮 Bot Commands',
    rows: [
      { title: '🖼️ Make Sticker', description: 'Reply to a photo with .sticker', rowId: 'cmd:sticker' },
      { title: '🎲 Random Joke', description: 'Get a random joke', rowId: 'cmd:joke' },
      { title: '💡 Quote of the day', description: 'Get an inspirational quote', rowId: 'cmd:quote' },
      { title: '🤖 Bot Info', description: 'See bot name + uptime', rowId: 'cmd:info' },
      { title: '💾 Save Bot Contact', description: 'Get the bot\'s contact card', rowId: 'cmd:contact' },
    ],
  },
  {
    title: '👑 Admin Commands (owner only)',
    rows: [
      { title: '🖼️ Set Menu Image', description: 'Reply to photo/video with .setmenuimage', rowId: 'cmd:setmenuimage-help' },
      { title: '📝 Set Status Text', description: 'Customize the footer status', rowId: 'cmd:setstatus-help' },
      { title: '📢 Broadcast', description: 'Send message to all users', rowId: 'cmd:broadcast-help' },
      { title: '🚫 Ban user', description: 'Block a user from using bot', rowId: 'cmd:ban-help' },
    ],
  },
];

async function run({ sock, jid, args, isOwner }) {
  const state = store.load();
  const botName = state.botName;
  const footer = state.statusText;

  // 1) Send menu image (if set) first
  if (state.menuImagePath && fs.existsSync(state.menuImagePath)) {
    await sendMedia(sock, jid, {
      path: state.menuImagePath,
      mime: state.menuImageMime,
      caption: `*${botName}*\n\nTap a button below to use a command 👇`,
      footer,
    });
  } else {
    // No image — send text intro
    await sock.sendMessage(jid, {
      text: `*${botName}*\n\nTap a button below to use a command 👇`,
    });
  }

  // 2) Send the listMessage menu
  await sock.sendMessage(jid, {
    listMessage: {
      title: `${botName} Menu`,
      description: 'Tap a button below to use a command 👇',
      footerText: footer,
      buttonText: '📋 Tap to open menu',
      sections: SECTIONS,
      listType: 1,
    },
  });

  // 3) Send the bot's contact card (so user can save the bot)
  if (state.botNumber) {
    await sock.sendMessage(jid, buildContactCard({
      name: botName,
      number: state.botNumber,
    }));
  }
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
