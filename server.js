const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let roundOpen = false;
let roundStart = null;
let buzzes = [];
let pointValue = 1;
let connectedPlayers = new Map();

function cleanName(value) {
  return String(value || '').trim().slice(0, 30);
}

function publicState() {
  return {
    roundOpen,
    roundStart,
    buzzes,
    pointValue,
    players: Array.from(connectedPlayers.values())
  };
}

function broadcastState() {
  io.emit('state', publicState());
}

io.on('connection', (socket) => {
  socket.emit('state', publicState());

  socket.on('join-player', (name) => {
    const nameClean = cleanName(name);
    if (!nameClean) return;

    const existing = connectedPlayers.get(socket.id);
    connectedPlayers.set(socket.id, {
      id: socket.id,
      name: nameClean,
      score: existing?.score ?? 0
    });
    broadcastState();
  });

  socket.on('buzz', () => {
    if (!roundOpen || !roundStart) return;
    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (buzzes.some((b) => b.socketId === socket.id)) return;

    const now = Date.now();
    const buzz = {
      socketId: socket.id,
      name: player.name,
      timeMs: now - roundStart,
      serverTimestamp: now
    };

    buzzes.push(buzz);
    buzzes.sort((a, b) => a.serverTimestamp - b.serverTimestamp);

    socket.emit('buzz-confirmed', buzz);
    io.emit('buzz-event', buzz);
    broadcastState();
  });

  socket.on('host-start', () => {
    buzzes = [];
    roundStart = Date.now();
    roundOpen = true;
    broadcastState();
  });

  socket.on('host-close', () => {
    roundOpen = false;
    broadcastState();
  });

  socket.on('host-reset', () => {
    roundOpen = false;
    roundStart = null;
    buzzes = [];
    broadcastState();
  });

  socket.on('host-rename-player', ({ id, name }) => {
    const player = connectedPlayers.get(String(id || ''));
    const nameClean = cleanName(name);
    if (!player || !nameClean) return;

    const oldName = player.name;
    player.name = nameClean;
    buzzes.forEach((buzz) => {
      if (buzz.socketId === player.id || buzz.name === oldName) buzz.name = nameClean;
    });
    broadcastState();
  });

  socket.on('host-set-point-value', (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    pointValue = Math.max(0, Math.min(9999, Math.abs(parsed)));
    broadcastState();
  });

  socket.on('host-change-score', ({ id, direction }) => {
    const player = connectedPlayers.get(String(id || ''));
    if (!player) return;
    const sign = Number(direction) < 0 ? -1 : 1;
    player.score += sign * pointValue;
    broadcastState();
  });

  socket.on('host-set-score', ({ id, score }) => {
    const player = connectedPlayers.get(String(id || ''));
    const parsed = Number(score);
    if (!player || !Number.isFinite(parsed)) return;
    player.score = Math.max(-999999, Math.min(999999, parsed));
    broadcastState();
  });

  socket.on('disconnect', () => {
    connectedPlayers.delete(socket.id);
    broadcastState();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Buzzer läuft auf Port ${PORT}`);
});
