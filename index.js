'use strict';

/**
 * yobbyking XD — multi-user WhatsApp bot with tap buttons, contact card,
 * and .setmenuimage command.
 *
 * Built on official Baileys (@whiskeysockets/baileys).
 * Uses pairing code auth (no QR scan needed — set BOT_PHONE env var).
 *
 * Anyone who DMs the bot can use menu commands.
 * First user to run .setowner becomes the owner (unlocks admin commands).
 */

const fs = require('fs');
const path = require('path');
const P = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const store = require('./lib/store');
const { createServer, markAllConnected, setBotStatus } = require('./lib/web');

const WEB_PORT = process.env.WEB_PORT || 3000;

// Load all command modules from commands/ folder
const COMMANDS_DIR = path.join(__dirname, 'commands');
const COMMANDS = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => require(path.join(COMMANDS_DIR, f)));

console.log(`[BOOT] Loaded ${COMMANDS.length} commands:`, COMMANDS.map(c => '.' + c.name).join(', '));

let sock = null;
let reconnectTimer = null;
let wsConnected = false;  // true when the WhatsApp WebSocket is open (even before pairing)

async function startBot() {
  const authFolder = process.env.BOT_PHONE
    ? `auth_${process.env.BOT_PHONE.replace(/[^0-9]/g, '')}`
    : 'auth';
  const authDir = path.join(__dirname, 'auth', authFolder);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  console.log('[BOOT] Using Baileys version', version.join('.'));

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
    browser: ['yobbyking XD', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'connecting') {
      wsConnected = false;
      setBotStatus(false, false);
      console.log('[CONN] Connecting to WhatsApp...');
    }
    if (connection === 'open') {
      wsConnected = true;
      setBotStatus(true, true);
      console.log('\n========================================');
      console.log('✅ Bot CONNECTED successfully!');
      const botNumber = sock.user?.id?.split(':')[0];
      if (botNumber) store.update({ botNumber });
      console.log(`📱 Bot number: ${botNumber}`);
      console.log(`👤 Bot name: ${store.load().botName}`);
      console.log('========================================\n');
      markAllConnected();
    }
    if (connection === 'close') {
      wsConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode || 0;
      console.log('[CONN] closed, code:', code);
      if (code === DisconnectReason.loggedOut) {
        console.log('[CONN] Logged out — cleaning auth folder for fresh pairing...');
        // Auto-clean the auth folder so the bot can generate fresh pairing codes
        try {
          const authDir = path.join(__dirname, 'auth');
          if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            fs.mkdirSync(authDir, { recursive: true });
            console.log('[CONN] Auth folder cleaned. Restarting in 3s...');
          }
        } catch (e) {
          console.log('[CONN] Failed to clean auth:', e.message);
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 3000);
      } else if (code === DisconnectReason.restartRequired) {
        console.log('[CONN] Restart required — reconnecting...');
        setTimeout(startBot, 2000);
      } else if (code === 408) {
        // 408 = timeout. WhatsApp closed the WS because no pairing was completed in time.
        // Don't delete auth (credentials are still valid), just reconnect.
        console.log('[CONN] Timeout — reconnecting in 3s (credentials still valid)...');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 3000);
      } else {
        console.log('[CONN] Reconnecting in 5s...');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 5000);
      }
    }
  });

  // Request a pairing code if BOT_PHONE env var is set and not yet registered
  if (process.env.BOT_PHONE && !state.creds?.registered) {
    const phone = process.env.BOT_PHONE.replace(/[^0-9]/g, '');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log('\n========================================');
        console.log('🔗 Your pairing code:');
        console.log(`       ${code}`);
        console.log('========================================');
        console.log(`On your phone: WhatsApp → Settings → Linked Devices → Link a device → enter: ${code}`);
        console.log('========================================\n');
      } catch (err) {
        console.log('[PAIR] Failed to get pairing code:', err.message);
      }
    }, 3000);
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        await handleMessage(msg);
      } catch (err) {
        console.error('[MSG] handler error:', err);
      }
    }
  });
}

async function handleMessage(msg) {
  if (msg.key.remoteJid === 'status@broadcast') return;
  if (!msg.message) return;

  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');

  // Extract text from any message type
  let text = '';
  if (msg.message.conversation) text = msg.message.conversation;
  else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
  else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;
  else if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption;
  else return;

  text = text.trim();
  if (!text.startsWith('.')) return;

  // Handle listMessage response first (rowId: 'cmd:name')
  if (msg.message.listResponseMessage) {
    const selected = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
    if (selected.startsWith('cmd:')) {
      const cmdName = selected.replace('cmd:', '').replace(/-help$/, '');
      const cmd = COMMANDS.find(c => c.name === cmdName);
      if (cmd) {
        const state = store.load();
        const isOwner = state.owner === sender;
        // For setmenuimage help, show instructions
        if (selected === 'cmd:setmenuimage-help') {
          return sock.sendMessage(jid, {
            text: '🖼️ *Set Menu Image*\n\nHow to set your menu image:\n1. Find a photo or video you like\n2. Tap and hold it → tap Reply\n3. Send: .setmenuimage\n\nThe image will appear at the top of every menu reply!',
          });
        }
        if (selected === 'cmd:setstatus-help') {
          return sock.sendMessage(jid, {
            text: '📝 *Set Status Text*\n\nOwner only. Usage: .setstatus <text>\n\nExample: .setstatus 🚀 yobbyking XD — your daily bot',
          });
        }
        if (selected === 'cmd:broadcast-help') {
          return sock.sendMessage(jid, {
            text: '📢 *Broadcast*\n\nOwner only. Usage: .broadcast <message>\n\nSends your message to every user who has used the bot.',
          });
        }
        if (selected === 'cmd:ban-help') {
          return sock.sendMessage(jid, {
            text: '🚫 *Ban User*\n\nOwner only. Reply to or mention the user. Usage: .ban @user',
          });
        }
        await cmd.run({ sock, msg, jid, sender, args: [], isOwner });
        return;
      }
    }
    return;
  }

  const parts = text.slice(1).split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = COMMANDS.find(c => c.name === cmdName || (c.aliases && c.aliases.includes(cmdName)));
  if (!cmd) return;

  const state = store.load();
  const isOwner = state.owner === sender;

  if (state.banned && state.banned.includes(sender)) return;

  // Track usage
  const userUsage = state.userUsage || {};
  userUsage[sender] = {
    lastSeen: Date.now(),
    commandsUsed: (userUsage[sender]?.commandsUsed || 0) + 1,
  };
  store.update({ userUsage });

  // In groups, only respond if mentioned, replying to bot, or owner
  if (isGroup) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user?.id);
    const repliedToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === sock.user?.id;
    if (!mentioned && !repliedToBot && !isOwner) return;
  }

  console.log(`[CMD] .${cmdName} from ${sender.split('@')[0]} in ${jid} (owner: ${isOwner})`);
  await cmd.run({ sock, msg, jid, sender, args, isOwner });
}

startBot().catch(err => {
  console.error('[BOOT] Failed to start:', err);
  process.exit(1);
});

// Start the pairing web server
// We pass a getter function so the server always gets the latest socket
const webApp = createServer(() => sock);
webApp.listen(WEB_PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Pairing site live at http://localhost:${WEB_PORT}`);
  console.log(`   (Expose port ${WEB_PORT} publicly to access from outside)\n`);
});

process.on('unhandledRejection', (reason) => console.error('[UNHANDLED]', reason));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err));
