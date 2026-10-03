'use strict';

/**
 * commands/menu.js — main menu with listMessage buttons.
 * Replies with the menu image/video (if set) + contact card + list of commands.
 */

const store = require('../lib/store');
const fs = require('fs');
const { buildContactCard } = require('../lib/messages');

const NAME = 'menu';
const ALIASES = ['help', 'start', 'm', 'menu'];
const DESC = 'Show the bot menu with tap buttons';

const SECTIONS = [
  {
    title: '🎮 Bot Commands',
    rows: [
      { title: '🖼️ Make Sticker', description: 'Reply to a photo with .sticker', rowId: 'cmd:sticker' },
      { title: '📤 Get URL', description: 'Reply to media → get permanent URL', rowId: 'cmd:url' },
      { title: '🎲 Random Joke', description: 'Get a random joke', rowId: 'cmd:joke' },
      { title: '💡 Quote of the day', description: 'Get an inspirational quote', rowId: 'cmd:quote' },
      { title: '🤖 Bot Info', description: 'See bot name + uptime + users', rowId: 'cmd:info' },
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

async function run({ sock, jid }) {
  const state = store.load();
  const botName = state.botName;
  const footer = state.statusText;
  const mediaPath = state.menuImagePath;
  const mediaMime = state.menuImageMime;

  // 1) Send menu media (image or video) with caption first
  if (mediaPath && fs.existsSync(mediaPath)) {
    let mediaMsg;
    const caption = `*${botName}*\n\nTap a button below to use a command 👇`;

    if (mediaMime && mediaMime.startsWith('video/')) {
      mediaMsg = {
        video: { url: mediaPath },
        caption: caption,
        footer: footer,
        gifPlayback: false,
      };
    } else {
      mediaMsg = {
        image: { url: mediaPath },
        caption: caption,
        footer: footer,
      };
    }

    try {
      await sock.sendMessage(jid, mediaMsg);
    } catch (err) {
      console.error('[menu] media send error:', err);
      // Fallback: send text only
      await sock.sendMessage(jid, { text: `*${botName}*\n\nTap a button below to use a command 👇` });
    }
  } else {
    // No image — send text intro
    await sock.sendMessage(jid, { text: `*${botName}*\n\nTap a button below to use a command 👇` });
  }

  // 2) Send the listMessage menu (the tap button)
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
    try {
      await sock.sendMessage(jid, buildContactCard({
        name: botName,
        number: state.botNumber,
      }));
    } catch (err) {
      console.error('[menu] contact card error:', err);
    }
  }
}

module.exports = { name: NAME, aliases: ALIASES, desc: DESC, run };
