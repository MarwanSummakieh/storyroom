"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Circle,
  Command,
  Download,
  Feather,
  FilePlus2,
  Hash,
  Library,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Radio,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CommandPalette,
  type CommandAction,
} from "@/components/storyroom/command-palette";
import { useTheme } from "@/components/storyroom/use-theme";
import type {
  ChatMessage,
  Novel,
  PresenceUser,
  Scene,
  SceneStatus,
  StoryBibleEntry,
  StoryBibleKind,
  UserIdentity,
} from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { statelessMessageSchema } from "@/lib/validation";

const authorColors = ["#7c3aed", "#0d9488", "#e11d48", "#2563eb", "#d97706"];

const statusTone: Record<SceneStatus, "neutral" | "accent" | "positive" | "warning" | "danger"> = {
  draft: "neutral",
  revising: "warning",
  review: "accent",
  locked: "danger",
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}

function makeLocalIdentity(): UserIdentity {
  const suffix = Math.floor(Math.random() * 900 + 100);
  const color = authorColors[Math.floor(Math.random() * authorColors.length)];

  return {
    id: crypto.randomUUID(),
    name: `Author ${suffix}`,
    color,
  };
}

function useStoredIdentity() {
  const [identity, setIdentity] = useState<UserIdentity>({
    id: "local-author",
    name: "Author",
    color: authorColors[0],
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("storyroom.identity");
        const next = stored
          ? (JSON.parse(stored) as UserIdentity)
          : makeLocalIdentity();
        setIdentity(next);
      } catch {
        setIdentity(makeLocalIdentity());
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("storyroom.identity", JSON.stringify(identity));
  }, [identity]);

  return [identity, setIdentity] as const;
}

function useSceneProvider(
  sceneId: string | null,
  identity: UserIdentity,
  onPresenceChange: (users: PresenceUser[]) => void,
  onChatCreated: (message: ChatMessage) => void,
) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  // Keep the latest identity in a ref so the provider effect can read it on
  // setup without re-running (and tearing down the socket) on every keystroke.
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    if (!sceneId) {
      const timeout = window.setTimeout(() => {
        setProvider(null);
        setStatus("disconnected");
      }, 0);
      onPresenceChange([]);
      return () => window.clearTimeout(timeout);
    }

    const document = new Y.Doc();
    const nextProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234",
      name: sceneId,
      document,
      onOpen: () => setStatus("connecting"),
      onSynced: () => setStatus("connected"),
      onClose: () => setStatus("disconnected"),
      onAwarenessChange: ({ states }) => {
        const users = states
          .map((state) => {
            const user = state.user as UserIdentity | undefined;
            if (!user) {
              return null;
            }

            return {
              ...user,
              clientId: state.clientId,
              activeSceneId: state.activeSceneId as string | undefined,
              status: (state.status as PresenceUser["status"]) ?? "editing",
            };
          })
          .filter(Boolean) as PresenceUser[];

        onPresenceChange(users);
      },
      onStateless: ({ payload }) => {
        try {
          const parsedJson = JSON.parse(payload);
          const parsed = statelessMessageSchema.safeParse(parsedJson);

          if (parsed.success && parsed.data.type === "chat:created") {
            onChatCreated(parsed.data.message);
          }
        } catch {
          // Ignore malformed stateless payloads from other clients.
        }
      },
    });

    nextProvider.setAwarenessField("user", identityRef.current);
    nextProvider.setAwarenessField("activeSceneId", sceneId);
    nextProvider.setAwarenessField("status", "editing");
    const providerReadyTimeout = window.setTimeout(() => {
      setProvider(nextProvider);
    }, 0);

    return () => {
      window.clearTimeout(providerReadyTimeout);
      nextProvider.destroy();
      document.destroy();
    };
  }, [onChatCreated, onPresenceChange, sceneId]);

  // Push identity edits into awareness without rebuilding the provider so the
  // display-name field keeps focus while typing.
  useEffect(() => {
    if (!provider) {
      return;
    }
    provider.setAwarenessField("user", identity);
  }, [provider, identity]);

  return { provider, status };
}

