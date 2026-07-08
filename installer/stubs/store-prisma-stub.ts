// Replaces "@/lib/store-prisma" in the bundled realtime server for the native
// Windows build, which always runs on the JSON store. Keeps Prisma, the pg
// driver, and the generated client out of the bundle entirely.
import type * as jsonStore from "../../src/lib/store-json";

function unavailable(): never {
  throw new Error(
    "The Postgres store is not included in the native Windows build. " +
      "Unset DATABASE_URL to use the JSON store, or run the Docker deployment.",
  );
}

export const getWorkspace: typeof jsonStore.getWorkspace = unavailable;
export const getNovel: typeof jsonStore.getNovel = unavailable;
export const createNovel: typeof jsonStore.createNovel = unavailable;
export const updateNovel: typeof jsonStore.updateNovel = unavailable;
export const deleteNovel: typeof jsonStore.deleteNovel = unavailable;
export const createChapter: typeof jsonStore.createChapter = unavailable;
export const updateChapter: typeof jsonStore.updateChapter = unavailable;
export const createScene: typeof jsonStore.createScene = unavailable;
export const updateScene: typeof jsonStore.updateScene = unavailable;
export const createStoryBibleEntry: typeof jsonStore.createStoryBibleEntry = unavailable;
export const updateStoryBibleEntry: typeof jsonStore.updateStoryBibleEntry = unavailable;
export const listChatMessages: typeof jsonStore.listChatMessages = unavailable;
export const addChatMessage: typeof jsonStore.addChatMessage = unavailable;
export const saveDocumentState: typeof jsonStore.saveDocumentState = unavailable;
export const loadDocumentState: typeof jsonStore.loadDocumentState = unavailable;
export const exportNovelAsMarkdown: typeof jsonStore.exportNovelAsMarkdown = unavailable;
