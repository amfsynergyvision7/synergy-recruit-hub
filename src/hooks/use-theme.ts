import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
// Broadcast so every mounted useTheme() consumer re-syncs when ANY of them
// changes the theme. Without this, two independent toggle UIs (the header
// button and the sidebar ThemeToggle) each held their own React state, so
// clicking one didn't update the other's icon until something unrelated
// happened to re-render it.
const EVENT_NAME = "app-theme-change";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // Lets native form controls / scrollbars follow the theme too, instead of
  // only the CSS custom properties.
  root.style.colorScheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply on mount and whenever this component's own state changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Re-sync if a different mounted toggle changed the theme.
  useEffect(() => {
    const onExternalChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail;
      if ((next === "light" || next === "dark") && next !== theme) setThemeState(next);
    };
    window.addEventListener(EVENT_NAME, onExternalChange as EventListener);
    return () => window.removeEventListener(EVENT_NAME, onExternalChange as EventListener);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.dispatchEvent(new CustomEvent<Theme>(EVENT_NAME, { detail: next }));
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      window.dispatchEvent(new CustomEvent<Theme>(EVENT_NAME, { detail: next }));
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}