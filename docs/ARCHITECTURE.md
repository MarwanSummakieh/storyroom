# Storyroom Architecture

Storyroom is split into a web app, a realtime collaboration service, and a persistence layer.

## Runtime Components

| Component | Responsibility |
| --- | --- |
| Next.js app | Workspace UI, REST APIs, export endpoint, validation |
| Hocuspocus server | Yjs document sync, awareness, stateless chat broadcasts |
| JSON dev store | Zero-setup persistence for room metadata, chat, and Yjs snapshots |
| Prisma schema | Production-ready Postgres data model |

## Realtime Flow

1. The client loads novel, chapter, scene, chat, and story-bible metadata from REST APIs.
2. The active scene id becomes the Hocuspocus/Yjs document name.
3. TipTap binds its ProseMirror document to the Yjs document.
4. Hocuspocus syncs CRDT updates across connected browser tabs.
5. Awareness state carries author name, color, active scene, selection, and cursor metadata.
6. The server stores compact Yjs updates through `onStoreDocument`.
7. On reconnect, `onLoadDocument` hydrates the Yjs document before syncing new updates.

## Chat Flow

Scene chat uses Hocuspocus stateless messages instead of a separate socket:

1. Client sends `chat:message` with author metadata and body.
2. Server validates the payload with Zod.
3. Server persists the message in the store.
4. Server broadcasts `chat:created` back to all clients in the scene.
5. Clients merge the message by id to avoid duplicate rendering.

## Persistence Strategy

The current repository uses the JSON store by default because it makes the project easy for reviewers to run locally. The data contracts are intentionally shaped around entities that map directly to the Prisma schema:

- `User`
- `Novel`
- `Chapter`
- `Scene`
- `StoryBibleEntry`
- `ChatMessage`
- `DocumentSnapshot`

The UI and route handlers do not depend on the storage implementation. A Prisma-backed repository can replace `src/lib/store.ts` without changing the client-facing API shape.

## Conflict Handling

Manuscript conflicts are delegated to Yjs CRDT updates. This is the right tradeoff for a portfolio realtime editor because it demonstrates production-grade collaboration primitives instead of a fragile custom operational-transform implementation.

Simple metadata mutations use API validation and last-write-wins semantics, which is acceptable for the MVP surface.

## Testing Strategy

- Vitest covers API validation and Yjs export helpers.
- Playwright opens two browser tabs and verifies:
  - manuscript text syncs across tabs,
  - collaborator presence appears,
  - chat messages broadcast and render.
