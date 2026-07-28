import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Density = "compact" | "comfortable";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  density: Density;
  toggleDensity: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

// UI version — bump this whenever a full redesign resets the default theme
const UI_VERSION = "v2-light";

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      // If the stored UI version doesn't match, reset to the new default
      const storedVersion = localStorage.getItem("boss-ui-version");
      if (storedVersion !== UI_VERSION) {
        localStorage.setItem("boss-ui-version", UI_VERSION);
        localStorage.setItem("boss-theme", defaultTheme);
        return defaultTheme;
      }
      const stored = localStorage.getItem("boss-theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [density, setDensity] = useState<Density>(() => {
    const stored = localStorage.getItem("boss-density");
    return (stored as Density) || "comfortable";
  });

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (switchable) {
      localStorage.setItem("boss-theme", theme);
    }
  }, [theme, switchable]);

  // Apply density class to <html> and persist
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-comfortable");
    root.classList.add(`density-${density}`);
    localStorage.setItem("boss-density", density);
  }, [density]);

  const toggleTheme = switchable
    ? () => setTheme(prev => (prev === "light" ? "dark" : "light"))
    : undefined;

  const toggleDensity = () =>
    setDensity(prev => (prev === "compact" ? "comfortable" : "compact"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable, density, toggleDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
