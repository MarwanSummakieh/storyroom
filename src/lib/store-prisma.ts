import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/prisma";
import type {
  ChatMessage,
  Chapter,
  Novel,
  NovelSummary,
  Scene,
  SceneStatus,
  StoryBibleEntry,
  StoryBibleKind,
  WorkspacePayload,
} from "@/lib/types";
import type {
  CreateChapterInput,
  CreateChatMessageInput,
  CreateNovelInput,
  CreateSceneInput,
  CreateStoryBibleEntryInput,
  UpdateChapterInput,
  UpdateNovelInput,
  UpdateSceneInput,
  UpdateStoryBibleEntryInput,
} from "@/lib/validation";

// Prisma stores enums uppercase; the domain/API contract uses lowercase.
const kindToDb = {
  character: "CHARACTER",
  place: "PLACE",
  lore: "LORE",
  canon: "CANON",
} as const satisfies Record<StoryBibleKind, string>;

const kindToDomain: Record<string, StoryBibleKind> = {
  CHARACTER: "character",
  PLACE: "place",
  LORE: "lore",
  CANON: "canon",
};

const statusToDb = {
  draft: "DRAFT",
  revising: "REVISING",
  review: "REVIEW",
  locked: "LOCKED",
} as const satisfies Record<SceneStatus, string>;

const statusToDomain: Record<string, SceneStatus> = {
  DRAFT: "draft",
  REVISING: "revising",
  REVIEW: "review",
  LOCKED: "locked",
};

const iso = (value: Date) => value.toISOString();

type SceneRow = {
  id: string;
  novelId: string;
  chapterId: string;
  title: string;
  summary: string;
  status: string;
  position: number;
  updatedAt: Date;
};

type ChapterRow = {
  id: string;
  novelId: string;
  title: string;
  position: number;
  scenes: SceneRow[];
};

type BibleRow = {
  id: string;
  novelId: string;
  kind: string;
  title: string;
  body: string;
  tags: string[];
  updatedAt: Date;
};

type NovelRow = {
  id: string;
  title: string;
  logline: string;
  genre: string;
  roomId: string;
  updatedAt: Date;
  chapters: ChapterRow[];
  storyBible: BibleRow[];
};

type ChatRow = {
  id: string;
  novelId: string;
  sceneId: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: Date;
};

function mapScene(scene: SceneRow): Scene {
  return {
    id: scene.id,
    novelId: scene.novelId,
    chapterId: scene.chapterId,
    title: scene.title,
    summary: scene.summary,
    status: statusToDomain[scene.status] ?? "draft",
    position: scene.position,
    updatedAt: iso(scene.updatedAt),
  };
}

function mapChapter(chapter: ChapterRow): Chapter {
  return {
    id: chapter.id,
    novelId: chapter.novelId,
    title: chapter.title,
    position: chapter.position,
    scenes: chapter.scenes.map(mapScene),
  };
}

function mapBible(entry: BibleRow): StoryBibleEntry {
  return {
    id: entry.id,
    novelId: entry.novelId,
    kind: kindToDomain[entry.kind] ?? "lore",
    title: entry.title,
    body: entry.body,
    tags: entry.tags,
    updatedAt: iso(entry.updatedAt),
  };
}

function mapNovel(novel: NovelRow): Novel {
  return {
    id: novel.id,
    title: novel.title,
    logline: novel.logline,
    genre: novel.genre,
    roomId: novel.roomId,
    updatedAt: iso(novel.updatedAt),
    chapters: novel.chapters.map(mapChapter),
    storyBible: novel.storyBible.map(mapBible),
  };
}

function mapChat(message: ChatRow): ChatMessage {
  return {
    id: message.id,
    novelId: message.novelId,
    sceneId: message.sceneId,
    authorName: message.authorName,
    authorColor: message.authorColor,
    body: message.body,
    createdAt: iso(message.createdAt),
  };
}

// Order chapters/scenes by position and story-bible newest-first to mirror the
// JSON store contract that the client already relies on.
const novelInclude = {
  chapters: {
    orderBy: { position: "asc" as const },
    include: { scenes: { orderBy: { position: "asc" as const } } },
  },
  storyBible: { orderBy: { createdAt: "desc" as const } },
};

