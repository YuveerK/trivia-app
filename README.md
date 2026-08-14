# Trivia Tournament

Real-time multiplayer trivia with a host-controlled flow, speed-based scoring, and a live leaderboard.

The server uses acknowledged, idempotent commands, versioned session updates, reconnect tokens,
and a maximum of 50 players per room. Duplicate display names are supported and automatically
labelled (for example, `Alex`, `Alex (2)`).

A disconnected player keeps their place in the current round, then has 30 seconds in the lobby or
60 seconds mid-game to return before they are dropped and their score is frozen on the leaderboard.
If the host does not return within 60 seconds the room is handed to a connected player. The
authoritative round timer continues while the host is absent, so disconnects cannot extend a question.

## Prerequisites

- Node.js 18+

## Setup

```bash
npm run install:all
```

## Environment

Copy examples and adjust as needed:

- **Server:** [`server/.env.example`](server/.env.example) → `server/.env`
- **Client:** [`client/.env.example`](client/.env.example) → `client/.env`

## Development

Runs the API on port **3001** and the Vite app on **5173**:

```bash
npm run dev
```

## Production build

```bash
npm run build
npm start
```

Set `CLIENT_URL` to your deployed frontend origin and `VITE_SERVER_URL` (at build time) to your API URL.

## Verification

```bash
npm test
npm run build
```

The integration suite includes simultaneous joins, duplicate names, duplicate command delivery,
disconnect recovery without prematurely ending a round, hidden live scoring, stale retry isolation,
large custom question packs, safe session transfers, spectator-hosted empty lobbies, complete room
teardown, score preservation after leaving, and immediate completion after host handoff. The unit
suite additionally covers reaping absent players, host handoff when the host does not return, and
continuous authoritative timing while the host is absent.

## Scaling

The included `MemorySessionStore` is appropriate for a single server process. Session storage is
isolated behind a small store interface so Redis or Valkey can be introduced later when multiple
server instances or restart persistence are required. The Socket.IO adapter and the session store
must both be shared in a multi-instance deployment.
