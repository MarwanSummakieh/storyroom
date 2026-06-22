import { z } from "zod";

export const createNovelSchema = z.object({
  title: z.string().trim().min(2).max(80),
  logline: z.string().trim().min(4).max(180),
  genre: z.string().trim().min(2).max(40).default("Speculative fiction"),
});

export const updateNovelSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  logline: z.string().trim().min(4).max(180).optional(),
  genre: z.string().trim().min(2).max(40).optional(),
});

export const createChapterSchema = z.object({
  title: z.string().trim().min(2).max(80),
});

export const updateChapterSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
});

export const updateStoryBibleEntrySchema = z.object({
  kind: z.enum(["character", "place", "lore", "canon"]).optional(),
  title: z.string().trim().min(2).max(80).optional(),
  body: z.string().trim().min(3).max(800).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
});

export const createSceneSchema = z.object({
  chapterId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(100),
  summary: z.string().trim().max(240).default(""),
});

export const updateSceneSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  summary: z.string().trim().max(240).optional(),
  status: z.enum(["draft", "revising", "review", "locked"]).optional(),
});

export const createStoryBibleEntrySchema = z.object({
  kind: z.enum(["character", "place", "lore", "canon"]),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(3).max(800),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
});

export const createChatMessageSchema = z.object({
  authorName: z.string().trim().min(1).max(32),
  authorColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  body: z.string().trim().min(1).max(800),
});

export const statelessMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat:message"),
    clientMessageId: z.string().trim().min(1).max(80),
    authorName: z.string().trim().min(1).max(32),
    authorColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
    body: z.string().trim().min(1).max(800),
  }),
  z.object({
    type: z.literal("chat:created"),
    message: z.object({
      id: z.string(),
      novelId: z.string(),
      sceneId: z.string(),
      authorName: z.string(),
      authorColor: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
  }),
]);

export type CreateNovelInput = z.infer<typeof createNovelSchema>;
export type UpdateNovelInput = z.infer<typeof updateNovelSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type UpdateStoryBibleEntryInput = z.infer<
  typeof updateStoryBibleEntrySchema
>;
export type CreateSceneInput = z.infer<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
export type CreateStoryBibleEntryInput = z.infer<typeof createStoryBibleEntrySchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
