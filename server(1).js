/**
 * 🐱 CHATS vs CHIENS - Serveur TikTok Live 🐶
 * 
 * ══════════════════════════════════════════════════════════════════
 *  INSTALLATION
 * ══════════════════════════════════════════════════════════════════
 *  1. npm install tiktok-live-connector@latest socket.io express
 *
 *  2. Crée une clé API GRATUITE sur https://www.eulerstream.com
 *     → Inscris-toi, va dans "API Keys", crée une clé
 *     → Colle-la dans EULER_API_KEY ci-dessous
 *
 *  3. node server.js
 *
 *  4. Ouvre http://localhost:3000 dans ton navigateur
 * ══════════════════════════════════════════════════════════════════
 *
 *  POURQUOI eulerstream ?
 *  Depuis 2024, TikTok exige que toutes les URLs WebSocket soient
 *  "signées" cryptographiquement. EulerStream fournit ce service.
 *  Le plan gratuit suffit largement pour un streamer.
 * ══════════════════════════════════════════════════════════════════
 */

// ─── ⚙️  CLÉ EULERSTREAM ─────────────────────────────────────────
// Sur Railway : configure la variable d'environnement EULER_API_KEY
// En local : colle ta clé ici directement
const EULER_API_KEY = process.env.EULER_API_KEY || 'COLLE_TA_CLE_EULERSTREAM_ICI';
// ─────────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection, WebcastEvent, SignConfig } = require('tiktok-live-connector');
const path = require('path');

// Configurer EulerStream pour signer les requêtes (résout l'erreur 403)
SignConfig.apiKey = EULER_API_KEY;

const app = express();
const serverHttp = http.createServer(app);
const io = new Server(serverHttp);

app.use(express.static(path.join(__dirname)));

// ─── CONFIGURATION DES CADEAUX ────────────────────────────────────────────────
const GIFT_CONFIG = {
  cats: {
    small:  { names: ['rose', 'fleur', 'flower'],                           points: 10,  emoji: '🌹', label: 'Rose'   },
    big:    { names: ['lion', 'tiger', 'chat', 'interstellar', 'galaxy'],   points: 500, emoji: '🦁', label: 'Lion'   }
  },
  dogs: {
    small:  { names: ['tiktok', 'logo', 'like'],                            points: 10,  emoji: '🎵', label: 'TikTok' },
    big:    { names: ['rocket', 'drama queen', 'universe', 'doge'],         points: 500, emoji: '🚀', label: 'Rocket' }
  }
};

// ─── ÉTAT DU JEU ──────────────────────────────────────────────────────────────
let gameState = { catPoints: 0, dogPoints: 0, winner: null, running: false, targetPoints: 1000 };

function resetGame() {
  gameState = { catPoints: 0, dogPoints: 0, winner: null, running: true, targetPoints: 1000 };
  io.emit('gameState', gameState);
}

function checkWin() {
  if (gameState.winner) return;
  if (gameState.catPoints >= gameState.targetPoints) {
    gameState.winner = 'cats'; gameState.running = false; io.emit('gameState', gameState);
  } else if (gameState.dogPoints >= gameState.targetPoints) {
    gameState.winner = 'dogs'; gameState.running = false; io.emit('gameState', gameState);
  }
}

function addPoints(team, points, source, username, giftName) {
  if (!gameState.running) return;
  if (team === 'cats') gameState.catPoints += points;
  else gameState.dogPoints += points;
  io.emit('pointsAdded', { team, points, source, username, giftName });
  io.emit('gameState', gameState);
  checkWin();
}

// ─── CONNEXION TIKTOK ─────────────────────────────────────────────────────────
let tiktokConnection = null;

