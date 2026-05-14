import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { SessionManager, serializeSession } from './sessionManager.js';
import { allPlayersAnswered } from './gameLogic.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: '512kb' }));

const allowedOrigins = new Set([
  ...CLIENT_URLS,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

function allowOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.has(origin)) {
    callback(null, true);
    return;
  }

  try {
    const url = new URL(origin);
    if (url.protocol === 'http:' && ['4173', '5173'].includes(url.port)) {
      callback(null, true);
      return;
    }
  } catch {
    // Fall through to the CORS rejection below.
  }

  callback(new Error(`Origin ${origin} is not allowed by CORS.`));
}

app.use(
  cors({
    origin: allowOrigin,
    credentials: true,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowOrigin,
    credentials: true,
  },
});

const sessions = new SessionManager();
sessions.onAfterPlayerChange = (code, out) => {
  if (out.ended) {
    io.to(code).emit('session:ended', { reason: out.reason ?? 'Session ended.' });
    return;
  }
  if (out.session) broadcastSession(code);
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.getActiveCount() });
});

function broadcastSession(code) {
  const session = sessions.getSession(code);
  if (!session) return;
  io.to(code).emit('session:update', { session: serializeSession(session) });
}

function endSession(code, reason) {
  io.to(code).emit('session:ended', { reason });
  sessions.cleanupSession(code, reason);
}

function goToResults(code) {
  const session = sessions.getSession(code);
  if (!session || session.phase !== 'question') return;
  sessions.transitionToResults(session);
  broadcastSession(code);
}

function onRoundTimeout(code) {
  goToResults(code);
}

io.on('connection', (socket) => {
  socket.on('host:create', (payload) => {
    const name = payload?.name;
    if (!name || !String(name).trim()) {
      socket.emit('error', { message: 'Name is required.' });
      return;
    }
    const hostParticipates = payload?.hostParticipates !== false;
    const result = sessions.createSession(
      String(name).trim(),
      socket.id,
      payload?.questions,
      hostParticipates,
    );
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }
    const { session } = result;
    socket.join(session.code);
    socket.emit('session:created', {
      session: serializeSession(session),
      you: {
        id: socket.id,
        name: session.hostName,
        isHost: true,
        isPlayer: hostParticipates,
      },
    });
  });

  socket.on('player:join', (payload) => {
    const code = String(payload?.code ?? '')
      .toUpperCase()
      .trim();
    const name = payload?.name;
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      socket.emit('error', { message: 'Enter a valid 4-character code.' });
      return;
    }
    if (!name || !String(name).trim()) {
      socket.emit('error', { message: 'Name is required.' });
      return;
    }
    const result = sessions.addPlayer(code, socket.id, String(name).trim());
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }
    const session = result.session;
    socket.join(session.code);
    const me = session.players.find((p) => p.id === socket.id);
    socket.emit('session:joined', {
      session: serializeSession(session),
      you: { id: socket.id, name: me?.name ?? '', isHost: false, isPlayer: true },
    });
    broadcastSession(code);
  });

  socket.on('host:start', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) {
      socket.emit('error', { message: 'Session not found.' });
      return;
    }
    if (session.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game.' });
      return;
    }
    const started = sessions.startGame(session, () => onRoundTimeout(code));
    if (!started.ok) {
      socket.emit('error', { message: started.error });
      return;
    }
    broadcastSession(code);
  });

  socket.on('host:showResults', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) {
      socket.emit('error', { message: 'Session not found.' });
      return;
    }
    if (session.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can show results.' });
      return;
    }
    if (session.phase !== 'question') {
      socket.emit('error', { message: 'Not in question phase.' });
      return;
    }
    goToResults(code);
  });

  socket.on('host:nextRound', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) {
      socket.emit('error', { message: 'Session not found.' });
      return;
    }
    if (session.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can advance rounds.' });
      return;
    }
    const next = sessions.nextRound(session, () => onRoundTimeout(code));
    if (!next.ok) {
      socket.emit('error', { message: next.error });
      return;
    }
    broadcastSession(code);
  });

  socket.on('player:answer', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) {
      socket.emit('error', { message: 'Session not found.' });
      return;
    }
    const roundIndex = payload?.roundIndex;
    const optionIndex = payload?.optionIndex;
    if (typeof roundIndex !== 'number' || typeof optionIndex !== 'number') {
      socket.emit('error', { message: 'Invalid answer payload.' });
      return;
    }
    const result = sessions.recordAnswer(session, socket.id, roundIndex, optionIndex);
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.emit('answer:recorded', {
      correct: result.correct,
      points: result.points,
      timeLeft: result.timeLeft,
    });
    broadcastSession(code);
    if (allPlayersAnswered(session)) {
      goToResults(code);
    }
  });

  socket.on('host:end', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) {
      socket.emit('error', { message: 'Session not found.' });
      return;
    }
    if (session.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can end the session.' });
      return;
    }
    endSession(code, 'The host ended the session.');
  });

  socket.on('player:leave', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const session = sessions.getSession(code);
    if (!session) return;
    const out = sessions.removePlayer(code, socket.id);
    socket.leave(code);
    if (out.ended) {
      io.to(code).emit('session:ended', { reason: out.reason ?? 'Session ended.' });
      return;
    }
    if (out.session) broadcastSession(code);
  });

  socket.on('player:reconnect', (payload) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const playerId = payload?.playerId;
    if (!code || !playerId) {
      socket.emit('error', { message: 'Invalid reconnect payload.' });
      return;
    }
    const result = sessions.markReconnected(code, playerId, socket.id, (s) => {
      sessions.resumeRoundTimer(s, () => onRoundTimeout(code));
    });
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }
    const session = result.session;
    socket.join(session.code);
    broadcastSession(code);
  });

  socket.on('disconnect', () => {
    const hit = sessions.markDisconnected(socket.id, (code, { reason }) => {
      endSession(code, reason);
    });
    if (hit) {
      broadcastSession(hit.code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
