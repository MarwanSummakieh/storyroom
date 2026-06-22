// Storage dispatcher.
//
// - No DATABASE_URL  -> JSON dev store (zero setup, single machine).
// - DATABASE_URL set -> Prisma/Postgres store, so the web app and the realtime
//   server can share state across separate hosts (the production split).
//
// Both backends export the identical function contract; the `typeof jsonStore`
// annotation enforces that parity at compile time.
import * as jsonStore from "@/lib/store-json";
import * as prismaStore from "@/lib/store-prisma";

const impl: typeof jsonStore = process.env.DATABASE_URL
  ? prismaStore
  : jsonStore;

export const getWorkspace = impl.getWorkspace;
export const getNovel = impl.getNovel;
export const createNovel = impl.createNovel;
export const updateNovel = impl.updateNovel;
export const deleteNovel = impl.deleteNovel;
export const createChapter = impl.createChapter;
export const updateChapter = impl.updateChapter;
export const createScene = impl.createScene;
export const updateScene = impl.updateScene;
export const createStoryBibleEntry = impl.createStoryBibleEntry;
export const updateStoryBibleEntry = impl.updateStoryBibleEntry;
export const listChatMessages = impl.listChatMessages;
export const addChatMessage = impl.addChatMessage;
export const saveDocumentState = impl.saveDocumentState;
export const loadDocumentState = impl.loadDocumentState;
export const exportNovelAsMarkdown = impl.exportNovelAsMarkdown;
