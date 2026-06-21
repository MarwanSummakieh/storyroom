import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  Chapter,
  Novel,
  NovelSummary,
  Scene,
  StoryBibleEntry,
  WorkspacePayload,
} from "@/lib/types";
import type {
  CreateChapterInput,
  CreateChatMessageInput,
  CreateNovelInput,
  CreateSceneInput,
  CreateStoryBibleEntryInput,
  UpdateSceneInput,
} from "@/lib/validation";

type DocumentState = {
  novelId: string;
  sceneId: string;
  updateBase64: string;
  version: number;
  updatedAt: string;
};

type StoryroomData = {
  novels: Novel[];
  chatMessages: ChatMessage[];
  documentStates: Record<string, DocumentState>;
};

const initialSceneId = "scene-opening-image";
const initialNovelId = "novel-glass-harbor";
const initialChapterId = "chapter-arrivals";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function dataDir() {
  if (process.env.STORYROOM_DATA_DIR) {
    return path.resolve(process.env.STORYROOM_DATA_DIR);
  }

  return path.join(process.cwd(), "data");
}

function dataPath() {
  return path.join(dataDir(), "storyroom.json");
}

function makeSeedData(): StoryroomData {
  const timestamp = now();
  const scenes: Scene[] = [
    {
      id: initialSceneId,
      novelId: initialNovelId,
      chapterId: initialChapterId,
      title: "Opening Image",
      summary: "A lighthouse keeper discovers a city reflected in broken glass.",
      status: "draft",
      position: 1,
      updatedAt: timestamp,
    },
    {
      id: "scene-first-argument",
      novelId: initialNovelId,
      chapterId: initialChapterId,
      title: "First Argument",
      summary: "The co-authors can test scene switching without losing the main draft.",
      status: "revising",
      position: 2,
      updatedAt: timestamp,
    },
  ];

  return {
    novels: [
      {
        id: initialNovelId,
        title: "The Glass Harbor",
        logline:
          "A quiet coastal town begins reflecting lives that have not happened yet.",
        genre: "Speculative mystery",
        roomId: "room-glass-harbor",
        updatedAt: timestamp,
        chapters: [
          {
            id: initialChapterId,
            novelId: initialNovelId,
            title: "Chapter 1: Arrivals",
            position: 1,
            scenes,
          },
        ],
        storyBible: [
          {
            id: "bible-mara-vale",
            novelId: initialNovelId,
            kind: "character",
            title: "Mara Vale",
            body:
              "Former cartographer. Keeps a private ledger of impossible coastlines and refuses to admit she is afraid of the sea.",
            tags: ["protagonist", "secret"],
            updatedAt: timestamp,
          },
          {
            id: "bible-harbor-rule",
            novelId: initialNovelId,
            kind: "canon",
            title: "Canon: Reflections Lie Forward",
            body:
              "Glass near the harbor never shows the present. It shows a likely future unless someone makes a deliberate sacrifice.",
            tags: ["magic", "continuity"],
            updatedAt: timestamp,
          },
        ],
      },
    ],
    chatMessages: [
      {
        id: "chat-welcome",
        novelId: initialNovelId,
        sceneId: initialSceneId,
        authorName: "Storyroom",
        authorColor: "#059669",
        body: "Open this room in two tabs, rename each author, and start typing in the manuscript.",
        createdAt: timestamp,
      },
    ],
    documentStates: {},
  };
}

async function readData(): Promise<StoryroomData> {
  await mkdir(dataDir(), { recursive: true });

  try {
    const raw = await readFile(dataPath(), "utf8");
    return JSON.parse(raw) as StoryroomData;
  } catch {
    const seed = makeSeedData();
    await writeData(seed);
    return seed;
  }
}

async function writeData(data: StoryroomData) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(dataPath(), JSON.stringify(data, null, 2), "utf8");
}

function summarizeNovel(novel: Novel): NovelSummary {
  const sceneCount = novel.chapters.reduce(
    (count, chapter) => count + chapter.scenes.length,
    0,
  );

  return {
    id: novel.id,
    title: novel.title,
    logline: novel.logline,
    genre: novel.genre,
    roomId: novel.roomId,
    updatedAt: novel.updatedAt,
    chapterCount: novel.chapters.length,
    sceneCount,
    storyBibleCount: novel.storyBible.length,
  };
}

function findNovel(data: StoryroomData, novelId: string) {
  const novel = data.novels.find((item) => item.id === novelId);
  if (!novel) {
    throw new Error("Novel not found.");
  }
  return novel;
}

function findScene(data: StoryroomData, sceneId: string) {
  for (const novel of data.novels) {
    for (const chapter of novel.chapters) {
      const scene = chapter.scenes.find((item) => item.id === sceneId);
      if (scene) {
        return { novel, chapter, scene };
      }
    }
  }

  throw new Error("Scene not found.");
}

export async function getWorkspace(): Promise<WorkspacePayload> {
  const data = await readData();
  const novels = data.novels.map(summarizeNovel);

  return {
    novels,
    activeNovel: data.novels[0] ?? null,
  };
}

