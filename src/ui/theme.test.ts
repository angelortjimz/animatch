// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COLORS, applyTheme, useTheme } from "./theme";

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches })),
  );
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

describe("applyTheme", () => {
  it("sets the theme attribute and updates the meta", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("does nothing to the meta when none exists", () => {
    meta.remove();
    expect(() => applyTheme("light")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("useTheme", () => {
  it("opens in the system's dark theme", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("opens in light when the system does not prefer dark", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  it("switches the theme on demand", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.content).toBe(THEME_COLORS.dark);
  });

  it("falls back to light when the browser cannot report a colour scheme", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("never persists the choice", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("light"));
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
  });
});
