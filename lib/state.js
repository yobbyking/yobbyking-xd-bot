'use strict';

/**
 * lib/state.js — lightweight multi-file auth state using Baileys' own helper.
 * Stores sessions in ./auth/<phoneNumber> folders.
 * Falls back to ./auth/default if no phone is set.
 */

const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '..', 'auth');

function ensureAuthDir(sub = 'default') {
  const dir = path.join(AUTH_DIR, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

module.exports = { ensureAuthDir };
