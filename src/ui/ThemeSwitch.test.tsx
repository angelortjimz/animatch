// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(cleanup);

const option = (name: string): HTMLElement => screen.getByRole("button", { name });

describe("ThemeSwitch", () => {
  it("exposes a labelled group of two options", () => {
    render(<ThemeSwitch theme="light" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Colour theme" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("marks only the current theme as pressed", () => {
    render(<ThemeSwitch theme="dark" onChange={() => {}} />);
    expect(option("Dark").getAttribute("aria-pressed")).toBe("true");
    expect(option("Light").getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the chosen theme", () => {
    const onChange = vi.fn();
    render(<ThemeSwitch theme="dark" onChange={onChange} />);
    fireEvent.click(option("Light"));
    expect(onChange).toHaveBeenCalledWith("light");
  });
});
