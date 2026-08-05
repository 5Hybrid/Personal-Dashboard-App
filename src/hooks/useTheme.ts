import { useEffect } from "react";
import { type Theme, useThemeStore } from "@/store/themeStore";

function resolveIsDark(theme: Theme): boolean {
  // "futuristic" is a dark-chrome theme too — it piggybacks on every
  // `dark:` utility already tuned elsewhere in the app (see index.css's
  // `.futuristic` block) rather than duplicating them.
  if (theme === "dark" || theme === "futuristic") return true;
  return theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/// Mounted once near the app root. Keeps `<html>`'s `dark`/`futuristic`
/// classes (which index.html's inline script already set once,
/// synchronously, to avoid a flash on load) in sync with the store — both
/// when the user picks a theme and, for "system", when the OS-level
/// preference changes underneath it.
export function useThemeEffect() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveIsDark(theme));
    document.documentElement.classList.toggle("futuristic", theme === "futuristic");
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.classList.toggle("dark", resolveIsDark(theme));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return { theme, setTheme };
}
