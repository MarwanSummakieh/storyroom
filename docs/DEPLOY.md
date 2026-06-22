# Deploying Storyroom (Vercel + realtime host + Postgres)

Storyroom runs as **three pieces** in production:

```
┌─────────────┐      HTTPS       ┌──────────────────────┐
│  Browser    │ ───────────────▶ │  Web app (Vercel)    │  Next.js UI + REST API
│             │ ◀─────────────── │  Prisma → Postgres   │
│             │                  └──────────┬───────────┘
│             │      WSS                    │ shares
│             │ ───────────────▶ ┌──────────▼───────────┐
│             │ ◀─────────────── │  Realtime (Render/…) │  Hocuspocus WebSocket
└─────────────┘                  │  Prisma → Postgres   │  server/realtime.ts
                                 └──────────┬───────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │   Postgres (Neon)  │  shared state
                                  └────────────────────┘
```

Both the web app and the realtime server talk to the **same Postgres database**
through the Prisma store. Setting `DATABASE_URL` is what switches the app from
the local JSON dev store to Postgres — see [`src/lib/store.ts`](../src/lib/store.ts).

---

## 1. Provision Postgres

Use any managed Postgres. **[Neon](https://neon.tech)** pairs best with Vercel
(serverless-friendly pooling):

1. Create a project → copy the **pooled** connection string
   (`...-pooler...`, used by the serverless web app) and the **direct** string.
2. Keep both handy — you'll set `DATABASE_URL` on both services.

(Alternatively, the included [`render.yaml`](../render.yaml) can provision a
Render Postgres alongside the realtime service.)

## 2. Deploy the realtime server

The realtime server is containerised by the repo [`Dockerfile`](../Dockerfile)
and runs `pnpm start:realtime`. It listens on the host-injected `PORT`.

**Render (one-click via Blueprint):**

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` provisions the
   `storyroom-realtime` Docker service (and, if you want, a Postgres database).
3. Set `DATABASE_URL` to your Postgres (skip if you let the blueprint create one).
4. The blueprint's `preDeployCommand: pnpm db:push` applies the schema on deploy.
5. Note the service URL, e.g. `https://storyroom-realtime.onrender.com`. Your
   realtime URL is the `wss://` form: `wss://storyroom-realtime.onrender.com`.

**Railway / Fly.io:** deploy the same `Dockerfile`, set `DATABASE_URL`, and run
`pnpm db:push` once against the database (see step 4).

## 3. Deploy the web app (Vercel)

1. Vercel → **New Project** → import the repo (framework auto-detected as Next.js).
2. Set **Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Postgres **pooled** connection string |
   | `NEXT_PUBLIC_COLLAB_URL` | `wss://storyroom-realtime.onrender.com` (from step 2) |

3. Deploy. `prisma generate` runs automatically via the `postinstall` script.

> `NEXT_PUBLIC_COLLAB_URL` is read at build time (it's a `NEXT_PUBLIC_` var), so
> set it **before** the first deploy, or redeploy after adding it.

## 4. Apply the database schema

If your host didn't run it for you (Render's blueprint does), apply the schema
once from any machine that can reach the database:

```bash
DATABASE_URL="postgres://..." pnpm db:push
```

This creates the tables from [`prisma/schema.prisma`](../prisma/schema.prisma).
The seed novel ("The Glass Harbor") is inserted automatically on first load.

## 5. Verify

- Open the Vercel URL — you should see the seeded novel.
- Open it in a second tab and type: text should sync live (confirms the browser
  reached the realtime server over `wss://` and both share Postgres).
- Refresh: your text persists (confirms snapshots are saved to Postgres).

---

## Run the whole stack locally in Docker

The repo's [`docker-compose.yml`](../docker-compose.yml) runs the full app — web,
realtime, and Postgres — in containers, mirroring the production split on one
machine:

```bash
docker compose up --build      # http://localhost:3000
```

A one-shot `migrate` service applies the Prisma schema before the app starts.

## Test just the Postgres store

To exercise the production store against a local DB without the app containers:

```bash
docker compose up -d postgres                          # Postgres only, on :5432
DATABASE_URL="postgresql://storyroom:storyroom@localhost:5432/storyroom?schema=public" pnpm db:push
DATABASE_URL="postgresql://storyroom:storyroom@localhost:5432/storyroom?schema=public" pnpm db:test
```

`pnpm db:test` ([`scripts/db-smoke-test.ts`](../scripts/db-smoke-test.ts))
exercises every store operation (seed, create, update, chat, snapshot
round-trip, export) and prints a pass/fail report.

## Environment variable reference

| Variable | Web (Vercel) | Realtime host | Notes |
| --- | :---: | :---: | --- |
| `DATABASE_URL` | ✅ | ✅ | Same database. Use the pooled string on Vercel. |
| `NEXT_PUBLIC_COLLAB_URL` | ✅ | — | `wss://` URL of the realtime host. Build-time. |
| `PORT` | — | auto | Injected by the host; the server binds to it. |
| `COLLAB_PORT` | — | optional | Local-only fallback port (default `1234`). |
