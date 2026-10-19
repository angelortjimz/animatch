// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COLORS, applyTheme, resolveTheme, useTheme } from "./theme";

interface MediaStub {
  fire: (next: boolean) => void;
}

function stubMatchMedia(matches: boolean): MediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    fire: (next) => {
      query.matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

let meta: HTMLMetaElement;

beforeEach(() => {
  meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
});

afterEach(() => {
  cleanup();
  meta.remove();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("follows the system preference when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ignores the system preference when forced", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("applyTheme", () => {
  it("forces the theme attribute and updates the meta", () => {
    applyTheme("dark", "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("leaves the attribute unset when following the system", () => {
    document.documentElement.dataset.theme = "dark";
    applyTheme("system", "light");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  it("does nothing when no theme-color meta exists", () => {
    meta.remove();
    expect(() => applyTheme("dark", "dark")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("useTheme", () => {
  it("starts on the system preference without an attribute", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("forces a chosen theme in memory", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("tracks later system changes while on system", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(meta.content).toBe(THEME_COLORS.light);
    act(() => media.fire(true));
    expect(result.current.preference).toBe("system");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("ignores system changes once a theme is forced", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("light"));
    act(() => media.fire(true));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  it("keeps working when the browser cannot report a colour scheme", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("never persists the choice", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
  });
});
