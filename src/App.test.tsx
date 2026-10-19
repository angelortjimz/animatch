// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { AnimeSearchResult, RecommendationResult } from "@/models/anime";
import { anime } from "@/recommendation/fixtures";
import { SEARCH_DEBOUNCE_MS, SUBMIT_SLOW_MS, SUBMIT_TIMEOUT_MS } from "@/ui/config";

const api = vi.hoisted(() => ({
  search: vi.fn(),
  batch: vi.fn(),
}));

vi.mock("@/api/anilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/anilist")>();
  return {
    ...actual,
    SEARCH_MIN_LENGTH: 2,
    searchAnime: api.search,
    getAnimeBatch: api.batch,
  };
});

vi.mock("@/recommendation/recommend", () => ({ recommend: vi.fn() }));

const { recommend } = await import("@/recommendation/recommend");
const recommendMock = vi.mocked(recommend);

const searchResult = (id: number, title: string): AnimeSearchResult => ({
  id,
  title,
  nativeTitle: null,
  imageUrl: null,
  type: "TV",
  year: 2020,
  episodes: 12,
});

/** Runs `body` inside act, so React flushes the resulting state updates. */
async function flush(body: () => void | Promise<void>): Promise<void> {
  await act(async () => {
    await body();
  });
}

/** Advances past the debounce window and flushes the search promise. */
async function passDebounce(): Promise<void> {
  await flush(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
}

/** Lets already-resolved promises and their `.then` chains settle. */
async function settlePromises(): Promise<void> {
  await flush(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** Fills one field: type, wait for matches, then pick the first one. */
async function select(index: number, id: number, title = `Anime ${id}`): Promise<void> {
  api.search.mockResolvedValueOnce([searchResult(id, title)]);
  const input = screen.getAllByRole("combobox")[index] as HTMLInputElement;
  await flush(() => {
    fireEvent.change(input, { target: { value: title } });
  });
  await passDebounce();
  await flush(() => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

async function chooseThreeDistinct(): Promise<void> {
  await select(0, 1, "Cowboy Bebop");
  await select(1, 2, "Trigun");
  await select(2, 3, "Nadia");
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Find a recommendation" });
}

async function submit(): Promise<void> {
  await flush(() => {
    fireEvent.click(submitButton());
  });
  await settlePromises();
}

/** The form submits on Enter from any field, not only on a pointer click. */
async function submitWithEnter(): Promise<void> {
  await flush(() => {
    fireEvent.submit(
      screen.getByRole("button", { name: "Find a recommendation" }).closest("form")!,
    );
  });
  await settlePromises();
}

beforeEach(() => {
  api.search.mockReset();
  api.batch.mockReset();
  recommendMock.mockReset();
  api.search.mockResolvedValue([]);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("App", () => {
  it("renders three labelled search fields inside a single main landmark", () => {
    render(<App />);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByLabelText("Anime 1")).toBeDefined();
    expect(screen.getByLabelText("Anime 2")).toBeDefined();
    expect(screen.getByLabelText("Anime 3")).toBeDefined();
  });

  it("counts down the picks still needed instead of leaving the user to count", () => {
    render(<App />);
    expect(screen.getByText(/Choose 3 more/)).toBeDefined();
  });

  it("does not register an alert region before anything can go wrong", () => {
    render(<App />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("marks anime already picked so a duplicate is prevented, not flagged", async () => {
    api.search.mockResolvedValue([searchResult(1, "Cowboy Bebop"), searchResult(2, "Trigun")]);
    render(<App />);
    const input = screen.getAllByRole<HTMLInputElement>("combobox")[0]!;
    await flush(() => {
      fireEvent.change(input, { target: { value: "cow" } });
    });
    await passDebounce();

    fireEvent.keyDown(input, { key: "Enter" });
    expect((screen.getAllByRole("combobox")[0] as HTMLInputElement).value).toBe("Cowboy Bebop");

    const second = screen.getAllByRole<HTMLInputElement>("combobox")[1]!;
    await flush(() => {
      fireEvent.change(second, { target: { value: "cow" } });
    });
    await passDebounce();

    expect(screen.getByRole("option", { name: /Already chosen/ })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps submit disabled until three distinct anime are chosen", async () => {
    render(<App />);
    // Idle: nothing to submit and no result region at all.
    expect(submitButton().disabled).toBe(true);
    expect(screen.queryByRole("region", { name: /recommendation/i })).toBeNull();

    await select(0, 1, "Cowboy Bebop");
    expect(submitButton().disabled).toBe(true);
    await select(1, 2, "Trigun");
    expect(submitButton().disabled).toBe(true);
    await select(2, 3, "Nadia");
    expect(submitButton().disabled).toBe(false);
  });

  it("sends focus to the submit button once the third pick lands", async () => {
    render(<App />);
    expect(document.activeElement).not.toBe(submitButton());
    await chooseThreeDistinct();
    expect(document.activeElement).toBe(submitButton());
  });

  it("completes the whole flow from the keyboard, Enter included", async () => {
    api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
    recommendMock.mockResolvedValue({
      kind: "recommendation",
      results: [
        { anime: anime(9, { title: "Yurei Deco" }), reasons: ["Reason"], basedOn: [anime(1)] },
      ],
    } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submitWithEnter();

    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();
  });

  it("refuses a repeated selection at the source, keyboard path included", async () => {
    render(<App />);
    await select(0, 1, "Cowboy Bebop");
    await select(1, 1, "Cowboy Bebop");
    await select(2, 3, "Nadia");

    expect((screen.getAllByRole("combobox")[1] as HTMLInputElement).readOnly).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Choose 1 more/)).toBeDefined();
  });

  it("locks the field once a different anime takes the refused slot", async () => {
    render(<App />);
    await select(0, 1, "Cowboy Bebop");
    await select(1, 1, "Cowboy Bebop");
    await select(1, 2, "Trigun");
    await select(2, 3, "Nadia");

    expect((screen.getAllByRole("combobox")[1] as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it("locks the fields and shows progress while a request is in flight", async () => {
    let release: (() => void) | undefined;
    api.batch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve([anime(1), anime(2), anime(3)]);
        }),
    );
    recommendMock.mockResolvedValue({ kind: "no-match" } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();

    expect(submitButton().disabled).toBe(true);
    expect(screen.getAllByRole("combobox").every((el) => (el as HTMLInputElement).disabled)).toBe(
      true,
    );
    expect(screen.getByText("Finding your next anime...")).toBeDefined();

    release?.();
    await settlePromises();
    expect(submitButton().disabled).toBe(false);
  });

  it("renders the recommendation the engine returns", async () => {
    api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
    recommendMock.mockResolvedValue({
      kind: "recommendation",
      results: [
        {
          anime: anime(9, { title: "Yurei Deco" }),
          reasons: ["Shares a strong Drama tag"],
          basedOn: [anime(1, { title: "First" }), anime(2, { title: "Second" })],
        },
      ],
    } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();

    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();
    expect(api.batch).toHaveBeenCalledWith([1, 2, 3], expect.any(AbortSignal));
    expect(recommendMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Based on First / Second")).toBeDefined();
  });

  it("reports unavailable when a selection cannot be re-fetched", async () => {
    api.batch.mockResolvedValue([anime(1), anime(2)]);

    render(<App />);
    await chooseThreeDistinct();
    await submit();

    expect(
      screen.getByRole("heading", { name: "One selection is no longer available" }),
    ).toBeDefined();
    expect(
      screen.getByText("Anime 3 is no longer listed. Clear that field and try again."),
    ).toBeDefined();
    expect(
      (screen.getAllByRole("combobox")[2] as HTMLInputElement).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(recommendMock).not.toHaveBeenCalled();
  });

  it("reports a friendly error and leaks no raw API message", async () => {
    api.batch.mockRejectedValue(new Error("AniList responded 503"));

    render(<App />);
    await chooseThreeDistinct();
    await submit();

    expect(
      screen.getByRole("heading", { name: "We could not find a recommendation" }),
    ).toBeDefined();
    expect(screen.queryByText(/503/)).toBeNull();
    expect(screen.queryByText(/AniList responded/)).toBeNull();
  });

  it("offers a retry that re-runs the same picks after a failure", async () => {
    api.batch
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue([anime(1), anime(2), anime(3)]);
    recommendMock.mockResolvedValue({
      kind: "recommendation",
      results: [
        {
          anime: anime(9, { title: "Yurei Deco" }),
          reasons: ["Reason"],
          basedOn: [anime(1)],
        },
      ],
    } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();
    expect(
      screen.getByRole("heading", { name: "We could not find a recommendation" }),
    ).toBeDefined();

    await flush(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    await settlePromises();

    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();
    expect(api.batch).toHaveBeenCalledTimes(2);
  });

  it("admits a long wait instead of holding the same spinner forever", async () => {
    api.batch.mockImplementation(() => new Promise(() => {}));
    recommendMock.mockResolvedValue({ kind: "no-match" } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();
    expect(screen.queryByText(/taking longer than usual/)).toBeNull();

    await flush(async () => {
      await vi.advanceTimersByTimeAsync(SUBMIT_SLOW_MS);
    });
    expect(
      screen.getByText("This is taking longer than usual. Keep waiting, or cancel and try again."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("lets the user cancel a stuck request and get the previous answer back", async () => {
    api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
    recommendMock.mockResolvedValue({
      kind: "recommendation",
      results: [
        {
          anime: anime(9, { title: "Yurei Deco" }),
          reasons: ["Reason"],
          basedOn: [anime(1)],
        },
      ],
    } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();
    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();

    // The cancelled run resolves late; it cannot overwrite the restored answer.
    let releaseStuck: (() => void) | undefined;
    let stuckSignal: AbortSignal | undefined;
    api.batch.mockImplementationOnce((_ids: number[], signal?: AbortSignal) => {
      stuckSignal = signal;
      return new Promise((resolve) => {
        releaseStuck = () => resolve([anime(1), anime(2), anime(3)]);
      });
    });
    await flush(() => {
      fireEvent.click(submitButton());
    });
    expect(screen.getByText("Finding your next anime...")).toBeDefined();

    await flush(() => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(stuckSignal?.aborted).toBe(true);
    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();
    expect(submitButton().disabled).toBe(false);

    recommendMock.mockResolvedValue({ kind: "no-match" } satisfies RecommendationResult);
    releaseStuck?.();
    await settlePromises();
    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();
    expect(recommendMock).toHaveBeenCalledTimes(1);
  });

  it("gives up on a request that never returns, with a retry offered", async () => {
    let deadlineSignal: AbortSignal | undefined;
    api.batch.mockImplementation((_ids: number[], signal?: AbortSignal) => {
      deadlineSignal = signal;
      return new Promise(() => {});
    });
    recommendMock.mockResolvedValue({ kind: "no-match" } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();

    await flush(async () => {
      await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
    });
    expect(deadlineSignal?.aborted).toBe(true);
    expect(
      screen.getByRole("heading", { name: "We could not find a recommendation" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(submitButton().disabled).toBe(false);
  });

  it("credits AniList in the page footer", () => {
    render(<App />);

    const credit = screen.getByRole("contentinfo");
    const link = within(credit).getByRole("link", { name: "AniList" });
    expect(link.getAttribute("href")).toBe("https://anilist.co");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(within(credit).getByText(/not affiliated with AniList/)).toBeDefined();
  });

  it("replaces the previous result with progress while re-running", async () => {
    api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
    recommendMock.mockResolvedValue({
      kind: "recommendation",
      results: [
        {
          anime: anime(9, { title: "Yurei Deco" }),
          reasons: ["First reason"],
          basedOn: [anime(1, { title: "First" })],
        },
      ],
    } satisfies RecommendationResult);

    render(<App />);
    await chooseThreeDistinct();
    await submit();
    expect(screen.getByRole("heading", { name: "Yurei Deco" })).toBeDefined();

    // Hold the next run open so the in-between state is observable.
    let release: (() => void) | undefined;
    recommendMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ kind: "no-match" } satisfies RecommendationResult);
        }),
    );
    await flush(() => {
      fireEvent.click(submitButton());
    });

    expect(screen.getByText("Finding your next anime...")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Yurei Deco" })).toBeNull();

    release?.();
    await settlePromises();
    expect(screen.getByRole("heading", { name: "No discovery match yet" })).toBeDefined();
  });

  describe("re-roll", () => {
    const entry = (id: number, title: string) => ({
      anime: anime(id, { title }),
      reasons: [`Reason for ${title}`],
      basedOn: [anime(1, { title: "First" })],
    });

    function queue(titles: string[]): RecommendationResult {
      return {
        kind: "recommendation",
        results: titles.map((title, position) => entry(position + 9, title)),
      };
    }

    async function showQueue(titles: string[]): Promise<void> {
      api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
      recommendMock.mockResolvedValue(queue(titles));
      render(<App />);
      await chooseThreeDistinct();
      await submit();
    }

    function rerollButton(): HTMLButtonElement {
      return screen.getByRole<HTMLButtonElement>("button", { name: "Seen it — show me another" });
    }

    it("walks the queue in ranked order without re-querying AniList", async () => {
      await showQueue(["First Pick", "Second Pick", "Third Pick"]);
      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();

      await flush(() => {
        fireEvent.click(rerollButton());
      });
      expect(screen.getByRole("heading", { name: "Second Pick" })).toBeDefined();
      expect(screen.queryByRole("heading", { name: "First Pick" })).toBeNull();

      await flush(() => {
        fireEvent.click(rerollButton());
      });
      expect(screen.getByRole("heading", { name: "Third Pick" })).toBeDefined();

      expect(recommendMock).toHaveBeenCalledTimes(1);
      expect(api.batch).toHaveBeenCalledTimes(1);
    });

    it("stops offering another once the queue is exhausted", async () => {
      await showQueue(["First Pick", "Second Pick"]);
      expect(rerollButton()).toBeDefined();

      await flush(() => {
        fireEvent.click(rerollButton());
      });

      expect(screen.getByRole("heading", { name: "Second Pick" })).toBeDefined();
      expect(screen.getByText(/Change one pick to explore again\./)).toBeDefined();
      expect(screen.queryByRole("button", { name: "Seen it — show me another" })).toBeNull();
    });

    it("lets the user step back to a title they skipped", async () => {
      await showQueue(["First Pick", "Second Pick"]);
      await flush(() => {
        fireEvent.click(rerollButton());
      });
      expect(screen.getByRole("heading", { name: "Second Pick" })).toBeDefined();

      await flush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Back to the previous one" }));
      });
      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();
    });

    it("resets to the top of the queue when the form is submitted again", async () => {
      await showQueue(["First Pick", "Second Pick"]);
      await flush(() => {
        fireEvent.click(rerollButton());
      });
      expect(screen.getByRole("heading", { name: "Second Pick" })).toBeDefined();

      recommendMock.mockResolvedValue(queue(["First Pick", "Second Pick"]));
      await submit();

      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();
      expect(rerollButton()).toBeDefined();
    });

    it("keeps a changed result visible but dimmed, and can undo the change", async () => {
      await showQueue(["First Pick", "Second Pick"]);
      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();

      const clearButtons = screen
        .getAllByRole("button", { name: /^Clear Anime/ })
        .filter((button) => !(button as HTMLButtonElement).disabled);
      await flush(() => {
        fireEvent.click(clearButtons[0]!);
      });

      // The card is not silently destroyed, but it no longer claims to fit.
      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();
      expect(document.querySelector(".result-card")?.className).toContain("is-stale");
      expect(screen.queryByRole("button", { name: "Seen it — show me another" })).toBeNull();

      await flush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Undo my last change" }));
      });

      expect(document.querySelector(".result-card")?.className).not.toContain("is-stale");
      expect((screen.getAllByRole("combobox")[0] as HTMLInputElement).value).toBe("Cowboy Bebop");
      expect(rerollButton()).toBeDefined();
    });

    it("focuses the first field when the user chooses to edit instead of undo", async () => {
      await showQueue(["First Pick"]);
      const clearButtons = screen
        .getAllByRole("button", { name: /^Clear Anime/ })
        .filter((button) => !(button as HTMLButtonElement).disabled);
      await flush(() => {
        fireEvent.click(clearButtons[2]!);
      });

      await flush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Edit my picks" }));
      });
      expect(document.activeElement).toBe(screen.getAllByRole("combobox")[0]);
    });
  });

  describe("filters", () => {
    function queue(titles: string[]): RecommendationResult {
      return {
        kind: "recommendation",
        results: titles.map((title, position) => ({
          anime: anime(position + 9, { title }),
          reasons: [`Reason for ${title}`],
          basedOn: [anime(1, { title: "First" })],
        })),
      };
    }

    const formatChip = (label: string): HTMLElement => screen.getByRole("button", { name: label });

    function openFilters(): void {
      const toggle = screen.getByRole("button", { name: "Narrow it down" });
      if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
    }

    async function narrow(): Promise<void> {
      await flush(() => {
        openFilters();
      });
      await flush(() => {
        fireEvent.click(formatChip("Movie"));
      });
    }

    beforeEach(async () => {
      api.batch.mockResolvedValue([anime(1), anime(2), anime(3)]);
      render(<App />);
      await chooseThreeDistinct();
      recommendMock.mockResolvedValue(queue(["First Pick", "Second Pick"]));
      await submit();
    });

    it("keeps the filters collapsed until the user opens them", () => {
      expect(screen.queryByRole("slider")).toBeNull();
    });

    it("scores the first request without any narrowing", async () => {
      expect(recommendMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          formats: [],
          maxEpisodes: null,
        },
        expect.any(AbortSignal),
      );
    });

    it("passes the chosen filters into the next request", async () => {
      await narrow();
      await submit();
      expect(recommendMock).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          formats: ["MOVIE"],
          maxEpisodes: null,
        },
        expect.any(AbortSignal),
      );
    });

    it("passes the chosen episode ceiling into the next request", async () => {
      await flush(() => {
        openFilters();
      });
      await flush(() => {
        fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
      });
      await submit();
      expect(recommendMock).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          formats: [],
          maxEpisodes: 30,
        },
        expect.any(AbortSignal),
      );
    });

    it("reads a ceiling moved while any length is on, and drops that choice", async () => {
      await flush(() => {
        openFilters();
      });
      expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Any length" }).checked).toBe(
        true,
      );
      await flush(() => {
        fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
      });
      expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Any length" }).checked).toBe(
        false,
      );
      await submit();
      expect(recommendMock).toHaveBeenLastCalledWith(
        expect.anything(),
        {
          formats: [],
          maxEpisodes: 30,
        },
        expect.any(AbortSignal),
      );
    });

    it("marks the result stale when a filter changes, without refetching", async () => {
      expect(document.querySelector(".result-card")?.className).not.toContain("is-stale");
      await narrow();
      expect(document.querySelector(".result-card")?.className).toContain("is-stale");
      expect(screen.getByRole("heading", { name: "First Pick" })).toBeDefined();
      expect(recommendMock).toHaveBeenCalledTimes(1);
    });

    it("leaves the result fresh when a filter is toggled off and back on", async () => {
      await narrow();
      await narrow();
      expect(document.querySelector(".result-card")?.className).not.toContain("is-stale");
    });

    it("states which filters the shown recommendation was scored against", async () => {
      expect(screen.queryByText(/Matched to your filters/)).toBeNull();
      await narrow();
      await submit();
      expect(document.querySelector(".active-filters")?.textContent).toContain(
        "Movies, any length",
      );
    });

    it("restores the filters to the ones the result was scored with on undo", async () => {
      await narrow();
      expect(document.querySelector(".result-card")?.className).toContain("is-stale");

      await flush(() => {
        fireEvent.click(screen.getByRole("button", { name: "Undo my last change" }));
      });

      expect(document.querySelector(".result-card")?.className).not.toContain("is-stale");
      expect(formatChip("Movie").getAttribute("aria-pressed")).toBe("false");
      // The picks were never touched by a filter change, so they stay put.
      expect((screen.getAllByRole("combobox")[0] as HTMLInputElement).value).toBe("Cowboy Bebop");
    });

    it("keeps the filters in place when the form is submitted again", async () => {
      await narrow();
      await submit();
      expect(formatChip("Movie").getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector(".result-card")?.className).not.toContain("is-stale");
    });

    it("locks the filters while a request is in flight", async () => {
      await narrow();
      api.batch.mockReturnValueOnce(new Promise(() => {}));
      await flush(() => {
        fireEvent.click(submitButton());
      });
      expect(formatChip("Movie").hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("slider").hasAttribute("disabled")).toBe(true);
    });
  });
});