export function StoryroomApp({ novelId }: { novelId: string }) {
  const router = useRouter();
  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useStoredIdentity();
  const { theme, toggle: toggleTheme } = useTheme();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"bible" | "chat">("bible");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const loadNovel = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const novel = await requestJson<Novel>(`/api/novels/${novelId}`);
      setActiveNovel(novel);
      setActiveSceneId((current) => {
        const scenes = novel.chapters.flatMap((chapter) => chapter.scenes);
        return scenes.some((scene) => scene.id === current)
          ? current
          : scenes[0]?.id ?? null;
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load this novel.",
      );
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadNovel();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadNovel]);

  const goToDashboard = useCallback(() => router.push("/"), [router]);

  const allScenes = useMemo(
    () => activeNovel?.chapters.flatMap((chapter) => chapter.scenes) ?? [],
    [activeNovel],
  );

  const activeScene = useMemo(
    () => allScenes.find((scene) => scene.id === activeSceneId) ?? null,
    [allScenes, activeSceneId],
  );

  useEffect(() => {
    if (!activeSceneId) {
      const timeout = window.setTimeout(() => setMessages([]), 0);
      return () => window.clearTimeout(timeout);
    }

    void requestJson<ChatMessage[]>(`/api/scenes/${activeSceneId}/chat`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeSceneId]);

  const handleChatCreated = useCallback((message: ChatMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) {
        return current;
      }
      return [...current, message];
    });
  }, []);

  const handlePresenceChange = useCallback((users: PresenceUser[]) => {
    setPresence(users);
  }, []);

  const { provider, status } = useSceneProvider(
    activeSceneId,
    identity,
    handlePresenceChange,
    handleChatCreated,
  );

  const createNovelFromPrompt = useCallback(async () => {
    const novel = await requestJson<Novel>("/api/novels", {
      method: "POST",
      body: JSON.stringify({
        title: "Untitled Novel",
        logline: "A shared draft waiting for its first impossible sentence.",
        genre: "Collaborative fiction",
      }),
    });

    router.push(`/novel/${novel.id}`);
  }, [router]);

  // Optimistic field updates: patch local state immediately, persist, and
  // reload from the server only if the request fails (to revert).
  const updateNovelField = useCallback(
    async (patch: Partial<Pick<Novel, "title" | "logline" | "genre">>) => {
      if (!activeNovel) {
        return;
      }
      const novelId = activeNovel.id;
      setActiveNovel((current) => (current ? { ...current, ...patch } : current));
      try {
        await requestJson(`/api/novels/${novelId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } catch {
        void loadNovel();
      }
    },
    [activeNovel, loadNovel],
  );

  const patchScene = useCallback(
    async (
      sceneId: string,
      patch: Partial<Pick<Scene, "title" | "summary" | "status">>,
    ) => {
      setActiveNovel((current) =>
        current
          ? {
              ...current,
              chapters: current.chapters.map((chapter) => ({
                ...chapter,
                scenes: chapter.scenes.map((scene) =>
                  scene.id === sceneId ? { ...scene, ...patch } : scene,
                ),
              })),
            }
          : current,
      );
      try {
        await requestJson(`/api/scenes/${sceneId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } catch {
        void loadNovel();
      }
    },
    [loadNovel],
  );

  const patchChapter = useCallback(
    async (chapterId: string, title: string) => {
      setActiveNovel((current) =>
        current
          ? {
              ...current,
              chapters: current.chapters.map((chapter) =>
                chapter.id === chapterId ? { ...chapter, title } : chapter,
              ),
            }
          : current,
      );
      try {
        await requestJson(`/api/chapters/${chapterId}`, {
          method: "PATCH",
          body: JSON.stringify({ title }),
        });
      } catch {
        void loadNovel();
      }
    },
    [loadNovel],
  );

  const patchBibleEntry = useCallback(
    async (
      entryId: string,
      patch: Partial<Pick<StoryBibleEntry, "title" | "body" | "kind">>,
    ) => {
      setActiveNovel((current) =>
        current
          ? {
              ...current,
              storyBible: current.storyBible.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            }
          : current,
      );
      try {
        await requestJson(`/api/story-bible/${entryId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } catch {
        void loadNovel();
      }
    },
    [loadNovel],
  );

  const deleteCurrentNovel = useCallback(async () => {
    if (!activeNovel) {
      return;
    }
    if (
      !window.confirm(
        `Delete "${activeNovel.title}"? This permanently removes its scenes, manuscript, bible, and chat.`,
      )
    ) {
      return;
    }

    await requestJson(`/api/novels/${activeNovel.id}`, { method: "DELETE" });
    router.push("/");
  }, [activeNovel, router]);

  const createScene = useCallback(async () => {
    if (!activeNovel?.chapters[0]) {
      return;
    }

    const scene = await requestJson<Scene>(
      `/api/novels/${activeNovel.id}/scenes`,
      {
        method: "POST",
        body: JSON.stringify({
          chapterId: activeNovel.chapters[0].id,
          title: "New Scene",
          summary: "A fresh co-writing space.",
        }),
      },
    );

    await loadNovel();
    setActiveSceneId(scene.id);
  }, [activeNovel, loadNovel]);

  const addCanonFact = useCallback(async () => {
    if (!activeNovel) {
      return;
    }

    await requestJson(`/api/novels/${activeNovel.id}/story-bible`, {
      method: "POST",
      body: JSON.stringify({
        kind: "canon" satisfies StoryBibleKind,
        title: "New Canon Fact",
        body: "Add the rule, promise, or contradiction everyone needs to remember.",
        tags: ["canon"],
      }),
    });

    await loadNovel();
    setRightTab("bible");
    setRightOpen(true);
  }, [activeNovel, loadNovel]);

  const exportNovel = useCallback(() => {
    if (activeNovel) {
      window.open(`/api/novels/${activeNovel.id}/export`, "_blank");
    }
  }, [activeNovel]);

  const sendChatMessage = useCallback(
    (body: string) => {
      if (!provider || !body.trim()) {
        return;
      }

      provider.sendStateless(
        JSON.stringify({
          type: "chat:message",
          clientMessageId: crypto.randomUUID(),
          authorName: identity.name,
          authorColor: identity.color,
          body,
        }),
      );
    },
    [provider, identity.name, identity.color],
  );

  // Global command-palette shortcut.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focused = !leftOpen && !rightOpen;

  const commandActions = useMemo<CommandAction[]>(() => {
    const actions: CommandAction[] = [
      {
        id: "new-scene",
        group: "Create",
        label: "New scene",
        icon: <FilePlus2 className="h-4 w-4" />,
        keywords: "add chapter writing",
        run: () => void createScene(),
      },
      {
        id: "new-novel",
        group: "Create",
        label: "New novel",
        icon: <Plus className="h-4 w-4" />,
        keywords: "book project",
        run: () => void createNovelFromPrompt(),
      },
      {
        id: "add-canon",
        group: "Create",
        label: "Add canon fact",
        icon: <Sparkles className="h-4 w-4" />,
        keywords: "story bible lore rule",
        run: () => void addCanonFact(),
      },
      {
        id: "back-to-projects",
        group: "Project",
        label: "Back to all projects",
        icon: <ArrowLeft className="h-4 w-4" />,
        keywords: "home dashboard novels list exit",
        run: goToDashboard,
      },
      {
        id: "export",
        group: "Project",
        label: "Export novel as Markdown",
        icon: <Download className="h-4 w-4" />,
        keywords: "download save md",
        run: exportNovel,
      },
      {
        id: "delete-novel",
        group: "Project",
        label: "Delete this novel",
        icon: <Trash2 className="h-4 w-4" />,
        keywords: "remove destroy trash",
        run: () => void deleteCurrentNovel(),
      },
      {
        id: "toggle-theme",
        group: "View",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon:
          theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          ),
        keywords: "dark light mode appearance",
        run: toggleTheme,
      },
      {
        id: "focus-mode",
        group: "View",
        label: focused ? "Exit focus mode" : "Enter focus mode",
        icon: focused ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        ),
        keywords: "hide panels distraction free zen",
        run: () => {
          const next = focused;
          setLeftOpen(next);
          setRightOpen(next);
        },
      },
      {
        id: "toggle-left",
        group: "View",
        label: leftOpen ? "Hide scene panel" : "Show scene panel",
        icon: <PanelLeft className="h-4 w-4" />,
        run: () => setLeftOpen((open) => !open),
      },
      {
        id: "toggle-right",
        group: "View",
        label: rightOpen ? "Hide bible & chat panel" : "Show bible & chat panel",
        icon: <PanelRight className="h-4 w-4" />,
        run: () => setRightOpen((open) => !open),
      },
    ];

    for (const scene of allScenes) {
      actions.push({
        id: `scene-${scene.id}`,
        group: "Go to scene",
        label: scene.title,
        hint: scene.status,
        icon: <Hash className="h-4 w-4" />,
        keywords: `${scene.summary} scene`,
        run: () => setActiveSceneId(scene.id),
      });
    }

    return actions;
  }, [
    addCanonFact,
    allScenes,
    createNovelFromPrompt,
    createScene,
    deleteCurrentNovel,
    exportNovel,
    focused,
    goToDashboard,
    leftOpen,
    rightOpen,
    theme,
    toggleTheme,
  ]);

  if (loading && !activeNovel) {
    return <LoadingWorkspace />;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-danger">
            This novel could not load.
          </p>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={goToDashboard}>
              <ArrowLeft className="h-4 w-4" />
              All projects
            </Button>
            <Button onClick={() => void loadNovel()}>Try again</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden bg-canvas text-ink">
        <TopBar
          novel={activeNovel}
          status={status}
          presence={presence}
          theme={theme}
          leftOpen={leftOpen}
          rightOpen={rightOpen}
          onBack={goToDashboard}
          onToggleLeft={() => setLeftOpen((open) => !open)}
          onToggleRight={() => setRightOpen((open) => !open)}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
          onExport={exportNovel}
        />

        <div className="flex min-h-0 flex-1">
          <LeftRail
            open={leftOpen}
            novel={activeNovel}
            activeSceneId={activeSceneId}
            identity={identity}
            onSelectScene={setActiveSceneId}
            onNewScene={() => void createScene()}
            onNewNovel={() => void createNovelFromPrompt()}
            onUpdateNovel={(patch) => void updateNovelField(patch)}
            onRenameChapter={(id, title) => void patchChapter(id, title)}
            onIdentityChange={setIdentity}
          />

          <EditorColumn
            identity={identity}
            provider={provider}
            scene={activeScene}
            status={status}
            presence={presence}
            onPatchScene={(id, patch) => void patchScene(id, patch)}
          />

          <RightRail
            open={rightOpen}
            tab={rightTab}
            onTab={setRightTab}
            novel={activeNovel}
            messages={messages}
            onQuickAdd={() => void addCanonFact()}
            onPatchEntry={(id, patch) => void patchBibleEntry(id, patch)}
            onSend={sendChatMessage}
            chatDisabled={!provider || status !== "connected"}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={commandActions}
      />
    </>
  );
}

function TopBar({
  novel,
  status,
  presence,
  theme,
  leftOpen,
  rightOpen,
  onBack,
  onToggleLeft,
  onToggleRight,
  onToggleTheme,
  onOpenPalette,
  onExport,
}: {
  novel: Novel | null;
  status: ConnectionStatus;
  presence: PresenceUser[];
  theme: "light" | "dark";
  leftOpen: boolean;
  rightOpen: boolean;
  onBack: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onExport: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <IconButton label="Back to all projects" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </IconButton>

      <IconButton
        label={leftOpen ? "Hide scene panel" : "Show scene panel"}
        active={leftOpen}
        onClick={onToggleLeft}
      >
        <PanelLeft className="h-4 w-4" />
      </IconButton>

      <button
        onClick={onBack}
        className="flex items-center gap-2 rounded-lg px-1 text-left transition-opacity hover:opacity-80"
        title="Back to all projects"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm">
          <Feather className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">
            Storyroom
          </p>
          <p className="max-w-[28vw] truncate text-sm font-semibold text-ink">
            {novel?.title ?? "No novel"}
          </p>
        </div>
      </button>

      <button
        onClick={onOpenPalette}
        className="ml-2 hidden items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-subtle transition-colors hover:text-ink md:flex"
      >
        <Command className="h-3.5 w-3.5" />
        Search & commands
        <kbd className="ml-2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <StatusPill status={status} />
        <PresenceStrip users={presence} />

        {novel ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onExport}
            className="hidden sm:inline-flex"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        ) : null}

        <IconButton
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </IconButton>

        <IconButton
          label={rightOpen ? "Hide bible & chat panel" : "Show bible & chat panel"}
          active={rightOpen}
          onClick={onToggleRight}
        >
          <PanelRight className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
        active
          ? "border-line-strong bg-surface-2 text-ink"
          : "border-transparent text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const meta = {
    connected: { label: "Live", className: "text-positive" },
    connecting: { label: "Syncing", className: "text-warning" },
    disconnected: { label: "Offline", className: "text-danger" },
  }[status];

  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted sm:inline-flex">
      <Circle className={cn("h-2 w-2 fill-current", meta.className)} />
      {meta.label}
    </span>
  );
}

const sceneStatuses: SceneStatus[] = ["draft", "revising", "review", "locked"];
const bibleKinds: StoryBibleKind[] = ["character", "place", "lore", "canon"];

function EditableText({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  allowEmpty = false,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(value);
      return;
    }
    const next = draft.trim();
    if (next === value || (!next && !allowEmpty)) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          inputRef.current?.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelRef.current = true;
          inputRef.current?.blur();
        }
      }}
      aria-label={ariaLabel}
      className={cn(
        "-mx-1 rounded-md bg-transparent px-1 outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-[var(--accent-ring)]",
        className,
      )}
    />
  );
}

function EditableTextarea({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);

  const commit = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setDraft(value);
      return;
    }
    const next = draft.trim();
    if (next === value || !next) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };

  return (
    <textarea
      ref={ref}
      value={draft}
      placeholder={placeholder}
      rows={3}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelRef.current = true;
          ref.current?.blur();
        } else if (
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      aria-label={ariaLabel}
      className={cn(
        "-mx-1 w-full resize-none rounded-md bg-transparent px-1 py-0.5 outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-[var(--accent-ring)]",
        className,
      )}
    />
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: SceneStatus;
  onChange: (status: SceneStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as SceneStatus)}
      aria-label="Scene status"
      className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium capitalize text-muted outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
    >
      {sceneStatuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function LeftRail({
  open,
  novel,
  activeSceneId,
  identity,
  onSelectScene,
  onNewScene,
  onNewNovel,
  onUpdateNovel,
  onRenameChapter,
  onIdentityChange,
}: {
  open: boolean;
  novel: Novel | null;
  activeSceneId: string | null;
  identity: UserIdentity;
  onSelectScene: (id: string) => void;
  onNewScene: () => void;
  onNewNovel: () => void;
  onUpdateNovel: (
    patch: Partial<Pick<Novel, "title" | "logline" | "genre">>,
  ) => void;
  onRenameChapter: (chapterId: string, title: string) => void;
  onIdentityChange: (
    updater: (current: UserIdentity) => UserIdentity,
  ) => void;
}) {
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden border-r border-line bg-surface transition-[width] duration-200 ease-out",
        open ? "w-[290px]" : "w-0",
      )}
    >
      <div className="flex h-full w-[290px] flex-col">
        <div className="border-b border-line p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {novel ? (
                <EditableText
                  key={`title-${novel.id}`}
                  value={novel.title}
                  onCommit={(title) => onUpdateNovel({ title })}
                  ariaLabel="Novel title"
                  className="w-full truncate text-base font-semibold tracking-tight text-ink"
                />
              ) : (
                <p className="px-1 text-base font-semibold tracking-tight text-ink">
                  No novel
                </p>
              )}
              {novel ? (
                <EditableTextarea
                  key={`logline-${novel.id}`}
                  value={novel.logline}
                  onCommit={(logline) => onUpdateNovel({ logline })}
                  ariaLabel="Logline"
                  placeholder="One-line premise…"
                  className="mt-1 text-xs leading-5 text-muted"
                />
              ) : (
                <p className="mt-1 px-1 text-xs leading-5 text-muted">
                  Create a novel to start collaborating.
                </p>
              )}
            </div>
            <Button
              aria-label="Create novel"
              title="Create novel"
              size="icon"
              variant="secondary"
              onClick={onNewNovel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {novel ? (
            <EditableText
              key={`genre-${novel.id}`}
              value={novel.genre}
              onCommit={(genre) => onUpdateNovel({ genre })}
              ariaLabel="Genre"
              className="mt-3 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium capitalize text-accent-strong"
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
            Scenes
          </p>
          <Button size="sm" variant="ghost" onClick={onNewScene}>
            <FilePlus2 className="h-4 w-4" />
            New
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 pb-4">
          {novel?.chapters.map((chapter) => (
            <div key={chapter.id}>
              <EditableText
                key={`chapter-${chapter.id}`}
                value={chapter.title}
                onCommit={(title) => onRenameChapter(chapter.id, title)}
                ariaLabel="Chapter title"
                className="mb-1.5 w-full truncate text-[11px] font-semibold uppercase tracking-wide text-subtle"
              />
              <div className="space-y-1">
                {chapter.scenes.map((scene) => {
                  const active = scene.id === activeSceneId;
                  return (
                    <button
                      key={scene.id}
                      onClick={() => onSelectScene(scene.id)}
                      className={cn(
                        "group w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                        active
                          ? "border-transparent bg-accent-soft"
                          : "border-transparent hover:bg-surface-2",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            active ? "text-accent-strong" : "text-ink",
                          )}
                        >
                          {scene.title}
                        </span>
                        <Badge tone={statusTone[scene.status]}>
                          {scene.status}
                        </Badge>
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs text-muted">
                        {scene.summary || "No scene note yet."}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line p-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
            You
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Avatar name={identity.name} color={identity.color} />
            <Input
              aria-label="Display name"
              value={identity.name}
              onChange={(event) =>
                onIdentityChange((current) => ({
                  ...current,
                  name: event.target.value || "Author",
                }))
              }
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {authorColors.map((color) => (
              <button
                key={color}
                aria-label={`Use color ${color}`}
                onClick={() =>
                  onIdentityChange((current) => ({ ...current, color }))
                }
                className={cn(
                  "h-5 w-5 rounded-full ring-2 transition-transform hover:scale-110",
                  identity.color === color
                    ? "ring-ink"
                    : "ring-transparent",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function EditorColumn({
  provider,
  scene,
  identity,
  status,
  presence,
  onPatchScene,
}: {
  provider: HocuspocusProvider | null;
  scene: Scene | null;
  identity: UserIdentity;
  status: ConnectionStatus;
  presence: PresenceUser[];
  onPatchScene: (
    sceneId: string,
    patch: Partial<Pick<Scene, "title" | "summary" | "status">>,
  ) => void;
}) {
  if (!scene) {
    return (
      <section className="flex min-w-0 flex-1 items-center justify-center bg-canvas p-6 text-center text-sm text-muted">
        Select or create a scene to start writing.
      </section>
    );
  }

  if (!provider) {
    return (
      <section className="flex min-w-0 flex-1 items-center justify-center bg-canvas p-6 text-sm text-muted">
        Preparing collaborative document…
      </section>
    );
  }

  return (
    <EditorSurface
      key={`${scene.id}-${provider.document.clientID}`}
      identity={identity}
      provider={provider}
      scene={scene}
      status={status}
      presence={presence}
      onPatchScene={onPatchScene}
    />
  );
}

function EditorSurface({
  provider,
  scene,
  identity,
  status,
  presence,
  onPatchScene,
}: {
  provider: HocuspocusProvider;
  scene: Scene;
  identity: UserIdentity;
  status: ConnectionStatus;
  presence: PresenceUser[];
  onPatchScene: (
    sceneId: string,
    patch: Partial<Pick<Scene, "title" | "summary" | "status">>,
  ) => void;
}) {
  const [words, setWords] = useState(0);

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: "end",
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Placeholder.configure({
          placeholder:
            "Write the scene here. Open another tab and the manuscript will sync live.",
        }),
        Collaboration.configure({
          document: provider.document,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: identity.name,
            color: identity.color,
          },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-260px)] text-[18px] leading-8",
          "aria-label": "Collaborative manuscript editor",
        },
      },
      onCreate: ({ editor }) => {
        const text = editor.getText().trim();
        setWords(text ? text.split(/\s+/).length : 0);
      },
      onUpdate: ({ editor }) => {
        const text = editor.getText().trim();
        setWords(text ? text.split(/\s+/).length : 0);
      },
    },
    [provider],
  );

  // Update the shared cursor label/color in place instead of rebuilding the
  // editor (which would steal focus) whenever the author renames themselves.
  useEffect(() => {
    editor
      ?.chain()
      .updateUser({ name: identity.name, color: identity.color })
      .run();
  }, [editor, identity.name, identity.color]);

  const collaborators = presence.filter(
    (user) => user.activeSceneId === scene.id,
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-canvas">
      <div className="border-b border-line bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EditableText
            key={`scene-title-${scene.id}`}
            value={scene.title}
            onCommit={(title) => onPatchScene(scene.id, { title })}
            ariaLabel="Scene title"
            className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink"
          />
          <StatusSelect
            value={scene.status}
            onChange={(nextStatus) =>
              onPatchScene(scene.id, { status: nextStatus })
            }
          />
          <div className="flex items-center gap-3 text-xs text-subtle">
            <span>{words.toLocaleString()} words</span>
            <span className="h-3 w-px bg-line" />
            <span>
              {status === "connected" ? "Saved · CRDT" : "Sync pending"}
            </span>
          </div>
        </div>
        <EditableText
          key={`scene-summary-${scene.id}`}
          value={scene.summary}
          onCommit={(summary) => onPatchScene(scene.id, { summary })}
          ariaLabel="Scene summary"
          placeholder="Add a scene summary…"
          allowEmpty
          className="mt-1 w-full truncate text-sm text-muted"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[46rem] px-6 py-10">
          {collaborators.length > 1 ? (
            <p className="mb-4 text-xs text-subtle">
              {collaborators.length} authors in this scene
            </p>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  );
}

function RightRail({
  open,
  tab,
  onTab,
  novel,
  messages,
  onQuickAdd,
  onPatchEntry,
  onSend,
  chatDisabled,
}: {
  open: boolean;
  tab: "bible" | "chat";
  onTab: (tab: "bible" | "chat") => void;
  novel: Novel | null;
  messages: ChatMessage[];
  onQuickAdd: () => void;
  onPatchEntry: (
    entryId: string,
    patch: Partial<Pick<StoryBibleEntry, "title" | "body" | "kind">>,
  ) => void;
  onSend: (body: string) => void;
  chatDisabled: boolean;
}) {
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden border-l border-line bg-surface transition-[width] duration-200 ease-out",
        open ? "w-[360px]" : "w-0",
      )}
    >
      <div className="flex h-full w-[360px] flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-line p-2">
          <RailTab
            active={tab === "bible"}
            onClick={() => onTab("bible")}
            icon={<Library className="h-4 w-4" />}
          >
            Story bible
          </RailTab>
          <RailTab
            active={tab === "chat"}
            onClick={() => onTab("chat")}
            icon={<MessageSquareText className="h-4 w-4" />}
          >
            Chat
            {messages.length ? (
              <span className="ml-1 rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">
                {messages.length}
              </span>
            ) : null}
          </RailTab>
        </div>

        {tab === "bible" ? (
          <StoryBiblePanel
            novel={novel}
            onQuickAdd={onQuickAdd}
            onPatchEntry={onPatchEntry}
          />
        ) : (
          <ChatPanel
            messages={messages}
            onSend={onSend}
            disabled={chatDisabled}
          />
        )}
      </div>
    </aside>
  );
}

function RailTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-surface-2 text-ink"
          : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function LoadingWorkspace() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-surface-3" />
        <div className="mt-5 h-9 w-64 animate-pulse rounded bg-surface-3" />
        <div className="mt-6 space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-surface-3" />
          <div className="h-16 animate-pulse rounded-lg bg-surface-3" />
        </div>
      </div>
    </main>
  );
}

function PresenceStrip({ users }: { users: PresenceUser[] }) {
  if (!users.length) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-subtle lg:flex">
        <Users className="h-3.5 w-3.5" />
        Solo
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-full border border-line bg-surface-2 py-1 pl-2 pr-3">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user) => (
          <Avatar
            key={`${user.clientId}-${user.id}`}
            name={user.name}
            color={user.color}
            size="sm"
          />
        ))}
      </div>
      <span className="ml-2 text-xs font-medium text-muted">
        {users.length} live
      </span>
    </div>
  );
}

function StoryBiblePanel({
  novel,
  onQuickAdd,
  onPatchEntry,
}: {
  novel: Novel | null;
  onQuickAdd: () => void;
  onPatchEntry: (
    entryId: string,
    patch: Partial<Pick<StoryBibleEntry, "title" | "body" | "kind">>,
  ) => void;
}) {
  const entries = novel?.storyBible ?? [];

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <p className="text-xs text-muted">
          Shared facts, people, places, and lore.
        </p>
        <Button size="sm" variant="secondary" onClick={onQuickAdd}>
          <Sparkles className="h-4 w-4" />
          Canon
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto p-4 pt-2">
        {entries.length ? (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-line bg-surface-2 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <EditableText
                  key={`bible-title-${entry.id}`}
                  value={entry.title}
                  onCommit={(title) => onPatchEntry(entry.id, { title })}
                  ariaLabel="Entry title"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-ink"
                />
                <select
                  value={entry.kind}
                  onChange={(event) =>
                    onPatchEntry(entry.id, {
                      kind: event.target.value as StoryBibleKind,
                    })
                  }
                  aria-label="Entry kind"
                  className="rounded-full border border-transparent bg-accent-soft px-2 py-0.5 text-[11px] font-medium capitalize text-accent-strong outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
                >
                  {bibleKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <EditableTextarea
                key={`bible-body-${entry.id}`}
                value={entry.body}
                onCommit={(body) => onPatchEntry(entry.id, { body })}
                ariaLabel="Entry body"
                placeholder="Describe this fact, person, place, or rule…"
                className="mt-2 text-sm leading-6 text-muted"
              />
              {entry.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
            No canon yet. Add a fact before continuity gets slippery.
          </div>
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  messages,
  onSend,
  disabled,
}: {
  messages: ChatMessage[];
  onSend: (body: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <p className="flex items-center gap-2 px-4 pb-2 pt-3 text-xs text-muted">
        <Radio className="h-3.5 w-3.5" />
        Stateless WebSocket messages, persisted after broadcast.
      </p>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4">
        {messages.map((message) => (
          <div key={message.id} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <Avatar
                name={message.authorName}
                color={message.authorColor}
                size="sm"
              />
              <span className="text-sm font-medium text-ink">
                {message.authorName}
              </span>
              <span className="ml-auto text-xs text-subtle">
                {formatTime(message.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{message.body}</p>
          </div>
        ))}
        {!messages.length ? (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
            No messages for this scene yet.
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="space-y-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
          setDraft("");
        }}
      >
        <Textarea
          aria-label="Scene chat message"
          disabled={disabled}
          placeholder={
            disabled ? "Connect to realtime to chat." : "Discuss this scene…"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSend(draft);
              setDraft("");
            }
          }}
        />
        <Button className="w-full" disabled={disabled || !draft.trim()}>
          Send message
        </Button>
      </form>
    </section>
  );
}
