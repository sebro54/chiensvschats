const EULER_API_KEY = process.env.EULER_API_KEY || 'COLLE_TA_CLE_EULERSTREAM_ICI';

const express    = require('express');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const { Server } = require('socket.io');

// ── Chargement tiktok-live-connector ──
let TikTokLiveConnection, WebcastEvent, SignConfig;
try {
  const mod = require('tiktok-live-connector');
  TikTokLiveConnection = mod.TikTokLiveConnection;
  WebcastEvent         = mod.WebcastEvent;
  SignConfig           = mod.SignConfig;
  if (SignConfig) SignConfig.apiKey = EULER_API_KEY;
  console.log('tiktok-live-connector charge OK');
} catch(e) {
  console.error('Erreur chargement tiktok-live-connector:', e.message);
  process.exit(1);
}

const app        = express();
const serverHttp = http.createServer(app);
const io         = new Server(serverHttp);

// ── Fichiers statiques (sans auto-serve index.html) ──
app.use(express.static(__dirname,    { index: false }));
app.use(express.static(process.cwd(), { index: false }));

// ── ROUTES PAGES ──
app.get('/', function(req, res) {
  var f = findFile('home.html');
  if (f) return res.sendFile(f);
  res.status(404).send('home.html introuvable');
});

app.get('/game-battle', function(req, res) {
  var f = findFile('index.html');
  if (f) return res.sendFile(f);
  res.status(404).send('index.html introuvable');
});

app.get('/game-quiz', function(req, res) {
  var f = findFile('quiz.html');
  if (f) return res.sendFile(f);
  res.status(404).send('quiz.html introuvable');
});

