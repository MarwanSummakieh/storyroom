# Recruiter Demo Guide

This is the shortest way to evaluate Storyroom.

## Run It

```bash
corepack pnpm install
corepack pnpm prisma:generate
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## What To Try

1. Open the app in two browser tabs.
2. Rename the author in each tab.
3. Type in the manuscript editor.
4. Watch text and cursor presence sync live in the other tab.
5. Send a scene chat message.
6. Click **Canon** to add a story-bible fact.
7. Click **Export** to download the manuscript as Markdown.

## What This Demonstrates

- WebSocket-based realtime collaboration.
- CRDT-backed editor state synchronization.
- Presence and awareness state.
- Persistent document snapshots.
- Validated REST APIs.
- End-to-end browser testing of multiplayer behavior.

## Useful Code Pointers

- `src/components/storyroom/storyroom-app.tsx`: main UI and client collaboration hooks.
- `server/realtime.ts`: Hocuspocus server hooks for document load/store and chat.
- `src/lib/store.ts`: persistence abstraction used by APIs and realtime server.
- `src/lib/validation.ts`: Zod schemas for mutation inputs.
- `tests/storyroom.spec.ts`: two-tab integration test.
