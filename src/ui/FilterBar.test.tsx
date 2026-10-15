// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ANIME_FORMATS, ANIME_FORMAT_LABELS, type RecommendationFilters } from "@/models/anime";
import { EPISODE_SLIDER_MAX, EPISODE_SLIDER_MIN } from "@/recommendation/config";
import { FilterBar } from "./FilterBar";

afterEach(cleanup);

/** A controlled harness, so a press builds on the filters already chosen. */
function ControlledBar({ initial }: { initial: RecommendationFilters }) {
  const [filters, setFilters] = useState(initial);
  return <FilterBar filters={filters} disabled={false} onChange={setFilters} />;
}

function renderBar(filters: RecommendationFilters = { formats: [], maxEpisodes: null }) {
  const onChange = vi.fn();
  const view = render(<FilterBar filters={filters} disabled={false} onChange={onChange} />);
  openFilters();
  return { onChange, ...view };
}

function renderControlled(initial: RecommendationFilters) {
  const view = render(<ControlledBar initial={initial} />);
  openFilters();
  return view;
}

/** The filters start collapsed, so every control test opens them first. */
function openFilters(): void {
  fireEvent.click(disclosure());
}

const disclosure = (): HTMLElement => screen.getByRole("button", { name: "Narrow it down" });

const chip = (label: string): HTMLElement => screen.getByRole("button", { name: label });
const slider = () => screen.getByRole<HTMLInputElement>("slider");
const anyLength = () => screen.getByRole<HTMLInputElement>("checkbox", { name: "Any length" });

