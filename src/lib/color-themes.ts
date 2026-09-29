/**
 * Every color theme the CRM can wear, in one place. Each theme supplies a
 * full light-mode and dark-mode set of the same CSS custom properties
 * styles.css already defines on `:root` / `.dark` for the built-in "Neon
 * Mandala" look, plus a fixed brand-rail palette (the sidebar and the login
 * left panel deliberately don't change between light/dark — see styles.css's
 * own comment on `--sidebar-*` — so each theme gets exactly one rail, not
 * two), and the three-stop gradient the BrandMark/BrandMandala mandala is
 * drawn with.
 *
 * useColorTheme() applies the active theme's values as inline custom
 * properties on <html>, which win over styles.css's own :root/.dark rules by
 * specificity — so "neon" is both a normal entry here AND effectively the
 * CSS file's own hard-coded default (what renders before any JS runs, and
 * exactly what a fresh page load with no saved preference will show).
 */

export type ColorThemeId = "neon" | "navygold" | "emerald" | "coral" | "teal";

type ThemeVars = {
  background: string; foreground: string;
  card: string; "card-foreground": string;
  popover: string; "popover-foreground": string;
  primary: string; "primary-foreground": string;
  secondary: string; "secondary-foreground": string;
  muted: string; "muted-foreground": string;
  accent: string; "accent-foreground": string;
  destructive: string; "destructive-foreground": string;
  success: string; "success-foreground": string;
  warning: string; "warning-foreground": string;
  info: string; "info-foreground": string;
  border: string; input: string; ring: string;
  "chart-1": string; "chart-2": string; "chart-3": string; "chart-4": string; "chart-5": string;
};

type SidebarVars = {
  sidebar: string; "sidebar-foreground": string;
  "sidebar-primary": string; "sidebar-primary-foreground": string;
  "sidebar-accent": string; "sidebar-accent-foreground": string;
  "sidebar-border": string; "sidebar-ring": string;
};

export interface ColorThemeDef {
  id: ColorThemeId;
  label: string;
  /** One line shown under the swatch in the picker. */
  description: string;
  /** Full CSS font-family value for headings; falls back to the app default when omitted. */
  headingFont?: string;
  mandala: [string, string, string];
  light: ThemeVars;
  dark: ThemeVars;
  sidebar: SidebarVars;
}

