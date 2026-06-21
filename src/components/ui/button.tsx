import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-emerald-600",
        secondary:
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-zinc-500",
        ghost:
          "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 focus-visible:outline-zinc-500",
        danger:
          "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:outline-rose-600",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
