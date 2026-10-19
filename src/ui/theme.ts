import { useEffect, useLayoutEffect, useState } from "react";
import type { ResolvedTheme, ThemePreference } from "@/models/theme";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f6f8f5",
  dark: "#12181b",
};

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyTheme(preference: ThemePreference, resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[resolved];
}

export function useTheme(): {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
} {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useLayoutEffect(() => {
    applyTheme(preference, resolved);
  }, [preference, resolved]);

  return { preference, setPreference };
}