export async function getNovel(novelId: string): Promise<Novel> {
  const data = await readData();
  return findNovel(data, novelId);
}

export async function createNovel(input: CreateNovelInput): Promise<Novel> {
  const data = await readData();
  const timestamp = now();
  const novelId = makeId("novel");
  const chapterId = makeId("chapter");
  const sceneId = makeId("scene");

  const novel: Novel = {
    id: novelId,
    title: input.title,
    logline: input.logline,
    genre: input.genre,
    roomId: makeId("room"),
    updatedAt: timestamp,
    chapters: [
      {
        id: chapterId,
        novelId,
        title: "Chapter 1",
        position: 1,
        scenes: [
          {
            id: sceneId,
            novelId,
            chapterId,
            title: "Opening Scene",
            summary: "Start drafting here.",
            status: "draft",
            position: 1,
            updatedAt: timestamp,
          },
        ],
      },
    ],
    storyBible: [],
  };

  data.novels.unshift(novel);
  await writeData(data);
  return novel;
}

export async function createChapter(
  novelId: string,
  input: CreateChapterInput,
): Promise<Chapter> {
  const data = await readData();
  const novel = findNovel(data, novelId);
  const timestamp = now();
  const chapter: Chapter = {
    id: makeId("chapter"),
    novelId,
    title: input.title,
    position: novel.chapters.length + 1,
    scenes: [],
  };

  novel.chapters.push(chapter);
  novel.updatedAt = timestamp;
  await writeData(data);
  return chapter;
}

export async function createScene(
  novelId: string,
  input: CreateSceneInput,
): Promise<Scene> {
  const data = await readData();
  const novel = findNovel(data, novelId);
  const chapter = novel.chapters.find((item) => item.id === input.chapterId);

  if (!chapter) {
    throw new Error("Chapter not found.");
  }

  const timestamp = now();
  const scene: Scene = {
    id: makeId("scene"),
    novelId,
    chapterId: chapter.id,
    title: input.title,
    summary: input.summary,
    status: "draft",
    position: chapter.scenes.length + 1,
    updatedAt: timestamp,
  };

  chapter.scenes.push(scene);
  novel.updatedAt = timestamp;
  await writeData(data);
  return scene;
}

export async function updateScene(
  sceneId: string,
  input: UpdateSceneInput,
): Promise<Scene> {
  const data = await readData();
  const { novel, scene } = findScene(data, sceneId);
  const timestamp = now();

  Object.assign(scene, input, { updatedAt: timestamp });
  novel.updatedAt = timestamp;
  await writeData(data);
  return scene;
}

export async function createStoryBibleEntry(
  novelId: string,
  input: CreateStoryBibleEntryInput,
): Promise<StoryBibleEntry> {
  const data = await readData();
  const novel = findNovel(data, novelId);
  const timestamp = now();
  const entry: StoryBibleEntry = {
    id: makeId("bible"),
    novelId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    tags: input.tags,
    updatedAt: timestamp,
  };

  novel.storyBible.unshift(entry);
  novel.updatedAt = timestamp;
  await writeData(data);
  return entry;
}

export async function listChatMessages(sceneId: string): Promise<ChatMessage[]> {
  const data = await readData();
  findScene(data, sceneId);
  return data.chatMessages
    .filter((message) => message.sceneId === sceneId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addChatMessage(
  sceneId: string,
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  const data = await readData();
  const { novel } = findScene(data, sceneId);
  const message: ChatMessage = {
    id: makeId("chat"),
    novelId: novel.id,
    sceneId,
    authorName: input.authorName,
    authorColor: input.authorColor,
    body: input.body,
    createdAt: now(),
  };

  data.chatMessages.push(message);
  await writeData(data);
  return message;
}

export async function saveDocumentState(sceneId: string, update: Uint8Array) {
  const data = await readData();
  const { novel } = findScene(data, sceneId);
  const existing = data.documentStates[sceneId];

  data.documentStates[sceneId] = {
    novelId: novel.id,
    sceneId,
    updateBase64: Buffer.from(update).toString("base64"),
    version: existing ? existing.version + 1 : 1,
    updatedAt: now(),
  };

  await writeData(data);
}

export async function loadDocumentState(
  sceneId: string,
): Promise<Uint8Array | null> {
  const data = await readData();
  const state = data.documentStates[sceneId];
  return state ? Uint8Array.from(Buffer.from(state.updateBase64, "base64")) : null;
}

export async function exportNovelAsMarkdown(novelId: string) {
  const { yUpdateToPlainText } = await import("@/lib/y-export");
  const data = await readData();
  const novel = findNovel(data, novelId);
  const lines = [`# ${novel.title}`, "", `_${novel.logline}_`, ""];

  for (const chapter of novel.chapters) {
    lines.push(`## ${chapter.title}`, "");

    for (const scene of chapter.scenes) {
      const snapshot = data.documentStates[scene.id];
      const text = yUpdateToPlainText(
        snapshot
          ? Uint8Array.from(Buffer.from(snapshot.updateBase64, "base64"))
          : null,
      );

      lines.push(`### ${scene.title}`, "");
      lines.push(text || `_${scene.summary || "No manuscript text yet."}_`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
