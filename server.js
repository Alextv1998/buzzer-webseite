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
let showPlayerBuzzDetails = false;
let currentGameName = '';
let currentGameRules = '';
let answerTimerEnabled = false;
let answerTimerSeconds = 5;
let answerTimerStartedAt = null;
let answerTimerBuzzSocketId = '';
let showPlayerTribune = false;
let connectedPlayers = new Map();
let nextTeamId = 3;
let teams = [
  { id: 'team-1', name: 'Team 1', score: 0, color: '#3b82f6', buzzerLocked: false },
  { id: 'team-2', name: 'Team 2', score: 0, color: '#ef4444', buzzerLocked: false }
];

function cleanName(value, fallback = '') {
  const result = String(value || '').trim().slice(0, 30);
  return result || fallback;
}

function getTeam(teamId) {
  return teams.find((team) => team.id === teamId);
}

function publicState() {
  const now = Date.now();
  const players = Array.from(connectedPlayers.values()).map((player) => ({
    ...player,
    // Restzeit wird auf dem Server berechnet. Dadurch hängt der Countdown
    // nicht von der Uhrzeit des Spieler-PCs ab.
    lockRemainingMs: Math.max(0, (player.lockedUntil || 0) - now)
  }));

  // Teampunkte werden immer aus den Einzelpunkten der aktuell zugeordneten
  // Spieler berechnet. Es gibt keinen separaten Team-Punktestand mehr.
  const publicTeams = teams.map((team) => ({
    ...team,
    score: players
      .filter((player) => player.teamId === team.id)
      .reduce((sum, player) => sum + (Number(player.score) || 0), 0)
  }));

  return {
    roundOpen,
    roundStart,
    buzzes,
    earlyBuzzes,
    pointValue,
    earlyBuzzPenaltySeconds,
    showPlayerBuzzDetails,
    currentGameName,
    currentGameRules,
    answerTimerEnabled,
    answerTimerSeconds,
    answerTimerStartedAt,
    answerTimerRemainingMs: answerTimerStartedAt ? Math.max(0, Math.round(answerTimerSeconds * 1000) - (now - answerTimerStartedAt)) : 0,
    answerTimerBuzzSocketId,
    showPlayerTribune,
    teams: publicTeams,
    players
  };
}

function broadcastState() {
  io.emit('state', publicState());
}

