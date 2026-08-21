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
let connectedPlayers = new Map();

function publicState() {
  return {
    roundOpen,
    roundStart,
    buzzes,
    players: Array.from(connectedPlayers.values())
  };
}

function broadcastState() {
  io.emit('state', publicState());
}

io.on('connection', (socket) => {
  socket.emit('state', publicState());

  socket.on('join-player', (name) => {
    const cleanName = String(name || '').trim().slice(0, 30);
    if (!cleanName) return;
    connectedPlayers.set(socket.id, { id: socket.id, name: cleanName });
    broadcastState();
  });

  socket.on('buzz', () => {
    if (!roundOpen || !roundStart) return;
    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (buzzes.some((b) => b.socketId === socket.id)) return;

    const now = Date.now();
    buzzes.push({
      socketId: socket.id,
      name: player.name,
      timeMs: now - roundStart,
      serverTimestamp: now
    });

    buzzes.sort((a, b) => a.serverTimestamp - b.serverTimestamp);
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

  socket.on('disconnect', () => {
    connectedPlayers.delete(socket.id);
    broadcastState();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Buzzer läuft auf Port ${PORT}`);
});
