# Storyroom

**A realtime collaborative novel-writing workspace built with Next.js, TipTap, Yjs, Hocuspocus, and Prisma.**

Storyroom is a portfolio-grade multiplayer writing tool for co-authors. It combines a collaborative manuscript editor, scene organization, story-bible notes, live presence, shared cursors, scene chat, persistence, and export.

![Storyroom workspace](docs/assets/storyroom-workspace.png)

## Why This Project Matters

Most writing apps are either plain documents or private planning tools. Storyroom treats fiction writing as a multiplayer workspace:

- Co-authors can write in the same scene at the same time.
- Live presence shows who is in the room and where they are editing.
- Scene chat keeps collaboration attached to the manuscript.
- The story bible tracks canon facts, characters, places, and lore beside the draft.
- Yjs CRDT state keeps simultaneous edits safe without hand-rolled conflict logic.

This project demonstrates realtime state synchronization, editor architecture, WebSocket coordination, API design, persistence strategy, and end-to-end testing.

## Feature Highlights

- **Realtime manuscript editing** with TipTap, ProseMirror, Yjs, and Hocuspocus.
- **Live cursors and presence** using Yjs awareness.
- **Chapter and scene navigation** for novel structure.
- **Story bible panel** for characters, canon facts, places, and lore.
- **Scene chat** sent through WebSocket stateless events and persisted after broadcast.
- **Markdown export** from saved Yjs document snapshots.
- **Zero-setup local demo** with a JSON dev store.
- **Production-ready data model** with Prisma/Postgres schema and Prisma 7 Postgres adapter wiring.
- **Automated two-tab realtime test** with Playwright.

## Tech Stack

| Area | Tools |
| --- | --- |
| App | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, lucide-react, small local component primitives |
| Editor | TipTap, ProseMirror, Yjs |
| Realtime | Hocuspocus WebSocket server, Yjs awareness |
| API | Next.js route handlers, Zod validation |
| Persistence | JSON dev store, Prisma/Postgres schema |
| Testing | Vitest, Playwright |

## Deploy in one command

The only prerequisite is **[Docker](https://docs.docker.com/get-docker/)** (Docker
Desktop on macOS/Windows, or Docker Engine on Linux). After cloning the repo:

```bash
bash deploy.sh
```

That's it. The script builds and starts the entire app in containers — the
Next.js web app, the Hocuspocus realtime server, and Postgres — applies the
database schema, waits until the app is answering, and prints the URLs:

```
✔ Storyroom is live
    App:      http://localhost:3000
    Realtime: ws://localhost:1234
```

Open [http://localhost:3000](http://localhost:3000), then open the same URL in a
second tab — type in one and watch the other sync live.

> **Windows:** run `bash deploy.sh` from Git Bash or WSL. From PowerShell or any
> shell, the equivalent is `docker compose up --build` (see below).

### What the command does

`deploy.sh` is a thin wrapper around Docker Compose. It:

1. checks that Docker is installed and running,
2. runs `docker compose up --build -d`, which starts the services in order:
   `postgres` → `migrate` (applies the Prisma schema) → `web` + `realtime`,
3. polls `http://localhost:3000` until the app responds, then prints the URLs.

Re-running it safely rebuilds and restarts. Equivalent manual command:

```bash
docker compose up --build      # add -d to run in the background
```

### Managing the deployment

```bash
docker compose logs -f web realtime   # tail application logs
docker compose ps                      # service status
docker compose down                    # stop (add -v to also delete the database)
```

### Deploying to a remote host / public URL

The default config serves on `localhost`. To run on a server reachable by others,
point the browser at the realtime server's public address by overriding
`NEXT_PUBLIC_COLLAB_URL` (it is baked in at build time):

```bash
NEXT_PUBLIC_COLLAB_URL=wss://realtime.example.com docker compose up --build -d
```

For a managed split (Next.js on Vercel + realtime on a WebSocket host + hosted
Postgres), see [docs/DEPLOY.md](docs/DEPLOY.md).

## Run on the host (for development)

```bash
corepack pnpm install
docker compose up -d postgres   # or omit to use the zero-setup JSON store
corepack pnpm dev
```

`pnpm dev` runs Next.js + the realtime server together. With `DATABASE_URL` set
(see `.env.example`) it uses Postgres; without it, a local JSON file store.

## Demo Script For Recruiters

1. Open Storyroom in two browser tabs.
2. Rename each tab's author in the left sidebar.
3. Type a sentence in the manuscript editor in tab one.
4. Watch the text and cursor sync live in tab two.
5. Send a scene chat message from tab two.
6. Add a canon fact in the story bible.
7. Export the novel as Markdown.

The fastest technical explanation:

> Each scene is a Yjs document. Hocuspocus handles WebSocket sync and awareness, while the app stores compact Yjs updates so the manuscript survives refreshes and reconnects.

## Architecture

```mermaid
flowchart LR
  BrowserA["Browser tab A"] <--> WS["Hocuspocus WebSocket server"]
  BrowserB["Browser tab B"] <--> WS
  BrowserA --> API["Next.js REST APIs"]
  BrowserB --> API
  WS --> Store["JSON dev store / Yjs snapshots"]
  API --> Store
  Store -. future adapter .-> DB["Postgres via Prisma"]
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Validation

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

The e2e test opens two Chromium tabs and verifies manuscript sync, presence, and chat.

## Optional Postgres

The default demo intentionally uses a JSON dev store so reviewers can run it immediately. The Prisma schema, config, generated client path, and Postgres adapter are included for the production persistence path.

```bash
docker compose up -d
```

Set `DATABASE_URL` from `.env.example`, then extend the repository layer behind the existing API contracts.

## Project Structure

```text
src/components/storyroom/storyroom-app.tsx   Main collaborative workspace
server/realtime.ts                           Hocuspocus WebSocket server
src/lib/store.ts                             JSON dev persistence and domain operations
src/app/api                                  Zod-validated REST API routes
prisma/schema.prisma                         Postgres data model
tests/storyroom.spec.ts                      Two-tab realtime Playwright test
```

## What I Would Build Next

- Authenticated rooms and share links.
- Comments and suggestion mode.
- Scene locks for review workflows.
- AI-assisted continuity radar from manually marked canon facts.
- Prisma-backed repository implementation for hosted deployment.