function findFile(name) {
  var candidates = [
    path.join(__dirname, name),
    path.join(process.cwd(), name)
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  return null;
}

// ── Config cadeaux ──
const GIFT_CONFIG = {
  cats: {
    small: { names: ['rose', 'fleur', 'flower'],                         points: 10,  emoji: '🌹', label: 'Rose' },
    big:   { names: ['lion', 'tiger', 'chat', 'interstellar', 'galaxy'], points: 500, emoji: '🦁', label: 'Lion' }
  },
  dogs: {
    small: { names: ['tiktok', 'logo', 'like'],                          points: 10,  emoji: '🎵', label: 'TikTok' },
    big:   { names: ['rocket', 'drama queen', 'universe', 'doge'],       points: 500, emoji: '🚀', label: 'Rocket' }
  }
};

// ── Etat du jeu ──
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

function addPoints(team, points, source, username) {
  if (!gameState.running) return;
  if (team === 'cats') gameState.catPoints += points;
  else gameState.dogPoints += points;
  io.emit('pointsAdded', { team, points, source, username });
  io.emit('gameState', gameState);
  checkWin();
}

// ── Connexion TikTok ──
let tiktokConnection = null;

function connectToTikTok(username, sessionId, ttTargetIdc) {
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }
  console.log('Connexion a @' + username);

  const options = { signApiKey: EULER_API_KEY };
  if (sessionId)   options.sessionId   = sessionId;
  if (ttTargetIdc) options.ttTargetIdc = ttTargetIdc;

  tiktokConnection = new TikTokLiveConnection(username, options);

  tiktokConnection.connect()
    .then(function(state) {
      console.log('Connecte ! roomId: ' + state.roomId);
      gameState.running = true;
      io.emit('connected',  { username: username, roomId: state.roomId });
      io.emit('gameState',  gameState);
    })
    .catch(function(err) {
      var msg = err.message || String(err);
      console.error('Erreur connexion: ' + msg);
      io.emit('connectionError', { message: msg });
    });

  const CHAT_EVENT = (WebcastEvent && WebcastEvent.CHAT) ? WebcastEvent.CHAT : 'chat';
  const GIFT_EVENT = (WebcastEvent && WebcastEvent.GIFT) ? WebcastEvent.GIFT : 'gift';

  // ── Evènements chat ──
  tiktokConnection.on(CHAT_EVENT, function(data) {
    var msg  = (data.comment || '').toLowerCase();
    var user = (data.user && (data.user.uniqueId || data.user.nickname)) || data.uniqueId || 'Anonyme';

    // Vote battle
    var team = null;
    if (msg.indexOf('chat') !== -1 || msg.indexOf('cats') !== -1) team = 'cats';
    else if (msg.indexOf('chien') !== -1 || msg.indexOf('dog') !== -1 || msg.indexOf('dogs') !== -1) team = 'dogs';
    if (team) {
      addPoints(team, 1, 'chat', user);
      io.emit('chatVote', { team: team, username: user, message: data.comment });
    }

    // Vote quiz (lettre seule A/B/C/D)
    var trimmed = (data.comment || '').trim().toUpperCase();
    if (['A','B','C','D'].indexOf(trimmed) !== -1) {
      io.emit('quizChatVote', { username: user, letter: trimmed });
    } else {
      io.emit('chatMessage', { username: user, message: data.comment });
    }
  });

  // ── Evènements cadeaux ──
  tiktokConnection.on(GIFT_EVENT, function(data) {
    var rawName     = (data.giftName || (data.gift && data.gift.name) || '').toLowerCase();
    var displayName = data.giftName || (data.gift && data.gift.name) || rawName;
    var user        = (data.user && (data.user.uniqueId || data.user.nickname)) || data.uniqueId || 'Anonyme';
    var repeatCount = data.repeatCount || 1;

    // Ignorer les cadeaux en cours de combo
    if (data.giftType === 1 && data.repeatEnd === false) return;

    // Valeur en coins
    var coinValue  = data.diamondCount
      || data.gift_value
      || (data.gift && data.gift.diamondCount)
      || (data.giftDetails && data.giftDetails.diamondCount)
      || 0;
    var totalCoins = coinValue * repeatCount;

    console.log('Cadeau: "' + rawName + '" x' + repeatCount + ' = ' + totalCoins + ' coins de @' + user);

    // Inscription quiz (>= 50 coins)
    io.emit('quizGiftRegistration', { username: user, giftName: displayName, coins: totalCoins });

    // Points battle
    var matched = false;
    for (var teamKey in GIFT_CONFIG) {
      var gifts = GIFT_CONFIG[teamKey];
      for (var sizeKey in gifts) {
        var giftDef = gifts[sizeKey];
        var isMatch = giftDef.names.some(function(n) { return rawName.indexOf(n) !== -1; });
        if (isMatch) {
          var totalPoints = giftDef.points * repeatCount;
          addPoints(teamKey, totalPoints, 'gift', user);
          io.emit('giftReceived', {
            team: teamKey, username: user,
            giftName: giftDef.label, emoji: giftDef.emoji,
            points: totalPoints, repeatCount: repeatCount
          });
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) console.log('Cadeau inconnu: "' + rawName + '"');
  });

  tiktokConnection.on('disconnected', function() {
    console.log('Deconnecte');
    io.emit('disconnected', {});
  });

  tiktokConnection.on('error', function(err) {
    console.error('Erreur TikTok:', err && err.message ? err.message : err);
  });
}

// ── Socket.IO ──
io.on('connection', function(socket) {
  socket.emit('gameState',    gameState);
  socket.emit('apiKeyStatus', { configured: EULER_API_KEY !== 'COLLE_TA_CLE_EULERSTREAM_ICI' });

  socket.on('connect_tiktok', function(data) { connectToTikTok(data.username, data.sessionId, data.ttTargetIdc); });
  socket.on('connect_quiz',   function(data) { connectToTikTok(data.username, data.sessionId, data.ttTargetIdc); });
  socket.on('reset_game',     function()     { resetGame(); });
});

// ── Lancement ──
var PORT = process.env.PORT || 3000;
serverHttp.listen(PORT, '0.0.0.0', function() {
  console.log('Serveur demarre sur port ' + PORT);
  console.log('EULER_API_KEY configuree: ' + (EULER_API_KEY !== 'COLLE_TA_CLE_EULERSTREAM_ICI'));
});
