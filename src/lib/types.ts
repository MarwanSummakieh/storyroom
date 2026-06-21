export type StoryBibleKind = "character" | "place" | "lore" | "canon";

export type SceneStatus = "draft" | "revising" | "review" | "locked";

export type UserIdentity = {
  id: string;
  name: string;
  color: string;
};

export type Scene = {
  id: string;
  novelId: string;
  chapterId: string;
  title: string;
  summary: string;
  status: SceneStatus;
  position: number;
  updatedAt: string;
};

export type Chapter = {
  id: string;
  novelId: string;
  title: string;
  position: number;
  scenes: Scene[];
};

export type StoryBibleEntry = {
  id: string;
  novelId: string;
  kind: StoryBibleKind;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  novelId: string;
  sceneId: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string;
};

export type Novel = {
  id: string;
  title: string;
  logline: string;
  genre: string;
  roomId: string;
  updatedAt: string;
  chapters: Chapter[];
  storyBible: StoryBibleEntry[];
};

export type NovelSummary = Omit<Novel, "chapters" | "storyBible"> & {
  chapterCount: number;
  sceneCount: number;
  storyBibleCount: number;
};

export type WorkspacePayload = {
  novels: NovelSummary[];
  activeNovel: Novel | null;
};

export type PresenceUser = UserIdentity & {
  clientId: number;
  activeSceneId?: string;
  status?: "editing" | "reading";
};
