# Trivia Tournament

Real-time multiplayer trivia with a host-controlled flow, speed-based scoring, and a live leaderboard.

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
