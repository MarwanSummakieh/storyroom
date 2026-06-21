"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BookOpen,
  Circle,
  Download,
  FilePlus2,
  Library,
  MessageSquareText,
  Plus,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ChatMessage,
  Novel,
  PresenceUser,
  Scene,
  StoryBibleKind,
  UserIdentity,
  WorkspacePayload,
} from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { statelessMessageSchema } from "@/lib/validation";

const authorColors = ["#059669", "#be123c", "#0891b2", "#4f46e5", "#52525b"];

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

    nextProvider.setAwarenessField("user", identity);
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
  }, [identity, onChatCreated, onPresenceChange, sceneId]);

  return { provider, status };
}

export function StoryroomApp() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [activeNovel, setActiveNovel] = useState<Novel | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useStoredIdentity();

  const loadWorkspace = useCallback(async (preferredNovelId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await requestJson<WorkspacePayload>("/api/novels");
      const selectedNovel =
        payload.activeNovel?.id === preferredNovelId || !preferredNovelId
          ? payload.activeNovel
          : await requestJson<Novel>(`/api/novels/${preferredNovelId}`);

      setWorkspace(payload);
      setActiveNovel(selectedNovel);
      setActiveSceneId((current) => {
        const scenes = selectedNovel?.chapters.flatMap((chapter) => chapter.scenes) ?? [];
        return scenes.some((scene) => scene.id === current)
          ? current
          : scenes[0]?.id ?? null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Storyroom.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadWorkspace]);

  const activeScene = useMemo(() => {
    return (
      activeNovel?.chapters
        .flatMap((chapter) => chapter.scenes)
        .find((scene) => scene.id === activeSceneId) ?? null
    );
  }, [activeNovel, activeSceneId]);

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

  async function createNovelFromPrompt() {
    const novel = await requestJson<Novel>("/api/novels", {
      method: "POST",
      body: JSON.stringify({
        title: "Untitled Collaboration",
        logline: "A shared draft waiting for its first impossible sentence.",
        genre: "Collaborative fiction",
      }),
    });

    await loadWorkspace(novel.id);
    setActiveSceneId(novel.chapters[0]?.scenes[0]?.id ?? null);
  }

  async function createScene() {
    if (!activeNovel?.chapters[0]) {
      return;
    }

    const scene = await requestJson<Scene>(`/api/novels/${activeNovel.id}/scenes`, {
      method: "POST",
      body: JSON.stringify({
        chapterId: activeNovel.chapters[0].id,
        title: "New Scene",
        summary: "A fresh co-writing space.",
      }),
    });

    await loadWorkspace(activeNovel.id);
    setActiveSceneId(scene.id);
  }

  async function addCanonFact() {
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

    await loadWorkspace(activeNovel.id);
  }

  function sendChatMessage(body: string) {
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
  }

  if (loading && !workspace) {
    return <LoadingWorkspace />;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <div className="max-w-md rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-700">Storyroom could not load.</p>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <Button className="mt-4" onClick={() => void loadWorkspace()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="border-b border-zinc-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <BookOpen className="h-4 w-4" />
                Storyroom
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">
                {activeNovel?.title ?? "No novel"}
              </h1>
            </div>
            <Button
              aria-label="Create novel"
              title="Create novel"
              size="icon"
              variant="secondary"
              onClick={() => void createNovelFromPrompt()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {activeNovel?.logline ?? "Create a novel to start collaborating."}
          </p>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Scenes</h2>
              <Button size="sm" variant="ghost" onClick={() => void createScene()}>
                <FilePlus2 className="h-4 w-4" />
                Scene
              </Button>
            </div>

            <div className="mt-3 space-y-4">
              {activeNovel?.chapters.map((chapter) => (
                <div key={chapter.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {chapter.title}
                  </p>
                  <div className="mt-2 space-y-2">
                    {chapter.scenes.map((scene) => (
                      <button
                        key={scene.id}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                          scene.id === activeSceneId
                            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                        onClick={() => setActiveSceneId(scene.id)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{scene.title}</span>
                          <Badge>{scene.status}</Badge>
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs text-zinc-500">
                          {scene.summary || "No scene note yet."}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Display name
            </label>
            <div className="mt-2 flex items-center gap-2">
              <Avatar name={identity.name} color={identity.color} />
              <Input
                aria-label="Display name"
                value={identity.name}
                onChange={(event) =>
                  setIdentity((current) => ({
                    ...current,
                    name: event.target.value || "Author",
                  }))
                }
              />
            </div>
          </section>
        </aside>

        <section className="flex min-h-[640px] min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <Circle
                  className={`h-2.5 w-2.5 fill-current ${
                    status === "connected"
                      ? "text-emerald-500"
                      : status === "connecting"
                        ? "text-cyan-500"
                        : "text-rose-500"
                  }`}
                />
                {status}
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {activeScene?.title ?? "Select a scene"}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <PresenceStrip users={presence} />
              {activeNovel ? (
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
                  href={`/api/novels/${activeNovel.id}/export`}
                >
                  <Download className="h-4 w-4" />
                  Export
                </a>
              ) : null}
            </div>
          </header>

          <CollaborativeEditor
            identity={identity}
            provider={provider}
            scene={activeScene}
            status={status}
          />
        </section>

        <aside className="grid border-t border-zinc-200 bg-white lg:border-l lg:border-t-0">
          <div className="grid min-h-[640px] grid-rows-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <StoryBiblePanel novel={activeNovel} onQuickAdd={() => void addCanonFact()} />
            <ChatPanel
              messages={messages}
              onSend={sendChatMessage}
              disabled={!provider || status !== "connected"}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function LoadingWorkspace() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="mt-5 h-9 w-64 animate-pulse rounded bg-zinc-200" />
        <div className="mt-6 space-y-3">
          <div className="h-16 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-16 animate-pulse rounded-md bg-zinc-200" />
        </div>
      </div>
    </main>
  );
}

function PresenceStrip({ users }: { users: PresenceUser[] }) {
  if (!users.length) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 sm:flex">
        <Users className="h-4 w-4" />
        Waiting for collaborators
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1">
      {users.slice(0, 5).map((user) => (
        <Avatar key={`${user.clientId}-${user.id}`} name={user.name} color={user.color} />
      ))}
      <span className="px-2 text-xs font-medium text-zinc-600">{users.length} live</span>
    </div>
  );
}

function CollaborativeEditor({
  provider,
  scene,
  identity,
  status,
}: {
  provider: HocuspocusProvider | null;
  scene: Scene | null;
  identity: UserIdentity;
  status: ConnectionStatus;
}) {
  if (!scene) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
        Select or create a scene to start writing.
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
        Preparing collaborative document...
      </div>
    );
  }

  return (
    <EditorSurface
      key={`${scene.id}-${provider.document.clientID}`}
      identity={identity}
      provider={provider}
      scene={scene}
      status={status}
    />
  );
}

function EditorSurface({
  provider,
  scene,
  identity,
  status,
}: {
  provider: HocuspocusProvider;
  scene: Scene;
  identity: UserIdentity;
  status: ConnectionStatus;
}) {
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
            "prose prose-zinc max-w-none focus:outline-none min-h-[calc(100vh-220px)] px-6 py-8 text-[17px] leading-8",
          "aria-label": "Collaborative manuscript editor",
        },
      },
    },
    [provider, identity.name, identity.color],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <Badge className="bg-white">{scene.status}</Badge>
          <span>{scene.summary || "No scene summary yet."}</span>
          <span className="ml-auto font-medium text-zinc-500">
            {status === "connected" ? "Saved through CRDT snapshots" : "Sync pending"}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto min-h-full max-w-4xl rounded-lg border border-zinc-200 bg-white shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function StoryBiblePanel({
  novel,
  onQuickAdd,
}: {
  novel: Novel | null;
  onQuickAdd: () => void;
}) {
  const entries = novel?.storyBible ?? [];

  return (
    <section className="min-h-0 overflow-auto border-b border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Library className="h-4 w-4 text-emerald-700" />
            Story bible
          </div>
          <p className="mt-1 text-xs text-zinc-500">Shared facts, people, places, and lore.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onQuickAdd}>
          <Sparkles className="h-4 w-4" />
          Canon
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold">{entry.title}</h3>
                <Badge>{entry.kind}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{entry.body}</p>
              {entry.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="text-xs text-zinc-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
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

  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText className="h-4 w-4 text-emerald-700" />
          Scene chat
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <Radio className="h-3.5 w-3.5" />
          Stateless WebSocket messages, persisted after broadcast.
        </p>
      </div>

      <div className="mt-4 min-h-0 space-y-3 overflow-auto pr-1">
        {messages.map((message) => (
          <div key={message.id} className="rounded-lg bg-zinc-50 p-3">
            <div className="flex items-center gap-2">
              <Avatar name={message.authorName} color={message.authorColor} size="sm" />
              <span className="text-sm font-medium">{message.authorName}</span>
              <span className="ml-auto text-xs text-zinc-500">{formatTime(message.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{message.body}</p>
          </div>
        ))}
        {!messages.length ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            No messages for this scene yet.
          </div>
        ) : null}
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
          setDraft("");
        }}
      >
        <Textarea
          aria-label="Scene chat message"
          disabled={disabled}
          placeholder={disabled ? "Connect to realtime to chat." : "Discuss this scene..."}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button className="w-full" disabled={disabled || !draft.trim()}>
          Send message
        </Button>
      </form>
    </section>
  );
}
