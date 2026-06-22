"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return actions;
    }
    return actions.filter((action) =>
      `${action.label} ${action.keywords ?? ""} ${action.group}`
        .toLowerCase()
        .includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { action: CommandAction; index: number }[]>();
    filtered.forEach((action, index) => {
      if (!map.has(action.group)) {
        map.set(action.group, []);
        order.push(action.group);
      }
      map.get(action.group)!.push({ action, index });
    });
    return order.map((group) => ({ group, items: map.get(group)! }));
  }, [filtered]);

  if (!open) {
    return null;
  }

  const run = (index: number) => {
    const action = filtered[index];
    if (action) {
      onClose();
      action.run();
    }
  };

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="animate-palette-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(active);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search actions, scenes…"
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
            aria-label="Command palette search"
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-subtle">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">
              No matches for “{query}”.
            </p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  {group}
                </p>
                {items.map(({ action, index }) => (
                  <button
                    key={action.id}
                    data-index={index}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      index === active
                        ? "bg-accent-soft text-ink"
                        : "text-muted hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={
                        index === active ? "text-accent-strong" : "text-subtle"
                      }
                    >
                      {action.icon}
                    </span>
                    <span className="flex-1 truncate text-ink">
                      {action.label}
                    </span>
                    {action.hint ? (
                      <span className="text-xs text-subtle">{action.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
