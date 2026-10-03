'use strict';

/**
 * lib/store.js — persistent JSON settings store (no DB needed).
 * Used for: bot owner, menu image path, status text, contacts, etc.
 */

const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', 'store.json');

const DEFAULTS = {
  owner: null,                    // WhatsApp ID of the bot owner (set via .setowner)
  statusText: '© yobbyking XD bot — Tap a button below 👇',
  botName: 'yobbyking XD',
  botNumber: null,                // Set after first connection
  menuImagePath: null,            // Path to the image/video shown in every menu
  menuImageMime: null,            // 'image/jpeg' or 'video/mp4'
  menuImageCaption: 'yobbyking XD',
  banned: [],                     // Banned user IDs
  userUsage: {},                  // { jid: { lastSeen, commandsUsed } }
};

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(state) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
}

function update(patch) {
  const state = load();
  const newState = { ...state, ...patch };
  save(newState);
  return newState;
}

module.exports = { load, save, update };
