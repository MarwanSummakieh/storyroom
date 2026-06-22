import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "positive" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-2 text-muted",
  accent: "border-transparent bg-accent-soft text-accent-strong",
  positive: "border-transparent bg-[var(--positive)]/12 text-[var(--positive)]",
  warning: "border-transparent bg-[var(--warning)]/12 text-[var(--warning)]",
  danger: "border-transparent bg-[var(--danger)]/12 text-[var(--danger)]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
