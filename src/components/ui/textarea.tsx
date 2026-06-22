import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