describe("FilterBar", () => {
  it("keeps the filters out of the way until they are asked for", () => {
    render(
      <FilterBar
        filters={{ formats: [], maxEpisodes: null }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    expect(disclosure().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("reveals the filters when the disclosure is pressed", () => {
    render(
      <FilterBar
        filters={{ formats: [], maxEpisodes: null }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    openFilters();
    expect(disclosure().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("slider")).toBeDefined();
  });

  it("hides them again on a second press, without losing the choices", () => {
    renderControlled({ formats: ["MOVIE"], maxEpisodes: null });
    fireEvent.click(disclosure());
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByTestId("collapsed-filter-summary").textContent).toContain("Movies");
  });

  it("names the active narrowing while collapsed, and the promise while not", () => {
    const { rerender } = render(
      <FilterBar
        filters={{ formats: ["MOVIE"], maxEpisodes: 12 }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("collapsed-filter-summary").textContent).toBe(
      "Movies, up to 12 episodes",
    );
    rerender(
      <FilterBar
        filters={{ formats: [], maxEpisodes: null }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("collapsed-filter-summary")).toBeNull();
    expect(screen.getByText(/24 recommendations that already match/)).toBeDefined();
  });

  it("offers every format AniList can report", () => {
    renderBar();
    for (const format of ANIME_FORMATS) {
      expect(chip(ANIME_FORMAT_LABELS[format])).toBeDefined();
    }
  });

  it("starts with nothing pressed, which reads as any format", () => {
    renderBar();
    for (const format of ANIME_FORMATS) {
      expect(chip(ANIME_FORMAT_LABELS[format]).getAttribute("aria-pressed")).toBe("false");
    }
    expect(screen.getByTestId("format-summary").textContent).toBe("Any format");
  });

  it("adds a format to the request when its chip is pressed", () => {
    const { onChange } = renderBar();
    fireEvent.click(chip("Movie"));
    expect(onChange).toHaveBeenCalledWith({ formats: ["MOVIE"], maxEpisodes: null });
  });

  it("keeps every pressed format rather than replacing the previous one", () => {
    renderControlled({ formats: [], maxEpisodes: null });
    fireEvent.click(chip("Movie"));
    fireEvent.click(chip("OVA"));
    expect(chip("Movie").getAttribute("aria-pressed")).toBe("true");
    expect(chip("OVA").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("format-summary").textContent).toBe("Movies and OVAs");
  });

  it("removes a format when its chip is pressed again", () => {
    renderControlled({ formats: ["MOVIE", "OVA"], maxEpisodes: null });
    fireEvent.click(chip("Movie"));
    expect(chip("Movie").getAttribute("aria-pressed")).toBe("false");
    expect(chip("OVA").getAttribute("aria-pressed")).toBe("true");
  });

  it("leaves the episode ceiling alone when a format changes", () => {
    const { onChange } = renderBar({ formats: [], maxEpisodes: 24 });
    fireEvent.click(chip("TV"));
    expect(onChange).toHaveBeenCalledWith({ formats: ["TV"], maxEpisodes: 24 });
  });

  it("reports the ceiling the slider was moved to", () => {
    const { onChange } = renderBar({ formats: [], maxEpisodes: 24 });
    fireEvent.change(slider(), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({ formats: [], maxEpisodes: 50 });
  });

  it("never offers a ceiling below one episode", () => {
    renderBar();
    expect(slider().min).toBe(String(EPISODE_SLIDER_MIN));
    expect(slider().max).toBe(String(EPISODE_SLIDER_MAX));
  });

  it("clamps a ceiling dragged below the floor back to one episode", () => {
    const { onChange } = renderBar({ formats: [], maxEpisodes: 24 });
    fireEvent.change(slider(), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith({ formats: [], maxEpisodes: EPISODE_SLIDER_MIN });
  });

  it("disables the slider while any length is selected", () => {
    renderBar();
    expect(slider().disabled).toBe(true);
    expect(anyLength().checked).toBe(true);
  });

  it("leaves the ceiling untouched while any length is on", () => {
    const { onChange } = renderBar();
    fireEvent.change(slider(), { target: { value: "30" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("turns the ceiling off when any length is ticked", () => {
    const { onChange } = renderBar({ formats: [], maxEpisodes: 24 });
    fireEvent.click(anyLength());
    expect(onChange).toHaveBeenCalledWith({ formats: [], maxEpisodes: null });
  });

  it("restores the ceiling the slider was left at when any length is unticked", () => {
    renderControlled({ formats: [], maxEpisodes: 24 });
    fireEvent.change(slider(), { target: { value: "50" } });
    fireEvent.click(anyLength());
    expect(anyLength().checked).toBe(true);
    expect(screen.getByTestId("episode-summary").textContent).toBe("Any length");
    fireEvent.click(anyLength());
    expect(anyLength().checked).toBe(false);
    expect(screen.getByTestId("episode-summary").textContent).toBe("Up to 50 episodes");
  });

  it("adopts a ceiling set from outside the slider", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterBar filters={{ formats: [], maxEpisodes: 24 }} disabled={false} onChange={onChange} />,
    );
    openFilters();
    fireEvent.click(chip("Movie"));
    rerender(
      <FilterBar filters={{ formats: [], maxEpisodes: 36 }} disabled={false} onChange={onChange} />,
    );
    expect(slider().value).toBe("36");
  });

  it("describes the active ceiling in words", () => {
    renderBar({ formats: ["MOVIE"], maxEpisodes: 24 });
    expect(screen.getByTestId("episode-summary").textContent).toBe("Up to 24 episodes");
  });

  it("explains that titles without a published count are kept", () => {
    renderBar({ formats: [], maxEpisodes: 24 });
    expect(
      screen.getByText(/Ongoing series with no published count are always kept/),
    ).toBeDefined();
  });

  it("locks every control while a recommendation is being scored", () => {
    render(<FilterBar filters={{ formats: [], maxEpisodes: null }} disabled onChange={vi.fn()} />);
    openFilters();
    for (const format of ANIME_FORMATS) {
      expect(chip(ANIME_FORMAT_LABELS[format]).hasAttribute("disabled")).toBe(true);
    }
    expect(slider().disabled).toBe(true);
    expect(anyLength().disabled).toBe(true);
  });

  it("groups the chips under a labelled region", () => {
    renderBar();
    expect(screen.getByRole("group", { name: "Format" })).toBeDefined();
  });
});
