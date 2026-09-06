const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) {}
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// SHA-256 von dem vereinbarten Host-Passwort. Das Klartext-Passwort steht dadurch
// nicht im öffentlichen Repository. Für produktive Nutzung kann alternativ
// HOST_PASSWORD_HASH als Render-Umgebungsvariable gesetzt werden.
const DEFAULT_HOST_PASSWORD_HASH = '443f83e7519ed299c287829e475ac5827d73f528b1536d5e31ff51aaeb72c175';
const HOST_PASSWORD_HASH = String(process.env.HOST_PASSWORD_HASH || DEFAULT_HOST_PASSWORD_HASH).toLowerCase();
function passwordHash(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex'); }

app.use(express.static(path.join(__dirname, 'public')));

let roundOpen = false;
let roundStart = null;
let globalBuzzerLocked = false;
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

const BUZZER_TEXT_STATE_FILE = path.join(__dirname, 'buzzer-text-state.json');
let buzzerTexts = {
  active: 'AKTIV',
  inactive: 'INAKTIV',
  locked: 'LOCKED'
};

function sanitizeBuzzerText(value, fallback) {
  const cleaned = String(value ?? '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 40);
  return cleaned || fallback;
}

function saveBuzzerTextState() {
  try {
    fs.writeFileSync(BUZZER_TEXT_STATE_FILE, JSON.stringify({ version: 1, buzzerTexts }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Buzzer-Text-State konnte nicht gespeichert werden:', err.message);
  }
}

function loadBuzzerTextState() {
  try {
    if (!fs.existsSync(BUZZER_TEXT_STATE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(BUZZER_TEXT_STATE_FILE, 'utf8'));
    buzzerTexts = {
      active: sanitizeBuzzerText(parsed?.buzzerTexts?.active, 'AKTIV'),
      inactive: sanitizeBuzzerText(parsed?.buzzerTexts?.inactive, 'INAKTIV'),
      locked: sanitizeBuzzerText(parsed?.buzzerTexts?.locked, 'LOCKED')
    };
  } catch (err) {
    console.warn('Buzzer-Text-State konnte nicht geladen werden:', err.message);
  }
}

loadBuzzerTextState();

let connectedPlayers = new Map();
const TEAM_STATE_FILE = path.join(__dirname, 'team-state.json');
const DEFAULT_TEAMS = [
  { id: 'team-1', name: 'Team 1', score: 0, color: '#3b82f6', buzzerLocked: false },
  { id: 'team-2', name: 'Team 2', score: 0, color: '#ef4444', buzzerLocked: false }
];
let nextTeamId = 3;
let teams = DEFAULT_TEAMS.map(t => ({ ...t }));
let savedPlayerTeamsByName = {};

function sanitizeTeamSnapshot(rawTeams) {
  if (!Array.isArray(rawTeams)) return [];
  const seen = new Set();
  return rawTeams.slice(0, 12).map((raw, index) => {
    let id = String(raw?.id || `team-${index + 1}`).trim().slice(0, 40);
    if (!id || seen.has(id)) id = `team-restored-${Date.now()}-${index}`;
    seen.add(id);
    const color = /^#[0-9a-fA-F]{6}$/.test(String(raw?.color || '')) ? String(raw.color) : '#8b5cf6';
    return {
      id,
      name: cleanName(raw?.name, `Team ${index + 1}`),
      score: 0,
      color,
      buzzerLocked: Boolean(raw?.buzzerLocked)
    };
  });
}

function recalcNextTeamId() {
  const numeric = teams.map(t => /^team-(\d+)$/.exec(t.id)).filter(Boolean).map(m => Number(m[1]));
  nextTeamId = Math.max(3, numeric.length ? Math.max(...numeric) + 1 : 3);
}

function saveTeamState() {
  try {
    const playerTeamsByName = { ...savedPlayerTeamsByName };
    for (const player of connectedPlayers.values()) {
      if (player.name) playerTeamsByName[player.name] = player.teamId || '';
    }
    fs.writeFileSync(TEAM_STATE_FILE, JSON.stringify({ version: 1, teams, playerTeamsByName }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Team-State konnte nicht gespeichert werden:', err.message);
  }
}

function loadTeamState() {
  try {
    if (!fs.existsSync(TEAM_STATE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(TEAM_STATE_FILE, 'utf8'));
    const restored = sanitizeTeamSnapshot(parsed?.teams);
    if (restored.length) teams = restored;
    savedPlayerTeamsByName = parsed?.playerTeamsByName && typeof parsed.playerTeamsByName === 'object' ? parsed.playerTeamsByName : {};
    recalcNextTeamId();
  } catch (err) {
    console.warn('Team-State konnte nicht geladen werden:', err.message);
  }
}


// Integriertes Chat-System: Privat Spieler ↔ Host und Teamchat.
let chatMessages = [];
let chatSettings = {
  privateEnabled: true,
  teamEnabled: true
};
const MAX_CHAT_MESSAGES = 1000;

function chatMessageId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function trimChatHistory() {
  if (chatMessages.length > MAX_CHAT_MESSAGES) chatMessages = chatMessages.slice(-MAX_CHAT_MESSAGES);
}

function chatPayloadForPlayer(player) {
  if (!player) return { settings: chatSettings, private: [], team: [], teamId: '' };
  return {
    settings: chatSettings,
    private: chatMessages.filter(m => m.scope === 'private' && m.playerId === player.id),
    team: player.teamId ? chatMessages.filter(m => m.scope === 'team' && m.teamId === player.teamId) : [],
    teamId: player.teamId || ''
  };
}

function chatPayloadForHost() {
  return { settings: chatSettings, messages: chatMessages };
}

function emitChatStateToPlayer(socketId) {
  const player = connectedPlayers.get(socketId);
  if (player) io.to(socketId).emit('chat-state', chatPayloadForPlayer(player));
}

function emitChatStateToHostSocket(socket) {
  if (socket?.data?.isHost) socket.emit('host-chat-state', chatPayloadForHost());
}

function broadcastChatStates() {
  for (const player of connectedPlayers.values()) emitChatStateToPlayer(player.id);
  for (const [, hostSocket] of io.sockets.sockets) {
    if (hostSocket.data?.isHost) hostSocket.emit('host-chat-state', chatPayloadForHost());
  }
}

function addChatMessage(message) {
  chatMessages.push(message);
  trimChatHistory();
}


// Separates Antwortsystem.
// Antworten sind KEINE Chatnachrichten. Pro Team (oder unzugeordnetem Spieler)
// kann genau eine Antwort eingeloggt werden. Danach ist sie bis zum Host-Reset gesperrt.
let answerSubmissions = new Map();
let answersRevealed = false;

function answerKeyForPlayer(player) {
  if (!player) return '';
  if (player.teamId && getTeam(player.teamId)) return `team:${player.teamId}`;
  return `player:${player.id}`;
}

function answerLabelForPlayer(player) {
  if (!player) return '';
  const team = player.teamId ? getTeam(player.teamId) : null;
  return team ? `Team · ${team.name}` : `Spieler · ${player.name}`;
}

function answerColorForPlayer(player) {
  if (!player) return '#777';
  const team = player.teamId ? getTeam(player.teamId) : null;
  return team?.color || '#777';
}

function answerPayloadForPlayer(player) {
  const key = answerKeyForPlayer(player);
  const item = key ? answerSubmissions.get(key) : null;
  return {
    key,
    label: answerLabelForPlayer(player),
    submitted: Boolean(item),
    revealed: answersRevealed
  };
}

function answerRosterForHost() {
  const entries = [];
  const activeTeamIds = new Set();

  for (const player of connectedPlayers.values()) {
    if (player.teamId && getTeam(player.teamId)) activeTeamIds.add(player.teamId);
  }

  // Teams mit aktuell verbundenen Spielern oder bereits abgegebener Antwort.
  for (const team of teams) {
    const key = `team:${team.id}`;
    const item = answerSubmissions.get(key);
    if (!activeTeamIds.has(team.id) && !item) continue;
    entries.push({
      key,
      type: 'team',
      id: team.id,
      label: `Team · ${team.name}`,
      color: team.color || '#777',
      submitted: Boolean(item),
      submittedBy: item?.submittedBy || '',
      submittedAt: item?.submittedAt || null,
      answer: answersRevealed && item ? item.answer : null
    });
  }

  // Spieler ohne Team bekommen einen eigenen Antwortplatz.
  for (const player of connectedPlayers.values()) {
    if (player.teamId && getTeam(player.teamId)) continue;
    const key = `player:${player.id}`;
    const item = answerSubmissions.get(key);
    entries.push({
      key,
      type: 'player',
      id: player.id,
      label: `Spieler · ${player.name}`,
      color: '#777',
      submitted: Boolean(item),
      submittedBy: item?.submittedBy || '',
      submittedAt: item?.submittedAt || null,
      answer: answersRevealed && item ? item.answer : null
    });
  }

  // Bereits abgegebene Einzelantworten nach Disconnect sichtbar halten.
  for (const [key, item] of answerSubmissions.entries()) {
    if (!key.startsWith('player:')) continue;
    if (entries.some(e => e.key === key)) continue;
    entries.push({
      key,
      type: 'player',
      id: item.playerId || '',
      label: item.label || `Spieler · ${item.submittedBy || 'Unbekannt'}`,
      color: item.color || '#777',
      submitted: true,
      submittedBy: item.submittedBy || '',
      submittedAt: item.submittedAt || null,
      answer: answersRevealed ? item.answer : null
    });
  }

  return {
    revealed: answersRevealed,
    submittedCount: entries.filter(e => e.submitted).length,
    totalCount: entries.length,
    entries
  };
}

function emitAnswerStateToPlayer(socketId) {
  const player = connectedPlayers.get(socketId);
  if (player) io.to(socketId).emit('player-answer-state', answerPayloadForPlayer(player));
}

function emitAnswerStateToHostSocket(socket) {
  if (socket?.data?.isHost) socket.emit('host-answer-state', answerRosterForHost());
}

function broadcastAnswerStates() {
  for (const player of connectedPlayers.values()) {
    emitAnswerStateToPlayer(player.id);
  }
  for (const [, hostSocket] of io.sockets.sockets) {
    if (hostSocket.data?.isHost) emitAnswerStateToHostSocket(hostSocket);
  }
}


// ======================================================
// BUG-REPORT-SYSTEM
// Spieler können Bugs melden. Reports werden serverseitig gespeichert und
// live an alle angemeldeten Hosts übertragen. Optional kann zusätzlich eine
// E-Mail über SMTP versendet werden (siehe README_SETUP.md).
// ======================================================
const BUG_REPORT_FILE = path.join(__dirname, 'bug-reports.json');
let bugReports = [];

function loadBugReports() {
  try {
    if (!fs.existsSync(BUG_REPORT_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(BUG_REPORT_FILE, 'utf8'));
    bugReports = Array.isArray(parsed?.reports) ? parsed.reports.slice(-500) : [];
  } catch (err) {
    console.warn('Bug-Reports konnten nicht geladen werden:', err.message);
  }
}

function saveBugReports() {
  try {
    fs.writeFileSync(BUG_REPORT_FILE, JSON.stringify({ version: 1, reports: bugReports }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Bug-Reports konnten nicht gespeichert werden:', err.message);
  }
}

function bugReportPayload() {
  return { reports: bugReports.slice().sort((a,b) => b.createdAt - a.createdAt) };
}

function broadcastBugReports() {
  for (const [, hostSocket] of io.sockets.sockets) {
    if (hostSocket.data?.isHost) hostSocket.emit('host-bug-reports', bugReportPayload());
  }
}

async function maybeEmailBugReport(report) {
  const to = String(process.env.BUG_EMAIL_TO || '').trim();
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!to || !host || !user || !pass || !nodemailer) return;

  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const subject = `[Musiklex Buzzer] Bug von ${report.playerName}`;
    const text = [
      `Spieler: ${report.playerName}`,
      `Team: ${report.teamName || '-'}`,
      `Zeit: ${new Date(report.createdAt).toLocaleString('de-DE')}`,
      `Bereich: ${report.area || '-'}`,
      '',
      report.message,
      '',
      `Browser: ${report.userAgent || '-'}`
    ].join('\n');
    await transporter.sendMail({
      from: String(process.env.SMTP_FROM || user),
      to,
      subject,
      text
    });
  } catch (err) {
    console.warn('Bug-Report-E-Mail konnte nicht gesendet werden:', err.message);
  }
}

loadBugReports();

function cleanName(value, fallback = '') {
  const result = String(value || '').trim().slice(0, 30);
  return result || fallback;
}

loadTeamState();

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
    globalBuzzerLocked,
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
    buzzerTexts,
    teams: publicTeams,
    players
  };
}

function broadcastState() {
  io.emit('state', publicState());
  broadcastAnswerStates();
}

function cleanMessage(value) {
  return String(value || '').trim().slice(0, 500);
}

io.on('connection', (socket) => {
  socket.data.isHost = false;
  socket.use(([event], next) => {
    if (String(event || '').startsWith('host-') && event !== 'host-login' && !socket.data.isHost) {
      socket.emit('host-auth-required');
      return next(new Error('HOST_UNAUTHORIZED'));
    }
    next();
  });

  socket.on('host-login', (password) => {
    const supplied = Buffer.from(passwordHash(password), 'utf8');
    const expected = Buffer.from(HOST_PASSWORD_HASH, 'utf8');
    const ok = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    socket.data.isHost = ok;
    socket.emit('host-auth-result', { ok });
    if (ok) socket.emit('host-bug-reports', bugReportPayload());
    if (ok) {
      emitChatStateToHostSocket(socket);
      emitAnswerStateToHostSocket(socket);
    }
  });

  socket.emit('state', publicState());

  socket.on('join-player', (name) => {
    const nameClean = cleanName(name);
    if (!nameClean) return;

    const existing = connectedPlayers.get(socket.id);
    connectedPlayers.set(socket.id, {
      id: socket.id,
      name: nameClean,
      score: existing?.score ?? 0,
      teamId: existing?.teamId ?? (getTeam(savedPlayerTeamsByName[nameClean] || '') ? savedPlayerTeamsByName[nameClean] : ''),
      lockedUntil: existing?.lockedUntil ?? 0,
      buzzerLocked: existing?.buzzerLocked ?? false,
      avatar: existing?.avatar ?? '',
      tribuneVisible: existing?.tribuneVisible ?? true
    });
    saveTeamState();
    broadcastState();
    emitChatStateToPlayer(socket.id);
    emitAnswerStateToPlayer(socket.id);
  });

  socket.on('buzz', () => {
    const player = connectedPlayers.get(socket.id);
    if (globalBuzzerLocked) {
      socket.emit('buzz-disabled', { reason: 'global' });
      return;
    }
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
    globalBuzzerLocked = false;
    answerTimerStartedAt = null;
    answerTimerBuzzSocketId = '';
    broadcastState();
  });

  socket.on('host-close', () => {
    roundOpen = false;
    globalBuzzerLocked = true;
    broadcastState();
  });

  socket.on('host-reset', () => {
    roundOpen = false;
    roundStart = null;
    globalBuzzerLocked = false;
    buzzes = [];
    earlyBuzzes = [];
    answerTimerStartedAt = null;
    answerTimerBuzzSocketId = '';
    for (const player of connectedPlayers.values()) {
      player.lockedUntil = 0;
      player.buzzerLocked = false;
    }
    for (const team of teams.values()) team.buzzerLocked = false;
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

  socket.on('host-restore-team-state', (snapshot) => {
    const restored = sanitizeTeamSnapshot(snapshot?.teams);
    if (!restored.length) return;
    teams = restored;
    recalcNextTeamId();
    if (snapshot?.playerTeamsByName && typeof snapshot.playerTeamsByName === 'object') {
      savedPlayerTeamsByName = {};
      for (const [name, teamId] of Object.entries(snapshot.playerTeamsByName)) {
        const cleanPlayerName = cleanName(name);
        const cleanTeamId = String(teamId || '');
        if (cleanPlayerName) savedPlayerTeamsByName[cleanPlayerName] = getTeam(cleanTeamId) ? cleanTeamId : '';
      }
    }
    for (const player of connectedPlayers.values()) {
      const desired = savedPlayerTeamsByName[player.name] || '';
      player.teamId = getTeam(desired) ? desired : '';
    }
    saveTeamState();
    broadcastState();
    broadcastChatStates();
  });

  socket.on('host-set-player-team', ({ id, teamId }) => {
    const player = connectedPlayers.get(String(id || ''));
    const nextTeamId = String(teamId || '');
    if (!player) return;
    if (nextTeamId && !getTeam(nextTeamId)) return;

    player.teamId = nextTeamId;
    savedPlayerTeamsByName[player.name] = nextTeamId;
    saveTeamState();
    buzzes.forEach((buzz) => {
      if (buzz.socketId === player.id) buzz.teamId = nextTeamId;
    });
    earlyBuzzes.forEach((buzz) => {
      if (buzz.socketId === player.id) buzz.teamId = nextTeamId;
    });
    broadcastState();
    emitChatStateToPlayer(player.id);
  });

  socket.on('host-add-team', (name) => {
    if (teams.length >= 12) return;
    const id = `team-${nextTeamId++}`;
    teams.push({ id, name: cleanName(name, `Team ${teams.length + 1}`), score: 0, color: '#8b5cf6', buzzerLocked: false });
    saveTeamState();
    broadcastState();
  });

  socket.on('host-rename-team', ({ id, name }) => {
    const team = getTeam(String(id || ''));
    if (!team) return;
    team.name = cleanName(name, team.name);
    saveTeamState();
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
    chatMessages = chatMessages.filter(m => !(m.scope === 'team' && m.teamId === teamId));
    for (const [name, assigned] of Object.entries(savedPlayerTeamsByName)) if (assigned === teamId) savedPlayerTeamsByName[name] = '';
    saveTeamState();
    broadcastState();
    broadcastChatStates();
  });


  socket.on('host-set-team-color', ({ id, color }) => {
    const team = getTeam(String(id || ''));
    const clean = String(color || '').trim();
    if (!team || !/^#[0-9a-fA-F]{6}$/.test(clean)) return;
    team.color = clean;
    saveTeamState();
    broadcastState();
  });

  socket.on('host-move-team', ({ id, direction }) => {
    const index = teams.findIndex(t => t.id === String(id || ''));
    if (index < 0) return;
    const target = index + (Number(direction) < 0 ? -1 : 1);
    if (target < 0 || target >= teams.length) return;
    [teams[index], teams[target]] = [teams[target], teams[index]];
    saveTeamState();
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
      saveTeamState();
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
    saveTeamState();
    broadcastState();
  });

  socket.on('player-chat-send', ({ channel, message }) => {
    const player = connectedPlayers.get(socket.id);
    const text = cleanMessage(message);
    if (!player || !text) return;

    const mode = String(channel || 'host');
    if (mode === 'host') {
      if (!chatSettings.privateEnabled) {
        socket.emit('chat-send-error', { message: 'Der Privatchat ist derzeit gesperrt.' });
        return;
      }
      const item = {
        id: chatMessageId(), scope: 'private', playerId: player.id,
        senderType: 'player', senderId: player.id, senderName: player.name,
        message: text, sentAt: Date.now()
      };
      addChatMessage(item);
      socket.emit('chat-message-sent', item);
      emitChatStateToPlayer(player.id);
      for (const [, hostSocket] of io.sockets.sockets) {
        if (hostSocket.data?.isHost) {
          hostSocket.emit('chat-new-message', item);
          hostSocket.emit('host-chat-state', chatPayloadForHost());
        }
      }
      return;
    }

    if (mode === 'team') {
      if (!chatSettings.teamEnabled) {
        socket.emit('chat-send-error', { message: 'Der Teamchat ist derzeit gesperrt.' });
        return;
      }
      if (!player.teamId || !getTeam(player.teamId)) {
        socket.emit('chat-send-error', { message: 'Du bist keinem Team zugeordnet.' });
        return;
      }
      const item = {
        id: chatMessageId(), scope: 'team', teamId: player.teamId,
        senderType: 'player', senderId: player.id, senderName: player.name,
        message: text, sentAt: Date.now()
      };
      addChatMessage(item);
      for (const teammate of connectedPlayers.values()) {
        if (teammate.teamId === player.teamId) {
          io.to(teammate.id).emit('chat-new-message', item);
          emitChatStateToPlayer(teammate.id);
        }
      }
      for (const [, hostSocket] of io.sockets.sockets) {
        if (hostSocket.data?.isHost) {
          hostSocket.emit('chat-new-message', item);
          hostSocket.emit('host-chat-state', chatPayloadForHost());
        }
      }
    }
  });

  socket.on('host-chat-send', ({ channelType, targetId, message }) => {
    const text = cleanMessage(message);
    if (!text) return;
    const type = String(channelType || 'private');
    const id = String(targetId || '');

    if (type === 'private') {
      const player = connectedPlayers.get(id);
      if (!player) return;
      const item = {
        id: chatMessageId(), scope: 'private', playerId: player.id,
        senderType: 'host', senderId: 'host', senderName: 'Host',
        message: text, sentAt: Date.now()
      };
      addChatMessage(item);
      io.to(player.id).emit('chat-new-message', item);
      emitChatStateToPlayer(player.id);
      socket.emit('chat-new-message', item);
      emitChatStateToHostSocket(socket);
      return;
    }

    if (type === 'team') {
      const team = getTeam(id);
      if (!team) return;
      const item = {
        id: chatMessageId(), scope: 'team', teamId: team.id,
        senderType: 'host', senderId: 'host', senderName: 'Host',
        message: text, sentAt: Date.now()
      };
      addChatMessage(item);
      for (const player of connectedPlayers.values()) {
        if (player.teamId === team.id) {
          io.to(player.id).emit('chat-new-message', item);
          emitChatStateToPlayer(player.id);
        }
      }
      socket.emit('chat-new-message', item);
      emitChatStateToHostSocket(socket);
    }
  });

  socket.on('host-chat-settings', ({ privateEnabled, teamEnabled }) => {
    chatSettings.privateEnabled = Boolean(privateEnabled);
    chatSettings.teamEnabled = Boolean(teamEnabled);
    broadcastChatStates();
  });

  socket.on('host-chat-clear', ({ channelType, targetId }) => {
    const type = String(channelType || 'private');
    const id = String(targetId || '');
    if (type === 'private') chatMessages = chatMessages.filter(m => !(m.scope === 'private' && m.playerId === id));
    if (type === 'team') chatMessages = chatMessages.filter(m => !(m.scope === 'team' && m.teamId === id));
    broadcastChatStates();
  });



  socket.on('player-bug-report', ({ area, message, userAgent }) => {
    const player = connectedPlayers.get(socket.id);
    const text = cleanMessage(message);
    if (!player || !text) return;
    const team = player.teamId ? getTeam(player.teamId) : null;
    const report = {
      id: `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId || '',
      teamName: team?.name || '',
      area: String(area || '').trim().slice(0, 80),
      message: text.slice(0, 1500),
      userAgent: String(userAgent || '').slice(0, 500),
      createdAt: Date.now(),
      resolved: false
    };
    bugReports.push(report);
    if (bugReports.length > 500) bugReports = bugReports.slice(-500);
    saveBugReports();
    broadcastBugReports();
    socket.emit('bug-report-submitted', { ok: true });
    void maybeEmailBugReport(report);
  });

  socket.on('host-bug-report-resolve', ({ id, resolved }) => {
    const report = bugReports.find(r => r.id === String(id || ''));
    if (!report) return;
    report.resolved = Boolean(resolved);
    saveBugReports();
    broadcastBugReports();
  });

  socket.on('host-bug-report-delete', ({ id }) => {
    const before = bugReports.length;
    bugReports = bugReports.filter(r => r.id !== String(id || ''));
    if (bugReports.length === before) return;
    saveBugReports();
    broadcastBugReports();
  });

  socket.on('player-answer-submit', ({ answer }) => {
    const player = connectedPlayers.get(socket.id);
    const text = cleanMessage(answer);
    if (!player || !text) return;

    if (answersRevealed) {
      socket.emit('answer-submit-error', { message: 'Die Antworten wurden bereits aufgedeckt. Der Host muss sie zuerst zurücksetzen.' });
      return;
    }

    const key = answerKeyForPlayer(player);
    if (!key) return;

    if (answerSubmissions.has(key)) {
      socket.emit('answer-submit-error', { message: 'Für dein Team wurde bereits eine Antwort eingeloggt.' });
      emitAnswerStateToPlayer(socket.id);
      return;
    }

    answerSubmissions.set(key, {
      key,
      answer: text,
      submittedAt: Date.now(),
      submittedBy: player.name,
      playerId: player.id,
      teamId: player.teamId || '',
      label: answerLabelForPlayer(player),
      color: answerColorForPlayer(player)
    });

    broadcastAnswerStates();
  });

  socket.on('host-answers-reveal', () => {
    if (!answerSubmissions.size) return;
    answersRevealed = true;
    broadcastAnswerStates();
  });

  socket.on('host-answers-reset', () => {
    answerSubmissions.clear();
    answersRevealed = false;
    broadcastAnswerStates();
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

  socket.on('host-restart-answer-timer', () => {
    if (!answerTimerEnabled) return;
    // Gleiche antwortende Person bekommt die volle eingestellte Zeit erneut.
    if (!answerTimerBuzzSocketId && buzzes.length) answerTimerBuzzSocketId = buzzes[0].socketId;
    if (!answerTimerBuzzSocketId) return;
    answerTimerStartedAt = Date.now();
    broadcastState();
  });

  socket.on('host-next-answer-timer', () => {
    if (!answerTimerEnabled || !buzzes.length) return;
    const currentIndex = buzzes.findIndex((b) => b.socketId === answerTimerBuzzSocketId);
    const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
    if (nextIndex >= buzzes.length) {
      // Niemand mehr in der Buzz-Reihenfolge: Timer beenden, statt wieder bei #1 anzufangen.
      answerTimerStartedAt = null;
      answerTimerBuzzSocketId = '';
    } else {
      answerTimerBuzzSocketId = buzzes[nextIndex].socketId;
      answerTimerStartedAt = Date.now();
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
    const allowed = new Set(['correct','wrong','nextQuestion','nextMainRound','countdown5','timeup','buzzer']);
    const name = String(sound || '');
    if (!allowed.has(name)) return;
    if (share) io.emit('soundboard-play', { sound: name });
    else socket.emit('soundboard-play', { sound: name });
  });

  socket.on('host-set-buzzer-texts', (payload) => {
    const next = payload && typeof payload === 'object' ? payload : {};
    buzzerTexts = {
      active: sanitizeBuzzerText(next.active, 'AKTIV'),
      inactive: sanitizeBuzzerText(next.inactive, 'INAKTIV'),
      locked: sanitizeBuzzerText(next.locked, 'LOCKED')
    };
    saveBuzzerTextState();
    broadcastState();
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

  socket.on('host-kick-player', ({ id }) => {
    const playerId = String(id || '');
    const player = connectedPlayers.get(playerId);
    if (!player) return;

    connectedPlayers.delete(playerId);
    buzzes = buzzes.filter((buzz) => buzz.socketId !== playerId);
    earlyBuzzes = earlyBuzzes.filter((buzz) => buzz.socketId !== playerId);
    if (answerTimerBuzzSocketId === playerId) {
      answerTimerBuzzSocketId = '';
      answerTimerStartedAt = null;
    }
    io.to(playerId).emit('kicked');
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
