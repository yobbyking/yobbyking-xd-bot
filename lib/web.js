'use strict';

/**
 * lib/web.js — Express web server that serves the pairing site.
 *
 * Handles the case where the bot is reconnecting (e.g. after a 408 timeout
 * or 401 logout). The /api/pair endpoint waits up to 15 seconds for the
 * socket to be ready before generating the pairing code.
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
      botConnected: sock ? !!sock.user : false,
      botNumber: sock?.user?.id?.split(':')[0] || null,
      uptime: process.uptime(),
      sessions: sessions.size,
    });
  });

  /**
   * Wait for the socket to be ready (connected and able to generate pairing codes).
   * Returns true if ready within timeoutMs, false otherwise.
   */
  async function waitForSocket(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const sock = getSocket();
      if (sock && sock.user === undefined) {
        // Socket exists but not yet connected — wait
      }
      if (sock && sock.user && sock.requestPairingCode) {
        return true;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  app.post('/api/pair', async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || !/^\d{6,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number. Use international format, digits only.' });
      }

      // Wait for the socket to be ready (handles reconnection after 408/401)
      const ready = await waitForSocket(15000);
      if (!ready) {
        return res.status(503).json({
          error: 'Bot is reconnecting. Please wait 10 seconds and try again.',
        });
      }

      const sock = getSocket();
      if (!sock || !sock.requestPairingCode) {
        return res.status(503).json({ error: 'Bot is not ready for pairing yet.' });
      }

      // Generate the pairing code
      let code;
      try {
        code = await sock.requestPairingCode(phone);
      } catch (err) {
        console.error('[WEB] requestPairingCode error:', err.message || err);
        return res.status(502).json({
          error: 'Connection closed. The bot is reconnecting — please wait 5 seconds and try again.',
        });
      }

      if (!code) {
        return res.status(502).json({ error: 'Bot returned no pairing code. Please try again.' });
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
    const sock = getSocket();
    const connected = sock && sock.user && sock.user.id;
    if (connected && !session.connected) {
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

module.exports = { createServer, markAllConnected };
