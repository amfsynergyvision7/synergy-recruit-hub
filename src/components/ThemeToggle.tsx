import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

// Thin UI wrapper around the single shared useTheme() hook — all the actual
// theme mechanics (reading the saved value, applying the class, persisting,
// keeping every mounted toggle in sync) live there now, so this component and
// the header's own toggle button in _app.tsx can never drift out of sync.
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      className="relative h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 flex items-center justify-center cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* No hardcoded icon color here on purpose: this sits in the sidebar
          footer, whose background is always the fixed dark brand rail
          regardless of the site-wide theme (see styles.css) — currentColor
          inherits --sidebar-foreground so the icon stays visible in both
          light and dark mode, instead of forcing black-on-dark in light mode
          like the previous hardcoded version did. */}
      <Sun
        className={`h-4 w-4 transition-all duration-300 ${
          isDark ? "opacity-100 rotate-0" : "opacity-0 rotate-90 absolute"
        }`}
      />
      <Moon
        className={`h-4 w-4 transition-all duration-300 ${
          isDark ? "opacity-0 -rotate-90 absolute" : "opacity-100 rotate-0"
        }`}
      />
    </button>
  );
}