function summarize(novel: Novel): NovelSummary {
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

async function ensureSeed() {
  const prisma = getPrisma();
  const count = await prisma.novel.count();
  if (count > 0) {
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Scene has two required relations (novel + chapter), so scenes are
      // created explicitly once the novel and chapter ids exist.
      const novel = await tx.novel.create({
        data: {
          title: "The Glass Harbor",
          logline:
            "A quiet coastal town begins reflecting lives that have not happened yet.",
          genre: "Speculative mystery",
          roomId: "room-glass-harbor",
          chapters: {
            create: { title: "Chapter 1: Arrivals", position: 1 },
          },
          storyBible: {
            create: [
              {
                kind: "CHARACTER",
                title: "Mara Vale",
                body: "Former cartographer. Keeps a private ledger of impossible coastlines and refuses to admit she is afraid of the sea.",
                tags: ["protagonist", "secret"],
              },
              {
                kind: "CANON",
                title: "Canon: Reflections Lie Forward",
                body: "Glass near the harbor never shows the present. It shows a likely future unless someone makes a deliberate sacrifice.",
                tags: ["magic", "continuity"],
              },
            ],
          },
        },
        include: { chapters: true },
      });

      const chapterId = novel.chapters[0].id;
      const opening = await tx.scene.create({
        data: {
          novelId: novel.id,
          chapterId,
          title: "Opening Image",
          summary:
            "A lighthouse keeper discovers a city reflected in broken glass.",
          status: "DRAFT",
          position: 1,
        },
      });
      await tx.scene.create({
        data: {
          novelId: novel.id,
          chapterId,
          title: "First Argument",
          summary:
            "The co-authors can test scene switching without losing the main draft.",
          status: "REVISING",
          position: 2,
        },
      });
      await tx.chatMessage.create({
        data: {
          novelId: novel.id,
          sceneId: opening.id,
          authorName: "Storyroom",
          authorColor: "#7c3aed",
          body: "Open this room in two tabs, rename each author, and start typing in the manuscript.",
        },
      });
    });
  } catch (error) {
    // A concurrent first-load may have seeded already (unique roomId) — ignore.
    if (!(error instanceof Error) || !/Unique constraint/i.test(error.message)) {
      throw error;
    }
  }
}

export async function getWorkspace(): Promise<WorkspacePayload> {
  const prisma = getPrisma();
  await ensureSeed();

  const novels = await prisma.novel.findMany({
    orderBy: { createdAt: "desc" },
    include: novelInclude,
  });

  const mapped = novels.map((novel) => mapNovel(novel as NovelRow));

  return {
    novels: mapped.map(summarize),
    activeNovel: mapped[0] ?? null,
  };
}

export async function getNovel(novelId: string): Promise<Novel> {
  const prisma = getPrisma();
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: novelInclude,
  });

  if (!novel) {
    throw new Error("Novel not found.");
  }

  return mapNovel(novel as NovelRow);
}

export async function createNovel(input: CreateNovelInput): Promise<Novel> {
  const prisma = getPrisma();
  const novelId = await prisma.$transaction(async (tx) => {
    const novel = await tx.novel.create({
      data: {
        title: input.title,
        logline: input.logline,
        genre: input.genre,
        roomId: `room-${randomUUID().slice(0, 8)}`,
        chapters: { create: { title: "Chapter 1", position: 1 } },
      },
      include: { chapters: true },
    });

    await tx.scene.create({
      data: {
        novelId: novel.id,
        chapterId: novel.chapters[0].id,
        title: "Opening Scene",
        summary: "Start drafting here.",
        status: "DRAFT",
        position: 1,
      },
    });

    return novel.id;
  });

  return getNovel(novelId);
}

export async function updateNovel(
  novelId: string,
  input: UpdateNovelInput,
): Promise<Novel> {
  const prisma = getPrisma();
  const existing = await prisma.novel.findUnique({ where: { id: novelId } });

  if (!existing) {
    throw new Error("Novel not found.");
  }

  await prisma.novel.update({
    where: { id: novelId },
    data: {
      title: input.title,
      logline: input.logline,
      genre: input.genre,
    },
  });

  return getNovel(novelId);
}

export async function deleteNovel(novelId: string): Promise<void> {
  const prisma = getPrisma();
  try {
    // Chapters, scenes, bible, chat, and snapshots cascade (see schema.prisma).
    await prisma.novel.delete({ where: { id: novelId } });
  } catch {
    throw new Error("Novel not found.");
  }
}

export async function createChapter(
  novelId: string,
  input: CreateChapterInput,
): Promise<Chapter> {
  const prisma = getPrisma();
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: { chapters: true },
  });

  if (!novel) {
    throw new Error("Novel not found.");
  }

  const chapter = await prisma.chapter.create({
    data: {
      novelId,
      title: input.title,
      position: novel.chapters.length + 1,
    },
    include: { scenes: { orderBy: { position: "asc" } } },
  });

  await prisma.novel.update({
    where: { id: novelId },
    data: { updatedAt: new Date() },
  });

  return mapChapter(chapter as ChapterRow);
}

export async function updateChapter(
  chapterId: string,
  input: UpdateChapterInput,
): Promise<Chapter> {
  const prisma = getPrisma();
  const existing = await prisma.chapter.findUnique({ where: { id: chapterId } });

  if (!existing) {
    throw new Error("Chapter not found.");
  }

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: { title: input.title },
    include: { scenes: { orderBy: { position: "asc" } } },
  });

  return mapChapter(chapter as ChapterRow);
}

