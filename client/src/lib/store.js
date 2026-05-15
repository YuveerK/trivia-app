import { create } from 'zustand';

const STORAGE_KEY = 'trivia_tournament_session';

function readPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistSession(code, me) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code, me }));
}

export function clearPersistedSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getPersistedSession() {
  return readPersisted();
}

export const useGameStore = create((set) => ({
  session: null,
  me: null,
  selectedAnswer: null,
  error: null,

  setSession: (session) => set({ session }),

  setMe: (me) => set({ me }),

  setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),

  setError: (error) => set({ error }),

  reset: () => {
    clearPersistedSession();
    set({
      session: null,
      me: null,
      selectedAnswer: null,
      error: null,
    });
  },
}));
