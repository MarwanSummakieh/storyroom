"use client";

import {
  BookOpen,
  Clock,
  Feather,
  FileText,
  Library,
  Moon,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/storyroom/use-theme";
import type { NovelSummary, WorkspacePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Request failed.");
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function Dashboard() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const [novels, setNovels] = useState<NovelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await requestJson<WorkspacePayload>("/api/novels");
      setNovels(payload.novels);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load your novels.",
      );
      setNovels([]);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const createNovel = useCallback(async () => {
    setBusy(true);
    try {
      const novel = await requestJson<{ id: string }>("/api/novels", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled Novel",
          logline: "A shared draft waiting for its first impossible sentence.",
          genre: "Collaborative fiction",
        }),
      });
      router.push(`/novel/${novel.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create novel.");
      setBusy(false);
    }
  }, [router]);

  const deleteNovel = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await requestJson(`/api/novels/${id}`, { method: "DELETE" });
        setConfirmId(null);
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete novel.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm">
          <Feather className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">
            Storyroom
          </p>
          <p className="text-sm font-semibold">Your projects</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            aria-label={
              theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
            }
            title={
              theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
            }
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <Button onClick={() => void createNovel()} disabled={busy}>
            <Plus className="h-4 w-4" />
            New novel
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Novels</h1>
            <p className="mt-1 text-sm text-muted">
              {novels === null
                ? "Loading…"
                : `${novels.length} ${novels.length === 1 ? "project" : "projects"} · open one to start co-writing`}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {novels === null ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-2xl border border-line bg-surface-2"
              />
            ))
          ) : novels.length === 0 ? (
            <EmptyState onCreate={() => void createNovel()} busy={busy} />
          ) : (
            novels.map((novel) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                confirming={confirmId === novel.id}
                busy={busy}
                onOpen={() => router.push(`/novel/${novel.id}`)}
                onAskDelete={() => setConfirmId(novel.id)}
                onCancelDelete={() => setConfirmId(null)}
                onConfirmDelete={() => void deleteNovel(novel.id)}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function NovelCard({
  novel,
  confirming,
  busy,
  onOpen,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  novel: NovelSummary;
  confirming: boolean;
  busy: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-surface transition-colors",
        confirming
          ? "border-danger/40"
          : "border-line hover:border-line-strong hover:bg-surface-2",
      )}
    >
      <button
        onClick={onOpen}
        className="flex flex-1 flex-col p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="flex items-start justify-between gap-2 pr-8">
          <h2 className="text-base font-semibold tracking-tight">
            {novel.title}
          </h2>
        </div>
        <Badge tone="accent" className="mt-2 self-start">
          {novel.genre}
        </Badge>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
          {novel.logline}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {novel.chapterCount} ch
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {novel.sceneCount} scenes
          </span>
          <span className="flex items-center gap-1">
            <Library className="h-3.5 w-3.5" />
            {novel.storyBibleCount} bible
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(novel.updatedAt)}
          </span>
        </div>
      </button>

      {/* Delete control (sibling of the open button to avoid nested buttons). */}
      <div className="absolute right-3 top-3">
        {confirming ? (
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={onConfirmDelete}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            aria-label={`Delete ${novel.title}`}
            title="Delete novel"
            onClick={onAskDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  onCreate,
  busy,
}: {
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
        <Feather className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">No novels yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Create your first project and invite co-authors to write in the same
        manuscript, live.
      </p>
      <Button className="mt-5" onClick={onCreate} disabled={busy}>
        <Plus className="h-4 w-4" />
        Create your first novel
      </Button>
    </div>
  );
}
