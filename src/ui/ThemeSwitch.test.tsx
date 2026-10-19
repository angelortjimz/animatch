// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(cleanup);

const option = (name: string): HTMLElement => screen.getByRole("button", { name });

describe("ThemeSwitch", () => {
  it("exposes a labelled group of three options", () => {
    render(<ThemeSwitch preference="system" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Colour theme" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks only the current preference as pressed", () => {
    render(<ThemeSwitch preference="dark" onChange={() => {}} />);
    expect(option("Dark").getAttribute("aria-pressed")).toBe("true");
    expect(option("Light").getAttribute("aria-pressed")).toBe("false");
    expect(option("System").getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the chosen preference", () => {
    const onChange = vi.fn();
    render(<ThemeSwitch preference="system" onChange={onChange} />);
    fireEvent.click(option("Light"));
    expect(onChange).toHaveBeenCalledWith("light");
  });
});