/** `hexToRgba("#2fe6ff", 0.6)` → `"rgba(47,230,255,0.6)"` — used for the glow
 * drop-shadows around the brand mark, so every theme's glow matches its own
 * mandala color instead of staying hard-coded cyan. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const DEFAULT_HEADING_FONT = '"Rajdhani", ui-sans-serif, system-ui, sans-serif';

export const COLOR_THEMES: Record<ColorThemeId, ColorThemeDef> = {
  neon: {
    id: "neon",
    label: "Neon Mandala",
    description: "The original look — cyan, violet and magenta on near-black.",
    mandala: ["#2fe6ff", "#9b6bff", "#ff3fd0"],
    light: {
      background: "#eee9fb", foreground: "#1a1830",
      card: "#ffffff", "card-foreground": "#1a1830",
      popover: "#ffffff", "popover-foreground": "#1a1830",
      primary: "#7a3fe0", "primary-foreground": "#ffffff",
      secondary: "#f1ecfd", "secondary-foreground": "#1a1830",
      muted: "#f1ecfd", "muted-foreground": "#5c5580",
      accent: "#e6dbff", "accent-foreground": "#3d1f8f",
      destructive: "#d6285f", "destructive-foreground": "#ffffff",
      success: "#1f9d5c", "success-foreground": "#ffffff",
      warning: "#b3791b", "warning-foreground": "#ffffff",
      info: "#6a3fc9", "info-foreground": "#ffffff",
      border: "#dcd0f7", input: "#ffffff", ring: "#7a3fe0",
      "chart-1": "#7a3fe0", "chart-2": "#2fb8e6", "chart-3": "#d6288f", "chart-4": "#1f9d5c", "chart-5": "#b3791b",
    },
    dark: {
      background: "#0a0b14", foreground: "#eaf2ff",
      card: "#131629", "card-foreground": "#eaf2ff",
      popover: "#131629", "popover-foreground": "#eaf2ff",
      primary: "#2fe6ff", "primary-foreground": "#06121a",
      secondary: "#171b30", "secondary-foreground": "#eaf2ff",
      muted: "#171b30", "muted-foreground": "#8590b8",
      accent: "#1c2140", "accent-foreground": "#eaf2ff",
      destructive: "#ff4d6d", "destructive-foreground": "#2b0510",
      success: "#4dffa0", "success-foreground": "#06170d",
      warning: "#ffcf5c", "warning-foreground": "#2b1d02",
      info: "#c99bff", "info-foreground": "#1c0f33",
      border: "#262b4a", input: "#0e1120", ring: "#2fe6ff",
      "chart-1": "#2fe6ff", "chart-2": "#9b6bff", "chart-3": "#ff3fd0", "chart-4": "#4dffa0", "chart-5": "#ffcf5c",
    },
    sidebar: {
      sidebar: "#12142a", "sidebar-foreground": "#eef1ff",
      "sidebar-primary": "#2fe6ff", "sidebar-primary-foreground": "#06121a",
      "sidebar-accent": "#1c2140", "sidebar-accent-foreground": "#eef1ff",
      "sidebar-border": "#262b4a", "sidebar-ring": "#2fe6ff",
    },
  },

  navygold: {
    id: "navygold",
    label: "Navy & Gold",
    description: "Executive and premium — deep navy with a warm gold accent.",
    headingFont: '"Cinzel", ui-serif, Georgia, serif',
    mandala: ["#e8c877", "#c9a24d", "#7a5a1f"],
    light: {
      background: "#f7f2e4", foreground: "#1c1a13",
      card: "#ffffff", "card-foreground": "#1c1a13",
      popover: "#ffffff", "popover-foreground": "#1c1a13",
      primary: "#a9812f", "primary-foreground": "#ffffff",
      secondary: "#f3ecd9", "secondary-foreground": "#1c1a13",
      muted: "#f3ecd9", "muted-foreground": "#7a7157",
      accent: "#ece2c7", "accent-foreground": "#5c4a17",
      destructive: "#b3324a", "destructive-foreground": "#ffffff",
      success: "#2f8f52", "success-foreground": "#ffffff",
      warning: "#a06d15", "warning-foreground": "#ffffff",
      info: "#6752b0", "info-foreground": "#ffffff",
      border: "#e6dcc0", input: "#ffffff", ring: "#a9812f",
      "chart-1": "#a9812f", "chart-2": "#2f8f52", "chart-3": "#6752b0", "chart-4": "#b3324a", "chart-5": "#6f6650",
    },
    dark: {
      background: "#0c1020", foreground: "#f1ecdc",
      card: "#151a33", "card-foreground": "#f1ecdc",
      popover: "#151a33", "popover-foreground": "#f1ecdc",
      primary: "#e8c877", "primary-foreground": "#1c1406",
      secondary: "#1b2140", "secondary-foreground": "#f1ecdc",
      muted: "#1b2140", "muted-foreground": "#9aa0c2",
      accent: "#232a4d", "accent-foreground": "#f1ecdc",
      destructive: "#e0546b", "destructive-foreground": "#2b0510",
      success: "#7fce9a", "success-foreground": "#06170d",
      warning: "#e0b568", "warning-foreground": "#2b1d02",
      info: "#b6a6e6", "info-foreground": "#1c0f33",
      border: "#2a2f52", input: "#0f1326", ring: "#c9a24d",
      "chart-1": "#c9a24d", "chart-2": "#7fce9a", "chart-3": "#b6a6e6", "chart-4": "#e0546b", "chart-5": "#e8c877",
    },
    sidebar: {
      sidebar: "#0c1020", "sidebar-foreground": "#f1ecdc",
      "sidebar-primary": "#d4af5f", "sidebar-primary-foreground": "#1c1406",
      "sidebar-accent": "#1b2140", "sidebar-accent-foreground": "#f1ecdc",
      "sidebar-border": "#2a2f52", "sidebar-ring": "#c9a24d",
    },
  },

  emerald: {
    id: "emerald",
    label: "Emerald Slate",
    description: "Calm and grounded — charcoal slate with an emerald accent.",
    mandala: ["#5eead4", "#22c07a", "#0f5c38"],
    light: {
      background: "#eef3ee", foreground: "#16211a",
      card: "#ffffff", "card-foreground": "#16211a",
      popover: "#ffffff", "popover-foreground": "#16211a",
      primary: "#178a53", "primary-foreground": "#ffffff",
      secondary: "#e3ece4", "secondary-foreground": "#16211a",
      muted: "#e3ece4", "muted-foreground": "#55685c",
      accent: "#d8e8dc", "accent-foreground": "#0f3d24",
      destructive: "#c4283f", "destructive-foreground": "#ffffff",
      success: "#178a53", "success-foreground": "#ffffff",
      warning: "#a06d15", "warning-foreground": "#ffffff",
      info: "#2f7d74", "info-foreground": "#ffffff",
      border: "#d3e0d5", input: "#ffffff", ring: "#178a53",
      "chart-1": "#178a53", "chart-2": "#2f7d74", "chart-3": "#a06d15", "chart-4": "#c4283f", "chart-5": "#3f6fb0",
    },
    dark: {
      background: "#11161a", foreground: "#e8efe9",
      card: "#171e22", "card-foreground": "#e8efe9",
      popover: "#171e22", "popover-foreground": "#e8efe9",
      primary: "#22c07a", "primary-foreground": "#04150c",
      secondary: "#1b2226", "secondary-foreground": "#e8efe9",
      muted: "#1b2226", "muted-foreground": "#8a978f",
      accent: "#202a27", "accent-foreground": "#e8efe9",
      destructive: "#ff5d6c", "destructive-foreground": "#2b0508",
      success: "#4ade80", "success-foreground": "#052e12",
      warning: "#f2c14e", "warning-foreground": "#2b1d02",
      info: "#7fd1c9", "info-foreground": "#04211d",
      border: "#263029", input: "#12181b", ring: "#22c07a",
      "chart-1": "#22c07a", "chart-2": "#7fd1c9", "chart-3": "#f2c14e", "chart-4": "#ff5d6c", "chart-5": "#8ab4f8",
    },
    sidebar: {
      sidebar: "#0e1512", "sidebar-foreground": "#e8efe9",
      "sidebar-primary": "#22c07a", "sidebar-primary-foreground": "#04150c",
      "sidebar-accent": "#1b2622", "sidebar-accent-foreground": "#e8efe9",
      "sidebar-border": "#24302a", "sidebar-ring": "#22c07a",
    },
  },

  coral: {
    id: "coral",
    label: "Warm Coral",
    description: "Human and energetic — deep plum with a coral-orange accent.",
    mandala: ["#ffb199", "#ff6b57", "#8f2a1f"],
    light: {
      background: "#fdece7", foreground: "#2b1712",
      card: "#ffffff", "card-foreground": "#2b1712",
      popover: "#ffffff", "popover-foreground": "#2b1712",
      primary: "#d24b34", "primary-foreground": "#ffffff",
      secondary: "#fbe2d9", "secondary-foreground": "#2b1712",
      muted: "#fbe2d9", "muted-foreground": "#8a655c",
      accent: "#f6d4c6", "accent-foreground": "#7a2a15",
      destructive: "#c4283f", "destructive-foreground": "#ffffff",
      success: "#1f9d5c", "success-foreground": "#ffffff",
      warning: "#a06d15", "warning-foreground": "#ffffff",
      info: "#7d5ba6", "info-foreground": "#ffffff",
      border: "#f0d2c4", input: "#ffffff", ring: "#d24b34",
      "chart-1": "#d24b34", "chart-2": "#a06d15", "chart-3": "#7d5ba6", "chart-4": "#1f9d5c", "chart-5": "#b3565e",
    },
    dark: {
      background: "#180f14", foreground: "#f7ece7",
      card: "#23151b", "card-foreground": "#f7ece7",
      popover: "#23151b", "popover-foreground": "#f7ece7",
      primary: "#ff6b57", "primary-foreground": "#2b0a04",
      secondary: "#2a1a20", "secondary-foreground": "#f7ece7",
      muted: "#2a1a20", "muted-foreground": "#b58f92",
      accent: "#331e26", "accent-foreground": "#f7ece7",
      destructive: "#ff4d6d", "destructive-foreground": "#2b0510",
      success: "#4dd88a", "success-foreground": "#06210f",
      warning: "#ffb84d", "warning-foreground": "#2b1d02",
      info: "#c99bd6", "info-foreground": "#1c0f33",
      border: "#3a232b", input: "#1c1218", ring: "#ff6b57",
      "chart-1": "#ff6b57", "chart-2": "#ffb84d", "chart-3": "#c99bd6", "chart-4": "#4dd88a", "chart-5": "#ff8fa3",
    },
    sidebar: {
      sidebar: "#170e13", "sidebar-foreground": "#f7ece7",
      "sidebar-primary": "#ff6b57", "sidebar-primary-foreground": "#2b0a04",
      "sidebar-accent": "#2a1a20", "sidebar-accent-foreground": "#f7ece7",
      "sidebar-border": "#3a232b", "sidebar-ring": "#ff6b57",
    },
  },

  teal: {
    id: "teal",
    label: "Ocean Teal",
    description: "Toned-down and modern — deep ocean navy with a teal accent.",
    mandala: ["#7fe8ef", "#22c3d6", "#0d5c68"],
    light: {
      background: "#e7f4f5", foreground: "#0c2427",
      card: "#ffffff", "card-foreground": "#0c2427",
      popover: "#ffffff", "popover-foreground": "#0c2427",
      primary: "#0f8fa3", "primary-foreground": "#ffffff",
      secondary: "#dcefef", "secondary-foreground": "#0c2427",
      muted: "#dcefef", "muted-foreground": "#4d7377",
      accent: "#cde8e9", "accent-foreground": "#0a4a52",
      destructive: "#c4283f", "destructive-foreground": "#ffffff",
      success: "#1f9d5c", "success-foreground": "#ffffff",
      warning: "#a06d15", "warning-foreground": "#ffffff",
      info: "#3f6fb0", "info-foreground": "#ffffff",
      border: "#cbe3e4", input: "#ffffff", ring: "#0f8fa3",
      "chart-1": "#0f8fa3", "chart-2": "#3f6fb0", "chart-3": "#1f9d5c", "chart-4": "#a06d15", "chart-5": "#b3565e",
    },
    dark: {
      background: "#071418", foreground: "#e6f6f5",
      card: "#0f2228", "card-foreground": "#e6f6f5",
      popover: "#0f2228", "popover-foreground": "#e6f6f5",
      primary: "#22c3d6", "primary-foreground": "#04181b",
      secondary: "#12262c", "secondary-foreground": "#e6f6f5",
      muted: "#12262c", "muted-foreground": "#7fa3a8",
      accent: "#163137", "accent-foreground": "#e6f6f5",
      destructive: "#ff5d7a", "destructive-foreground": "#2b0510",
      success: "#45d19b", "success-foreground": "#052e1c",
      warning: "#e8c15c", "warning-foreground": "#2b1d02",
      info: "#7fa8e0", "info-foreground": "#0c1c33",
      border: "#1c343b", input: "#0a1c21", ring: "#22c3d6",
      "chart-1": "#22c3d6", "chart-2": "#7fa8e0", "chart-3": "#45d19b", "chart-4": "#e8c15c", "chart-5": "#ff5d7a",
    },
    sidebar: {
      sidebar: "#061014", "sidebar-foreground": "#e6f6f5",
      "sidebar-primary": "#22c3d6", "sidebar-primary-foreground": "#04181b",
      "sidebar-accent": "#12262c", "sidebar-accent-foreground": "#e6f6f5",
      "sidebar-border": "#1c343b", "sidebar-ring": "#22c3d6",
    },
  },
};

export const COLOR_THEME_LIST = Object.values(COLOR_THEMES);

export function isColorThemeId(v: unknown): v is ColorThemeId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(COLOR_THEMES, v);
}