function connectToTikTok(username, sessionId, ttTargetIdc) {
  if (tiktokConnection) { try { tiktokConnection.disconnect(); } catch(e) {} tiktokConnection = null; }
  console.log(`📡 Connexion à @${username}...`);

  const options = {};
  if (sessionId && ttTargetIdc) { options.sessionId = sessionId; options.ttTargetIdc = ttTargetIdc; }

  tiktokConnection = new TikTokLiveConnection(username, options);

  tiktokConnection.connect()
    .then(state => {
      console.log(`✅ Connecté ! roomId: ${state.roomId}`);
      gameState.running = true;
      io.emit('connected', { username, roomId: state.roomId });
      io.emit('gameState', gameState);
    })
    .catch(err => {
      const msg = err.message || String(err);
      console.error(`❌ ${msg}`);
      io.emit('connectionError', { message: msg });
    });

  // 💬 CHAT
  tiktokConnection.on(WebcastEvent.CHAT, data => {
    const msg = (data.comment || '').toLowerCase();
    const user = data.user?.uniqueId || data.user?.nickname || 'Anonyme';
    let team = null;
    if (msg.includes('chat') || msg.includes('🐱') || msg.includes('cats')) team = 'cats';
    else if (msg.includes('chien') || msg.includes('dog') || msg.includes('🐶') || msg.includes('dogs')) team = 'dogs';
    if (team) { addPoints(team, 1, 'chat', user, data.comment); io.emit('chatVote', { team, username: user, message: data.comment }); }
    else { io.emit('chatMessage', { username: user, message: data.comment }); }
  });

  // 🎁 CADEAUX
  tiktokConnection.on(WebcastEvent.GIFT, data => {
    const rawName = (data.giftName || data.gift?.name || data.giftDetails?.name || '').toLowerCase();
    const user = data.user?.uniqueId || data.user?.nickname || 'Anonyme';
    const repeatCount = data.repeatCount || 1;
    if (data.giftType === 1 && data.repeatEnd === false) return;
    console.log(`🎁 "${rawName}" x${repeatCount} de @${user}`);

    let matched = false;
    for (const [team, gifts] of Object.entries(GIFT_CONFIG)) {
      for (const [size, giftDef] of Object.entries(gifts)) {
        if (giftDef.names.some(n => rawName.includes(n))) {
          const totalPoints = giftDef.points * repeatCount;
          addPoints(team, totalPoints, 'gift', user, giftDef.label);
          io.emit('giftReceived', { team, username: user, giftName: giftDef.label, emoji: giftDef.emoji, points: totalPoints, repeatCount, size });
          matched = true; break;
        }
      }
      if (matched) break;
    }
    if (!matched) console.log(`  → Cadeau inconnu: "${rawName}"`);
  });

  tiktokConnection.on('disconnected', () => { console.log('🔌 Déconnecté'); io.emit('disconnected', {}); });
  tiktokConnection.on('error', err => { console.error('⚠️', err?.message || err); });
}

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.emit('gameState', gameState);
  socket.emit('apiKeyStatus', { configured: EULER_API_KEY !== 'COLLE_TA_CLE_EULERSTREAM_ICI' });
  socket.on('connect_tiktok', ({ username, sessionId, ttTargetIdc }) => connectToTikTok(username, sessionId, ttTargetIdc));
  socket.on('reset_game', () => resetGame());
});

// ─── LANCEMENT ────────────────────────────────────────────────────────────────
// Railway injecte process.env.PORT automatiquement
const PORT = process.env.PORT || 3000;
serverHttp.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   🐱 Chats vs Chiens - TikTok Live 🐶   ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  🌐  Port: ${PORT}                          ║`);
  const apiKey = process.env.EULER_API_KEY || EULER_API_KEY;
  if (apiKey === 'COLLE_TA_CLE_EULERSTREAM_ICI') {
    console.log(`║  ⚠️  EULER_API_KEY non configurée !       ║`);
  } else {
    console.log(`║  ✅  EulerStream configuré                ║`);
  }
  console.log(`╚══════════════════════════════════════════╝\n`);
});
