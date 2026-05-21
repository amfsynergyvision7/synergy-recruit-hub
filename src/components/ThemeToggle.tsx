import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme === "dark" || (!savedTheme && true);
    setIsDark(isDarkMode);
    applyTheme(isDarkMode);
  }, []);

  const applyTheme = (dark: boolean) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      root.style.backgroundColor = "#000000";
      root.style.color = "#ffffff";
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#ffffff";
      root.style.color = "#000000";
    }
    localStorage.setItem("theme", dark ? "dark" : "light");
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    applyTheme(newIsDark);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 flex items-center justify-center cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={`h-4 w-4 transition-all duration-300 ${
          isDark ? "opacity-100 rotate-0" : "opacity-0 rotate-90 absolute"
        }`}
        style={{ color: isDark ? "#ffffff" : "#000000" }}
      />
      <Moon
        className={`h-4 w-4 transition-all duration-300 ${
          isDark ? "opacity-0 -rotate-90 absolute" : "opacity-100 rotate-0"
        }`}
        style={{ color: isDark ? "#ffffff" : "#000000" }}
      />
    </button>
  );
}