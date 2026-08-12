import { create } from 'zustand';

const STORAGE_KEY = 'trivia_tournament_session';
const PENDING_LEAVE_KEY = 'trivia_pending_leave';

function readPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistSession(code, me) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code, me }));
  } catch {
    // The live in-memory store still works when browser storage is restricted.
  }
}

export function clearPersistedSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function getPersistedSession() {
  return readPersisted();
}

export function queuePendingLeave(code, me) {
  if (code && me?.id && me?.reconnectToken) {
    try {
      sessionStorage.setItem(PENDING_LEAVE_KEY, JSON.stringify({ code, me }));
    } catch {
      // Best effort only; disconnect cleanup remains the server-side fallback.
    }
  }
}

export function getPendingLeave() {
  try {
    const raw = sessionStorage.getItem(PENDING_LEAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingLeave() {
  try {
    sessionStorage.removeItem(PENDING_LEAVE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function applySessionDelta(session, delta) {
  if (!session || session.code !== delta?.code) return { session, needsSync: true };
  if (delta.version <= session.version) return { session, needsSync: false };
  if (delta.version !== session.version + 1) return { session, needsSync: true };

  let players = session.players;
  if (delta.type === 'player:upsert') {
    const player = delta.payload?.player;
    if (!player) return { session, needsSync: true };
    const index = players.findIndex((item) => item.id === player.id);
    players = index < 0
      ? [...players, player]
      : players.map((item) => (item.id === player.id ? player : item));
  } else if (delta.type === 'player:remove') {
    players = players.filter((item) => item.id !== delta.payload?.playerId);
  } else {
    return { session, needsSync: true };
  }

  return {
    needsSync: false,
    session: { ...session, players, version: delta.version },
  };
}

export const useGameStore = create((set) => ({
  session: null,
  me: null,
  selectedAnswer: null,
  connectionStatus: 'connecting',

  setSession: (session) => set({ session }),
  setMe: (me) => set({ me }),
  setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  reset: () => {
    clearPersistedSession();
    set({ session: null, me: null, selectedAnswer: null });
  },
}));
