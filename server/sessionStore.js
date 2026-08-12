/**
 * Synchronous in-memory session storage.
 *
 * SessionManager only depends on this small interface, so a Redis/Valkey-backed
 * implementation can replace it later without changing the game protocol.
 */
export class MemorySessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(code) {
    return this.sessions.get(code);
  }

  set(code, session) {
    this.sessions.set(code, session);
  }

  delete(code) {
    return this.sessions.delete(code);
  }

  has(code) {
    return this.sessions.has(code);
  }

  entries() {
    return this.sessions.entries();
  }

  get size() {
    return this.sessions.size;
  }
}
