'use strict';

/**
 * lib/web.js — Express web server that serves the pairing site.
 *
 * The /api/pair endpoint retries generating the pairing code up to 3 times
 * with 2-second delays — handling the case where the bot's WebSocket
 * is still connecting or just reconnected.
 *
 * Endpoints:
 *   GET  /                    — pairing page (public/index.html)
 *   POST /api/pair            — generate pairing code { phone } -> { code, sessionId }
 *   GET  /api/status/:sid     — check if session connected { connected: bool }
 *   GET  /api/health          — server health check
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const sessions = new Map();

// Track whether the bot's WebSocket is connected (set by index.js via setBotStatus)
let botWsConnected = false;
let botFullyConnected = false;

function setBotStatus(wsConnected, fullyConnected) {
  botWsConnected = wsConnected;
  botFullyConnected = fullyConnected;
}

function createServer(getSocket) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
  app.use(express.static(PUBLIC_DIR));

  app.get('/api/health', (req, res) => {
    const sock = getSocket();
    res.json({
      ok: true,
      botConnected: botFullyConnected,
      wsConnected: botWsConnected,
      botNumber: sock?.user?.id?.split(':')[0] || null,
      uptime: process.uptime(),
      sessions: sessions.size,
    });
  });

  /**
   * Try to generate a pairing code, retrying up to 3 times.
   * The bot's WebSocket might still be connecting or just reconnected.
   */
  async function tryGenerateCode(phone, retries = 3, delayMs = 2000) {
    let lastErr = null;
    for (let i = 0; i < retries; i++) {
      const sock = getSocket();
      if (!sock || !sock.requestPairingCode) {
        lastErr = new Error('Bot is starting up...');
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      try {
        const code = await sock.requestPairingCode(phone);
        if (code) return code;
        lastErr = new Error('Bot returned empty code');
      } catch (err) {
        lastErr = err;
        console.log(`[WEB] Attempt ${i + 1}/${retries} failed: ${err.message || err}`);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastErr || new Error('Failed after retries');
  }

  app.post('/api/pair', async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || !/^\d{6,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number. Use international format, digits only.' });
      }

      // Try generating the code (retries internally)
      let code;
      try {
        code = await tryGenerateCode(phone, 3, 2000);
      } catch (err) {
        console.error('[WEB] All pairing attempts failed:', err.message || err);
        return res.status(502).json({
          error: 'Bot is still connecting to WhatsApp. Please wait 10 seconds and try again.',
        });
      }

      // Format the code (groups of 4 with dash if 8 chars)
      let formatted = code;
      if (code.length === 8 && !code.includes('-')) {
        formatted = code.slice(0, 4) + '-' + code.slice(4);
      }

      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        phone,
        code,
        connected: false,
        createdAt: Date.now(),
      });

      console.log(`[WEB] Pairing code generated for ${phone}: ${formatted} (session ${sessionId.slice(0, 8)})`);

      res.json({
        code: formatted,
        sessionId,
        message: 'Enter this code on your WhatsApp phone: Settings → Linked Devices → Link a device → Link with phone number instead',
      });
    } catch (err) {
      console.error('[WEB] /api/pair error:', err);
      res.status(500).json({ error: 'Internal error: ' + (err.message || err) });
    }
  });

  app.get('/api/status/:sid', (req, res) => {
    const session = sessions.get(req.params.sid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    // Check if bot is now fully connected
    if (botFullyConnected && !session.connected) {
      session.connected = true;
      console.log(`[WEB] Session ${req.params.sid.slice(0, 8)} connected!`);
    }
    res.json({
      connected: !!session.connected,
      phone: session.phone,
      createdAt: session.createdAt,
    });
  });

  return app;
}

function markAllConnected() {
  for (const [sid, session] of sessions) {
    if (!session.connected) {
      session.connected = true;
      console.log(`[WEB] Session ${sid.slice(0, 8)} marked connected`);
    }
  }
}

module.exports = { createServer, markAllConnected, setBotStatus };
