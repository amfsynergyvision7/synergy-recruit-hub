import { useCallback, useEffect, useState } from "react";
import { COLOR_THEMES, DEFAULT_HEADING_FONT, isColorThemeId, type ColorThemeId } from "@/lib/color-themes";

const STORAGE_KEY = "colorTheme";
// Own broadcast (mirrors use-theme.ts's pattern) so every mounted
// useColorTheme() consumer — the Settings picker, BrandMark's mandala,
// the sidebar/login glow — re-syncs the moment any one of them changes it.
const EVENT_NAME = "app-color-theme-change";
// Dispatched by use-theme.ts on every light/dark toggle. A color theme has
// two independent variable sets (light and dark), so flipping light/dark
// needs to re-apply the SAME color theme's other half, not just leave the
// old mode's values sitting there.
const LIGHT_DARK_EVENT = "app-theme-change";

function getIsDark(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

function getSavedColorTheme(): ColorThemeId | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  return isColorThemeId(saved) ? saved : null;
}

function applyColorTheme(id: ColorThemeId) {
  const def = COLOR_THEMES[id];
  const root = document.documentElement;
  const vars = getIsDark() ? def.dark : def.light;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  Object.entries(def.sidebar).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  root.style.setProperty("--font-display", def.headingFont ?? DEFAULT_HEADING_FONT);
  root.dataset.colorTheme = id;
}

/**
 * `defaultId` is the organization's admin-set default (from app_settings,
 * loaded async by BrandingProvider) — used only until this browser has ever
 * made its own choice. Once a user picks a theme it's remembered here
 * (localStorage, like light/dark) and an org-default change later never
 * overrides that deliberate choice; it only changes what a browser that has
 * never picked one sees.
 */
export function useColorTheme(defaultId: ColorThemeId = "neon") {
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(() => getSavedColorTheme() ?? defaultId);

  useEffect(() => {
    applyColorTheme(colorTheme);
    const onModeChange = () => applyColorTheme(colorTheme);
    window.addEventListener(LIGHT_DARK_EVENT, onModeChange);
    return () => window.removeEventListener(LIGHT_DARK_EVENT, onModeChange);
  }, [colorTheme]);

  useEffect(() => {
    const onExternalChange = (e: Event) => {
      const next = (e as CustomEvent<ColorThemeId>).detail;
      if (isColorThemeId(next) && next !== colorTheme) setColorThemeState(next);
    };
    window.addEventListener(EVENT_NAME, onExternalChange as EventListener);
    return () => window.removeEventListener(EVENT_NAME, onExternalChange as EventListener);
  }, [colorTheme]);

  // Adopt a newly-arrived org default only while this browser has never made
  // its own choice — and only broadcast it (no localStorage write), so it
  // keeps behaving like "no choice yet" and a later org-default change can
  // still reach it.
  useEffect(() => {
    if (getSavedColorTheme() === null && defaultId !== colorTheme) {
      setColorThemeState(defaultId);
      window.dispatchEvent(new CustomEvent<ColorThemeId>(EVENT_NAME, { detail: defaultId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  const setColorTheme = useCallback((next: ColorThemeId) => {
    localStorage.setItem(STORAGE_KEY, next);
    setColorThemeState(next);
    window.dispatchEvent(new CustomEvent<ColorThemeId>(EVENT_NAME, { detail: next }));
  }, []);

  return { colorTheme, setColorTheme, theme: COLOR_THEMES[colorTheme] };
}