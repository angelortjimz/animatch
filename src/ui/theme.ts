import { useLayoutEffect, useState } from "react";
import type { Theme } from "@/models/theme";

export const THEME_COLORS: Record<Theme, string> = {
  light: "#f6f8f5",
  dark: "#12181b",
};

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[theme];
}

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(() => (systemPrefersDark() ? "dark" : "light"));

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
