"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Light/dark theme bound to the `.dark` class on <html>. The initial class is
 * set before paint by the inline script in app/layout.tsx; this hook syncs
 * React state to it after hydration and persists toggles to localStorage.
 */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        window.localStorage.setItem("storyroom.theme", next);
      } catch {
        // Ignore storage failures (private mode, etc.).
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
