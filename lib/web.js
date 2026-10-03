'use strict';

/**
 * lib/web.js — Express web server that serves the pairing site.
 * Users visit the page, enter their phone, and the server generates
 * a pairing code using the running Baileys socket.
 *
 * The bot must be running in "pairing mode" — the first time it starts
 * without a registered session, it can generate codes for any phone.
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
const fs = require('fs');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// In-memory map of sessionId -> { phone, code, connected, createdAt }
const sessions = new Map();

function createServer(getSocket) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve the pairing page
  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  // Static files (favicon etc.)
  app.use(express.static(PUBLIC_DIR));

  // Health check
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

  // Generate pairing code
  app.post('/api/pair', async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || !/^\d{6,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number. Use international format, digits only.' });
      }

      const sock = getSocket();
      if (!sock) {
        return res.status(503).json({ error: 'Bot is not ready yet. Please wait a few seconds and try again.' });
      }
      if (!sock.requestPairingCode) {
        return res.status(503).json({ error: 'Bot is already paired. Pairing codes can only be generated before first link.' });
      }

      // Generate the pairing code
      let code;
      try {
        code = await sock.requestPairingCode(phone);
      } catch (err) {
        return res.status(502).json({ error: 'Failed to generate pairing code: ' + (err.message || err) });
      }

      if (!code) {
        return res.status(502).json({ error: 'Bot returned no pairing code. The bot might already be paired.' });
      }

      // Format the code nicely (groups of 4 with dashes if it's long)
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

  // Check session connection status
  app.get('/api/status/:sid', (req, res) => {
    const session = sessions.get(req.params.sid);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Check if bot is now connected (user scanned the code)
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

// Mark a session as connected when the bot connects
function markAllConnected() {
  for (const [sid, session] of sessions) {
    if (!session.connected) {
      session.connected = true;
      console.log(`[WEB] Session ${sid.slice(0, 8)} marked connected`);
    }
  }
}

module.exports = { createServer, markAllConnected };