function cleanMessage(value) {
  return String(value || '').trim().slice(0, 500);
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
      lockedUntil: existing?.lockedUntil ?? 0,
      buzzerLocked: existing?.buzzerLocked ?? false,
      avatar: existing?.avatar ?? '',
      tribuneVisible: existing?.tribuneVisible ?? true
    });
    broadcastState();
  });

  socket.on('buzz', () => {
    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    const now = Date.now();
    const team = getTeam(player.teamId || '');
    if (player.buzzerLocked || team?.buzzerLocked) {
      socket.emit('buzz-disabled', { reason: player.buzzerLocked ? 'player' : 'team' });
      return;
    }

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

    // Der Antworttimer startet beim ersten gültigen Buzz der Runde.
    if (answerTimerEnabled && answerTimerStartedAt === null) {
      answerTimerStartedAt = now;
      answerTimerBuzzSocketId = socket.id;
    }

    socket.emit('buzz-confirmed', buzz);
    io.emit('buzz-event', buzz);
    broadcastState();
  });

  socket.on('host-start', () => {
    buzzes = [];
    roundStart = Date.now();
    roundOpen = true;
    answerTimerStartedAt = null;
    answerTimerBuzzSocketId = '';
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
    answerTimerStartedAt = null;
    answerTimerBuzzSocketId = '';
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
    teams.push({ id, name: cleanName(name, `Team ${teams.length + 1}`), score: 0, color: '#8b5cf6', buzzerLocked: false });
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


  socket.on('host-set-team-color', ({ id, color }) => {
    const team = getTeam(String(id || ''));
    const clean = String(color || '').trim();
    if (!team || !/^#[0-9a-fA-F]{6}$/.test(clean)) return;
    team.color = clean;
    broadcastState();
  });

  socket.on('host-move-team', ({ id, direction }) => {
    const index = teams.findIndex(t => t.id === String(id || ''));
    if (index < 0) return;
    const target = index + (Number(direction) < 0 ? -1 : 1);
    if (target < 0 || target >= teams.length) return;
    [teams[index], teams[target]] = [teams[target], teams[index]];
    broadcastState();
  });

  socket.on('host-reorder-team', ({ id, beforeId }) => {
    const from = teams.findIndex(t => t.id === String(id || ''));
    if (from < 0) return;
    const [team] = teams.splice(from, 1);
    if (!beforeId) teams.push(team);
    else {
      const to = teams.findIndex(t => t.id === String(beforeId));
      if (to < 0) teams.push(team); else teams.splice(to, 0, team);
    }
    broadcastState();
  });


  socket.on('host-set-player-buzzer-lock', ({ id, locked }) => {
    const player = connectedPlayers.get(String(id || ''));
    if (!player) return;
    player.buzzerLocked = Boolean(locked);
    broadcastState();
  });

  socket.on('host-set-team-buzzer-lock', ({ id, locked }) => {
    const team = getTeam(String(id || ''));
    if (!team) return;
    team.buzzerLocked = Boolean(locked);
    broadcastState();
  });

  socket.on('host-send-message', ({ message, playerIds, teamIds, allPlayers }) => {
    const text = cleanMessage(message);
    if (!text) return;

    const selectedPlayers = new Set(Array.isArray(playerIds) ? playerIds.map(String) : []);
    const selectedTeams = new Set(Array.isArray(teamIds) ? teamIds.map(String) : []);
    const recipients = new Set();

    for (const player of connectedPlayers.values()) {
      if (allPlayers || selectedPlayers.has(player.id) || (player.teamId && selectedTeams.has(player.teamId))) {
        recipients.add(player.id);
      }
    }

    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: text,
      sentAt: Date.now()
    };

    recipients.forEach((socketId) => io.to(socketId).emit('host-message', payload));
    socket.emit('host-message-sent', { count: recipients.size, message: text, sentAt: payload.sentAt });
  });


  socket.on('host-set-player-buzz-details', (value) => {
    showPlayerBuzzDetails = Boolean(value);
    broadcastState();
  });

  socket.on('host-set-game-info', ({ name, rules }) => {
    currentGameName = String(name || '').trim().slice(0, 80);
    currentGameRules = String(rules || '').trim().slice(0, 1500);
    broadcastState();
  });


  socket.on('host-set-answer-timer', ({ enabled, seconds }) => {
    answerTimerEnabled = Boolean(enabled);
    const parsed = Number(String(seconds).replace(',', '.'));
    if (Number.isFinite(parsed)) answerTimerSeconds = Math.max(1, Math.min(120, parsed));
    if (!answerTimerEnabled) {
      answerTimerStartedAt = null;
      answerTimerBuzzSocketId = '';
    }
    broadcastState();
  });

  socket.on('host-reset-answer-timer', () => {
    answerTimerStartedAt = null;
    answerTimerBuzzSocketId = '';
    broadcastState();
  });

  socket.on('host-set-player-tribune-display', (value) => {
    showPlayerTribune = Boolean(value);
    broadcastState();
  });

  socket.on('host-set-player-tribune-visible', ({ id, visible }) => {
    const player = connectedPlayers.get(String(id || ''));
    if (!player) return;
    player.tribuneVisible = Boolean(visible);
    broadcastState();
  });

  socket.on('host-set-player-avatar', ({ id, dataUrl }) => {
    const player = connectedPlayers.get(String(id || ''));
    if (!player) return;
    const value = String(dataUrl || '');
    if (!value) {
      player.avatar = '';
      broadcastState();
      return;
    }
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(value) || value.length > 700000) return;
    player.avatar = value;
    broadcastState();
  });

  socket.on('host-play-sound', ({ sound, share }) => {
    const allowed = new Set(['correct','wrong','ding','applause','drumroll','timeup','buzzer']);
    const name = String(sound || '');
    if (!allowed.has(name)) return;
    if (share) io.emit('soundboard-play', { sound: name });
    else socket.emit('soundboard-play', { sound: name });
  });

  socket.on('host-set-point-value', (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    pointValue = Math.max(0, Math.min(9999, Math.abs(parsed)));
    broadcastState();
  });

  socket.on('host-set-early-penalty', (value) => {
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    earlyBuzzPenaltySeconds = Math.max(0, Math.min(60, parsed));

    // Falls die Sperrzeit während eines Tests geändert wird, keine alte
    // (z. B. 60-Sekunden-)Sperre weiterlaufen lassen. Bereits gesperrte
    // Frühstarter bekommen ab jetzt exakt die neu eingestellte Dauer.
    const now = Date.now();
    for (const player of connectedPlayers.values()) {
      if ((player.lockedUntil || 0) > now) {
        player.lockedUntil = earlyBuzzPenaltySeconds > 0
          ? now + Math.round(earlyBuzzPenaltySeconds * 1000)
          : 0;
      }
    }
    earlyBuzzes.forEach((buzz) => {
      const player = connectedPlayers.get(buzz.socketId);
      buzz.lockedUntil = player?.lockedUntil || 0;
    });

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
