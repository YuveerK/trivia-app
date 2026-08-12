import { io } from 'socket.io-client';

const defaultServerUrl =
  typeof window === 'undefined'
    ? 'http://localhost:3001'
    : `${window.location.protocol}//${window.location.hostname}:3001`;

const URL = import.meta.env.VITE_SERVER_URL || defaultServerUrl;
const CLIENT_ID_KEY = 'trivia_client_id';
let memoryClientId = null;

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getClientId() {
  if (memoryClientId) return memoryClientId;
  try {
    const stored = globalThis.sessionStorage?.getItem(CLIENT_ID_KEY);
    if (stored) {
      memoryClientId = stored;
      return stored;
    }
    memoryClientId = randomId();
    globalThis.sessionStorage?.setItem(CLIENT_ID_KEY, memoryClientId);
  } catch {
    memoryClientId = randomId();
  }
  return memoryClientId;
}

export class SocketRequestError extends Error {
  constructor(message, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'SocketRequestError';
    this.code = code;
  }
}

export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5_000,
  randomizationFactor: 0.5,
});

export async function emitWithAck(event, payload = {}, options = {}) {
  const { timeout = 6_000, attempts = 2, requestId = randomId() } = options;
  if (!socket.connected) throw new SocketRequestError('You are offline. Reconnecting…', 'OFFLINE');

  const message = { ...payload, clientId: getClientId(), requestId };
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!socket.connected) throw new SocketRequestError('Connection was lost. Reconnecting…', 'OFFLINE');
    try {
      const response = await new Promise((resolve, reject) => {
        socket.timeout(timeout).emit(event, message, (error, result) => {
          if (error) reject(new SocketRequestError('The server did not respond in time.', 'TIMEOUT'));
          else resolve(result);
        });
      });
      if (!response?.ok) throw new SocketRequestError(response?.error ?? 'Request failed.');
      return response;
    } catch (error) {
      lastError = error;
      if (error?.code !== 'TIMEOUT' || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}