export async function createScene(
  novelId: string,
  input: CreateSceneInput,
): Promise<Scene> {
  const prisma = getPrisma();
  const chapter = await prisma.chapter.findFirst({
    where: { id: input.chapterId, novelId },
    include: { _count: { select: { scenes: true } } },
  });

  if (!chapter) {
    throw new Error("Chapter not found.");
  }

  const scene = await prisma.scene.create({
    data: {
      novelId,
      chapterId: chapter.id,
      title: input.title,
      summary: input.summary,
      status: "DRAFT",
      position: chapter._count.scenes + 1,
    },
  });

  await prisma.novel.update({
    where: { id: novelId },
    data: { updatedAt: new Date() },
  });

  return mapScene(scene as SceneRow);
}

export async function updateScene(
  sceneId: string,
  input: UpdateSceneInput,
): Promise<Scene> {
  const prisma = getPrisma();
  const existing = await prisma.scene.findUnique({ where: { id: sceneId } });

  if (!existing) {
    throw new Error("Scene not found.");
  }

  const scene = await prisma.scene.update({
    where: { id: sceneId },
    data: {
      title: input.title,
      summary: input.summary,
      status: input.status ? statusToDb[input.status] : undefined,
    },
  });

  await prisma.novel.update({
    where: { id: scene.novelId },
    data: { updatedAt: new Date() },
  });

  return mapScene(scene as SceneRow);
}

export async function createStoryBibleEntry(
  novelId: string,
  input: CreateStoryBibleEntryInput,
): Promise<StoryBibleEntry> {
  const prisma = getPrisma();
  const novel = await prisma.novel.findUnique({ where: { id: novelId } });

  if (!novel) {
    throw new Error("Novel not found.");
  }

  const entry = await prisma.storyBibleEntry.create({
    data: {
      novelId,
      kind: kindToDb[input.kind],
      title: input.title,
      body: input.body,
      tags: input.tags,
    },
  });

  await prisma.novel.update({
    where: { id: novelId },
    data: { updatedAt: new Date() },
  });

  return mapBible(entry as BibleRow);
}

export async function updateStoryBibleEntry(
  entryId: string,
  input: UpdateStoryBibleEntryInput,
): Promise<StoryBibleEntry> {
  const prisma = getPrisma();
  const existing = await prisma.storyBibleEntry.findUnique({
    where: { id: entryId },
  });

  if (!existing) {
    throw new Error("Story bible entry not found.");
  }

  const entry = await prisma.storyBibleEntry.update({
    where: { id: entryId },
    data: {
      kind: input.kind ? kindToDb[input.kind] : undefined,
      title: input.title,
      body: input.body,
      tags: input.tags,
    },
  });

  return mapBible(entry as BibleRow);
}

export async function listChatMessages(sceneId: string): Promise<ChatMessage[]> {
  const prisma = getPrisma();
  const scene = await prisma.scene.findUnique({ where: { id: sceneId } });

  if (!scene) {
    throw new Error("Scene not found.");
  }

  const messages = await prisma.chatMessage.findMany({
    where: { sceneId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((message) => mapChat(message as ChatRow));
}

export async function addChatMessage(
  sceneId: string,
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  const prisma = getPrisma();
  const scene = await prisma.scene.findUnique({ where: { id: sceneId } });

  if (!scene) {
    throw new Error("Scene not found.");
  }

  const message = await prisma.chatMessage.create({
    data: {
      novelId: scene.novelId,
      sceneId,
      authorName: input.authorName,
      authorColor: input.authorColor,
      body: input.body,
    },
  });

  return mapChat(message as ChatRow);
}

export async function saveDocumentState(sceneId: string, update: Uint8Array) {
  const prisma = getPrisma();
  const scene = await prisma.scene.findUnique({ where: { id: sceneId } });

  if (!scene) {
    throw new Error("Scene not found.");
  }

  const bytes = Buffer.from(update);

  await prisma.documentSnapshot.upsert({
    where: { sceneId },
    create: {
      novelId: scene.novelId,
      sceneId,
      update: bytes,
      version: 1,
    },
    update: {
      update: bytes,
      version: { increment: 1 },
    },
  });
}

export async function loadDocumentState(
  sceneId: string,
): Promise<Uint8Array | null> {
  const prisma = getPrisma();
  const snapshot = await prisma.documentSnapshot.findUnique({
    where: { sceneId },
  });

  return snapshot ? Uint8Array.from(snapshot.update) : null;
}

export async function exportNovelAsMarkdown(novelId: string) {
  const { yUpdateToPlainText } = await import("@/lib/y-export");
  const prisma = getPrisma();
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: novelInclude,
  });

  if (!novel) {
    throw new Error("Novel not found.");
  }

  const snapshots = await prisma.documentSnapshot.findMany({
    where: { novelId },
  });
  const snapshotByScene = new Map(snapshots.map((row) => [row.sceneId, row]));

  const lines = [`# ${novel.title}`, "", `_${novel.logline}_`, ""];

  for (const chapter of novel.chapters) {
    lines.push(`## ${chapter.title}`, "");

    for (const scene of chapter.scenes) {
      const snapshot = snapshotByScene.get(scene.id);
      const text = yUpdateToPlainText(
        snapshot ? Uint8Array.from(snapshot.update) : null,
      );

      lines.push(`### ${scene.title}`, "");
      lines.push(text || `_${scene.summary || "No manuscript text yet."}_`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
