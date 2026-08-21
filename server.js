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
let earlyBuzzes = [];
let pointValue = 1;
let earlyBuzzPenaltySeconds = 0;
let connectedPlayers = new Map();
let nextTeamId = 3;
let teams = [
  { id: 'team-1', name: 'Team 1', score: 0 },
  { id: 'team-2', name: 'Team 2', score: 0 }
];

function cleanName(value, fallback = '') {
  const result = String(value || '').trim().slice(0, 30);
  return result || fallback;
}

function getTeam(teamId) {
  return teams.find((team) => team.id === teamId);
}

function publicState() {
  return {
    roundOpen,
    roundStart,
    buzzes,
    earlyBuzzes,
    pointValue,
    earlyBuzzPenaltySeconds,
    teams,
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
      score: existing?.score ?? 0,
      teamId: existing?.teamId ?? '',
      lockedUntil: existing?.lockedUntil ?? 0
    });
    broadcastState();
  });

  socket.on('buzz', () => {
    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const now = Date.now();

    // Vor dem Start der Runde zählt ein Buzz als Frühstart.
    if (!roundOpen) {
      if (roundStart !== null) return; // Nach dem Sperren einer laufenden Runde ignorieren.
      if (earlyBuzzes.some((b) => b.socketId === socket.id)) return;

      const penaltyMs = Math.round(earlyBuzzPenaltySeconds * 1000);
      if (penaltyMs > 0) {
        player.lockedUntil = Math.max(player.lockedUntil || 0, now + penaltyMs);
      }

      const earlyBuzz = {
        socketId: socket.id,
        name: player.name,
        teamId: player.teamId || '',
        serverTimestamp: now,
        lockedUntil: player.lockedUntil || 0
      };
      earlyBuzzes.push(earlyBuzz);
      socket.emit('early-buzz-confirmed', earlyBuzz);
      io.emit('early-buzz-event', earlyBuzz);
      broadcastState();
      return;
    }

    if (!roundStart) return;
    if ((player.lockedUntil || 0) > now) {
      socket.emit('buzz-locked', { lockedUntil: player.lockedUntil });
      return;
    }
    if (buzzes.some((b) => b.socketId === socket.id)) return;

    const buzz = {
      socketId: socket.id,
      name: player.name,
      teamId: player.teamId || '',
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
    earlyBuzzes = [];
    for (const player of connectedPlayers.values()) player.lockedUntil = 0;
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
    earlyBuzzes.forEach((buzz) => {
      if (buzz.socketId === player.id || buzz.name === oldName) buzz.name = nameClean;
    });
    broadcastState();
  });

  socket.on('host-set-player-team', ({ id, teamId }) => {
    const player = connectedPlayers.get(String(id || ''));
    const nextTeamId = String(teamId || '');
    if (!player) return;
    if (nextTeamId && !getTeam(nextTeamId)) return;

    player.teamId = nextTeamId;
    buzzes.forEach((buzz) => {
      if (buzz.socketId === player.id) buzz.teamId = nextTeamId;
    });
    earlyBuzzes.forEach((buzz) => {
      if (buzz.socketId === player.id) buzz.teamId = nextTeamId;
    });
    broadcastState();
  });

  socket.on('host-add-team', (name) => {
    if (teams.length >= 12) return;
    const id = `team-${nextTeamId++}`;
    teams.push({ id, name: cleanName(name, `Team ${teams.length + 1}`), score: 0 });
    broadcastState();
  });

  socket.on('host-rename-team', ({ id, name }) => {
    const team = getTeam(String(id || ''));
    if (!team) return;
    team.name = cleanName(name, team.name);
    broadcastState();
  });

  socket.on('host-delete-team', (id) => {
    const teamId = String(id || '');
    if (!getTeam(teamId)) return;
    teams = teams.filter((team) => team.id !== teamId);
    for (const player of connectedPlayers.values()) {
      if (player.teamId === teamId) player.teamId = '';
    }
    buzzes.forEach((buzz) => { if (buzz.teamId === teamId) buzz.teamId = ''; });
    earlyBuzzes.forEach((buzz) => { if (buzz.teamId === teamId) buzz.teamId = ''; });
    broadcastState();
  });

  socket.on('host-change-team-score', ({ id, direction }) => {
    const team = getTeam(String(id || ''));
    if (!team) return;
    const sign = Number(direction) < 0 ? -1 : 1;
    team.score += sign * pointValue;
    broadcastState();
  });

  socket.on('host-set-team-score', ({ id, score }) => {
    const team = getTeam(String(id || ''));
    const parsed = Number(score);
    if (!team || !Number.isFinite(parsed)) return;
    team.score = Math.max(-999999, Math.min(999999, parsed));
    broadcastState();
  });

  socket.on('host-set-point-value', (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    pointValue = Math.max(0, Math.min(9999, Math.abs(parsed)));
    broadcastState();
  });

  socket.on('host-set-early-penalty', (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    earlyBuzzPenaltySeconds = Math.max(0, Math.min(60, parsed));
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
