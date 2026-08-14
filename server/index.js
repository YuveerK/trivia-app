import 'dotenv/config';
import http from 'http';
import { pathToFileURL } from 'url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { SessionManager, serializePlayer, serializeSession } from './sessionManager.js';
import { allPlayersAnswered } from './gameLogic.js';

const DEFAULT_PORT = Number(process.env.PORT) || 3001;
const MAX_SOCKET_MESSAGE_BYTES = 512 * 1024;
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...CLIENT_URLS,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Vite picks the next free port when 5173 is taken, which would otherwise turn a
// busy port into an opaque CORS failure. Production keeps the strict allowlist.
function isLocalDevOrigin(origin) {
  if (IS_PRODUCTION) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function allowOrigin(origin, callback) {
  if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed by CORS.'));
}

function requestKey(event, payload) {
  const clientId = typeof payload?.clientId === 'string' ? payload.clientId : '';
  const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
  if (!clientId || !requestId || clientId.length > 100 || requestId.length > 100) return null;
  return `${clientId}:${event}:${requestId}`;
}

function allowEvent(socket, event) {
    const buckets = socket.data.rateBuckets ?? (socket.data.rateBuckets = new Map());
    const now = Date.now();
    const limit = event === 'player:answer' ? 12 : event === 'session:sync' ? 15 : 8;
    const bucket = buckets.get(event);
    if (!bucket || now - bucket.startedAt >= 10_000) {
      buckets.set(event, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
}

export function createTriviaServer({ sessions = new SessionManager() } = {}) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use(cors({ origin: allowOrigin, credentials: true }));

  const server = http.createServer(app);
  const connectionBuckets = new Map();
  const configuredMaxConnections = Number(process.env.MAX_CONNECTIONS);
  const maxConnections = Number.isSafeInteger(configuredMaxConnections) && configuredMaxConnections > 0
    ? configuredMaxConnections
    : 5_000;
  let io;
  io = new Server(server, {
    cors: { origin: allowOrigin, credentials: true },
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    allowRequest: (request, callback) => {
      if ((io?.engine?.clientsCount ?? 0) >= maxConnections) {
        callback('Server connection capacity reached.', false);
        return;
      }
      const trustProxy = process.env.TRUST_PROXY === 'true';
      const forwarded = request.headers['x-forwarded-for'];
      const address = trustProxy && forwarded
        ? String(forwarded).split(',')[0].trim()
        : request.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      const bucket = connectionBuckets.get(address);
      if (!bucket || now - bucket.startedAt >= 60_000) {
        connectionBuckets.set(address, { startedAt: now, count: 1 });
        if (connectionBuckets.size > 10_000) {
          for (const [key, item] of connectionBuckets) {
            if (now - item.startedAt >= 60_000) connectionBuckets.delete(key);
          }
        }
        callback(null, true);
        return;
      }
      bucket.count += 1;
      callback(bucket.count > 300 ? 'Too many connection attempts.' : null, bucket.count <= 300);
    },
  });
  const inFlightRequests = new Map();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      activeSessions: sessions.getActiveCount(),
      connectedSockets: io.engine.clientsCount,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  function snapshot(code, target = io.to(code)) {
    const session = sessions.getSession(code);
    if (!session) return;
    target.emit('session:snapshot', { session: serializeSession(session) });
  }

  function delta(session, type, payload, target = io.to(session.code)) {
    target.emit('session:delta', {
      code: session.code,
      version: session.version,
      type,
      payload,
    });
  }

  function endSession(code, reason) {
    io.to(code).emit('session:ended', { reason });
    const socketIds = [...(io.sockets.adapter.rooms.get(code) ?? [])];
    for (const socketId of socketIds) {
      const memberSocket = io.sockets.sockets.get(socketId);
      if (!memberSocket) continue;
      if (memberSocket.data.membership?.code === code) memberSocket.data.membership = null;
      memberSocket.leave(code);
    }
    sessions.cleanupSession(code);
  }

  function goToResults(code) {
    const session = sessions.getSession(code);
    if (!session || !sessions.transitionToResults(session).ok) return;
    snapshot(code);
  }

  function onRoundTimeout(code) {
    goToResults(code);
  }

  function notifyPlayerChange(code, output) {
    if (!output) return;
    if (output.ended) return endSession(code, output.reason ?? 'Session ended.');
    if (!output.session) return;
    // A host who participated may have been the only unanswered player. Once
    // they are reaped, finish the round immediately instead of restarting the
    // clock and making everyone else wait through the remaining duration.
    if (allPlayersAnswered(output.session)) return goToResults(code);
    if (output.hostChanged) return snapshot(code);
    if (output.removed) {
      delta(output.session, 'player:remove', { playerId: output.player?.id });
    } else if (output.player) {
      delta(output.session, 'player:upsert', { player: serializePlayer(output.session, output.player) });
    }
  }

  sessions.onAfterPlayerChange = notifyPlayerChange;
  sessions.onSessionExpired = (code, reason) => endSession(code, reason);

  async function detachMembership(socket) {
    const membership = socket.data.membership;
    if (!membership) return;
    socket.data.membership = null;
    const output = sessions.removeParticipant(membership.code, membership.playerId, socket.id);
    await socket.leave(membership.code);
    notifyPlayerChange(membership.code, output);
  }

  async function attachMembership(socket, session, playerId, reconnectToken) {
    if (
      socket.data.membership &&
      (socket.data.membership.code !== session.code || socket.data.membership.playerId !== playerId)
    ) {
      await detachMembership(socket);
    }
    socket.data.membership = { code: session.code, playerId, reconnectToken };
    await socket.join(session.code);
  }

  function supersedePreviousSocket(previousSocketId, currentSocketId) {
    if (!previousSocketId || previousSocketId === currentSocketId) return;
    const previous = io.sockets.sockets.get(previousSocketId);
    if (!previous) return;
    previous.emit('session:superseded', { message: 'This player reconnected from another tab or device.' });
    previous.disconnect(true);
  }

  async function restoreRequestMembership(socket, result) {
    if (!result?.ok || !result.you?.reconnectToken || !result.session?.code) return result;
    if (
      socket.data.membership &&
      (socket.data.membership.code !== result.session.code || socket.data.membership.playerId !== result.you.id)
    ) {
      return { ok: false, error: 'This retry belongs to an older session.' };
    }
    const restored = sessions.markReconnected(
      result.session.code,
      result.you.id,
      result.you.reconnectToken,
      socket.id,
    );
    if (!restored.ok) return restored;

    await attachMembership(socket, restored.session, result.you.id, result.you.reconnectToken);
    supersedePreviousSocket(restored.previousSocketId, socket.id);
    if (!restored.unchanged) {
      if (restored.isHost) snapshot(restored.session.code, socket.to(restored.session.code));
      else if (restored.player) {
        delta(
          restored.session,
          'player:upsert',
          { player: serializePlayer(restored.session, restored.player) },
          socket.to(restored.session.code),
        );
      }
    }
    return { ...result, session: serializeSession(restored.session) };
  }

  function register(socket, event, handler, { cache = true } = {}) {
    socket.on(event, async (payload = {}, acknowledgement) => {
      const reply = typeof acknowledgement === 'function' ? acknowledgement : () => {};
      if (!allowEvent(socket, event)) {
        reply({ ok: false, error: 'Too many requests. Please wait a moment.' });
        return;
      }

      const processRequest = async () => {
        const key = cache ? requestKey(event, payload) : null;
        const cached = key ? sessions.getCachedRequest(key) : null;
        if (cached) {
          reply(await restoreRequestMembership(socket, cached));
          return;
        }
        if (key && inFlightRequests.has(key)) {
          const result = await inFlightRequests.get(key);
          reply(await restoreRequestMembership(socket, result));
          return;
        }
        try {
          const pending = Promise.resolve().then(() => handler(payload));
          if (key) inFlightRequests.set(key, pending);
          const result = await pending;
          if (key) sessions.cacheRequest(key, result);
          reply(result);
        } catch (error) {
          console.error(`Socket event ${event} failed`, error);
          reply({ ok: false, error: 'Unexpected server error.' });
        } finally {
          if (key) inFlightRequests.delete(key);
        }
      };

      const queued = socket.data.commandQueue.then(processRequest, processRequest);
      socket.data.commandQueue = queued.catch(() => {});
      await queued;
    });
  }

  io.on('connection', (socket) => {
    socket.data.membership = null;
    socket.data.rateBuckets = new Map();
    socket.data.commandQueue = Promise.resolve();

    register(socket, 'host:create', async (payload) => {
      const result = sessions.createSession(
        payload?.name,
        socket.id,
        payload?.questions,
        payload?.hostParticipates !== false,
      );
      if (!result.ok) return result;
      const session = result.session;
      try {
        // Only leave the current game after the replacement session has passed
        // validation and exists. A rejected create must not eject the caller.
        await detachMembership(socket);
        await attachMembership(socket, session, session.hostId, session.hostReconnectToken);
      } catch (error) {
        sessions.cleanupSession(session.code);
        throw error;
      }
      return {
        ok: true,
        session: serializeSession(session),
        you: {
          id: session.hostId,
          name: session.hostName,
          isHost: true,
          isPlayer: session.hostParticipates,
          reconnectToken: session.hostReconnectToken,
        },
      };
    });

    register(socket, 'player:join', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4}$/.test(code)) return { ok: false, error: 'Enter a valid 4-character code.' };
      if (socket.data.membership?.code === code) {
        return { ok: false, error: 'You are already in this session.' };
      }
      const result = sessions.addPlayer(code, socket.id, payload?.name);
      if (!result.ok) return result;
      const { session, player } = result;
      try {
        // Adding validates the destination first. Do not sacrifice a healthy
        // current membership for an invalid code, name, full room, or game that
        // has already started.
        await detachMembership(socket);
        await attachMembership(socket, session, player.id, player.reconnectToken);
      } catch (error) {
        const rollback = sessions.removeParticipant(session.code, player.id, socket.id);
        notifyPlayerChange(session.code, rollback);
        throw error;
      }
      delta(session, 'player:upsert', { player: serializePlayer(session, player) }, socket.to(code));
      return {
        ok: true,
        session: serializeSession(session),
        you: {
          id: player.id,
          name: player.name,
          isHost: false,
          isPlayer: true,
          reconnectToken: player.reconnectToken,
        },
      };
    });

    register(socket, 'player:reconnect', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase().trim();
      const result = sessions.markReconnected(
        code,
        payload?.playerId,
        payload?.reconnectToken,
        socket.id,
      );
      if (!result.ok) return result;
      await attachMembership(socket, result.session, payload.playerId, payload.reconnectToken);
      supersedePreviousSocket(result.previousSocketId, socket.id);
      if (!result.unchanged) {
        if (result.isHost) snapshot(code, socket.to(code));
        else if (result.player) {
          delta(
            result.session,
            'player:upsert',
            { player: serializePlayer(result.session, result.player) },
            socket.to(code),
          );
        }
      }
      return { ok: true, session: serializeSession(result.session) };
    }, { cache: false });

    register(socket, 'session:sync', async (payload) => {
      const membership = socket.data.membership;
      const code = String(payload?.code ?? '').toUpperCase();
      if (!membership || membership.code !== code) return { ok: false, error: 'Not in this session.' };
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      return { ok: true, session: serializeSession(session) };
    }, { cache: false });

    register(socket, 'host:start', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      if (session.hostSocketId !== socket.id) return { ok: false, error: 'Only the host can start.' };
      const result = sessions.startGame(session, () => onRoundTimeout(code));
      if (!result.ok) return result;
      snapshot(code);
      return { ok: true, session: serializeSession(session) };
    });

    register(socket, 'host:showResults', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      if (session.hostSocketId !== socket.id) return { ok: false, error: 'Only the host can show results.' };
      if (session.phase !== 'question') return { ok: false, error: 'Not in question phase.' };
      goToResults(code);
      return { ok: true };
    });

    register(socket, 'host:nextRound', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      if (session.hostSocketId !== socket.id) return { ok: false, error: 'Only the host can advance.' };
      const result = sessions.nextRound(session, () => onRoundTimeout(code));
      if (!result.ok) return result;
      snapshot(code);
      return { ok: true, final: result.final };
    });

    register(socket, 'player:answer', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const membership = socket.data.membership;
      if (!membership || membership.code !== code) return { ok: false, error: 'Not in this session.' };
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      const result = sessions.recordAnswer(session, socket.id, payload?.roundIndex, payload?.optionIndex);
      if (!result.ok) return result;
      delta(session, 'player:upsert', { player: serializePlayer(session, result.player) });
      const completed = allPlayersAnswered(session);
      if (completed) goToResults(code);
      return { ok: true, accepted: true };
    });

    register(socket, 'player:leave', async () => {
      const membership = socket.data.membership;
      if (!membership) return { ok: true };
      socket.data.membership = null;
      const output = sessions.removeParticipant(membership.code, membership.playerId, socket.id);
      await socket.leave(membership.code);
      notifyPlayerChange(membership.code, output);
      return { ok: true };
    });

    register(socket, 'host:end', async (payload) => {
      const code = String(payload?.code ?? '').toUpperCase();
      const session = sessions.getSession(code);
      if (!session) return { ok: false, error: 'Session not found.' };
      if (session.hostSocketId !== socket.id) return { ok: false, error: 'Only the host can end the session.' };
      endSession(code, 'The host ended the session.');
      return { ok: true };
    });

    socket.on('disconnect', () => {
      const membership = socket.data.membership;
      if (!membership) return;
      const hit = sessions.markDisconnected(membership.code, membership.playerId, socket.id);
      if (!hit) return;
      if (hit.hostDisconnected) snapshot(hit.code);
      else if (hit.player) {
        delta(hit.session, 'player:upsert', { player: serializePlayer(hit.session, hit.player) });
      }
      if (!hit.hostDisconnected && allPlayersAnswered(hit.session)) goToResults(hit.code);
    });
  });

  return {
    app,
    io,
    server,
    sessions,
    listen(port = DEFAULT_PORT) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    async close() {
      sessions.close();
      connectionBuckets.clear();
      inFlightRequests.clear();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const trivia = createTriviaServer();
  trivia.listen(DEFAULT_PORT).then(() => {
    console.log(`Server listening on http://localhost:${DEFAULT_PORT}`);
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received; closing connections.`);
    await trivia.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
