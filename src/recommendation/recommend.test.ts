import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAnilistCache, getAnimeBatch, getDiscoveryCandidates } from "@/api/anilist";
import {
  ANIME_FORMAT_LABELS,
  isAnimeFormat,
  NO_FILTERS,
  type Anime,
  type CommunityRecommendation,
  type DiscoveryCandidate,
  type RelatedAnime,
} from "@/models/anime";
import {
  anime,
  animeRelation,
  communityRecommendation,
  discoveryCandidate,
  filters,
  relation,
  reversed,
  selectedThree,
} from "./fixtures";
import { recommend } from "./recommend";
import { CANDIDATE_LIMIT } from "./config";

const api = vi.hoisted(() => ({
  connections: new Map<
    number,
    { relations: RelatedAnime[]; recommendations: CommunityRecommendation[] }
  >(),
  batch: new Map<number, Anime>(),
  discovery: [] as DiscoveryCandidate[],
}));

vi.mock("../api/anilist", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/anilist")>();
  return {
    ...original,
    getAnimeConnections: vi.fn(async (id: number) => {
      const found = api.connections.get(id);
      if (!found) throw new Error(`no connections stubbed for ${id}`);
      return found;
    }),
    getAnimeBatch: vi.fn(async (ids: number[]) =>
      ids.flatMap((id) => {
        const found = api.batch.get(id);
        return found ? [found] : [];
      }),
    ),
    getDiscoveryCandidates: vi.fn(async () => api.discovery),
  };
});

beforeEach(() => {
  api.connections.clear();
  api.batch.clear();
  api.discovery = [];
  clearAnilistCache();
  // Each test starts from the shared stub rather than a previous override.
  vi.mocked(getDiscoveryCandidates).mockImplementation(async () => api.discovery);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/** Registers three selections whose connections point at the given candidates. */
function scenario(
  candidates: {
    id: number;
    isAdult?: boolean;
    omit?: boolean;
    popularity?: number;
    predecessorId?: number;
    format?: string;
    episodes?: number | null;
  }[],
) {
  const selected = selectedThree();
  selected.forEach((source) => {
    api.connections.set(source.id, {
      relations: candidates.map((candidate) =>
        relation(source.id, candidate.id, "SIDE_STORY", "anime", candidate.format ?? "TV"),
      ),
      recommendations: [],
    });
    api.batch.set(source.id, source);
  });
  candidates.forEach((candidate) => {
    if (candidate.omit) return;
    const format = candidate.format ?? "TV";
    const label = isAnimeFormat(format) ? ANIME_FORMAT_LABELS[format] : null;
    api.batch.set(
      candidate.id,
      anime(candidate.id, {
        type: label,
        episodes: candidate.episodes === undefined ? 12 : candidate.episodes,
        isAdult: candidate.isAdult ?? false,
        popularity: candidate.popularity ?? 100,
        relations: candidate.predecessorId ? [animeRelation(candidate.predecessorId)] : [],
      }),
    );
  });
  return selected;
}

/** Narrows the result union so each test can read `results` without a guard. */
function asRecommendation(result: Awaited<ReturnType<typeof recommend>>) {
  if (result.kind !== "recommendation")
    throw new Error(`expected a recommendation, got ${result.kind}`);
  return result;
}

describe("recommend", () => {
  it("rejects anything other than three different anime", async () => {
    await expect(recommend([], NO_FILTERS)).rejects.toThrow(/3 different anime/);
    await expect(recommend([anime(1), anime(2)], NO_FILTERS)).rejects.toThrow(/3 different anime/);
    await expect(recommend([anime(1), anime(2), anime(3), anime(4)], NO_FILTERS)).rejects.toThrow(
      /3 different anime/,
    );
    await expect(recommend([anime(1), anime(1), anime(2)], NO_FILTERS)).rejects.toThrow(
      /3 different anime/,
    );
  });

  it("returns a recommendation with reasons and the sources it came from", async () => {
    const selected = scenario([{ id: 10 }, { id: 11 }]);
    const best = asRecommendation(await recommend(selected, NO_FILTERS)).results[0];
    expect(best?.anime.id).toBeGreaterThan(0);
    expect(best?.basedOn.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(best?.reasons.length).toBeGreaterThan(0);
  });

  it("returns every eligible candidate as a ranked queue, each with its own reasons", async () => {
    const selected = scenario([{ id: 10 }, { id: 11 }, { id: 12 }]);
    const results = asRecommendation(await recommend(selected, NO_FILTERS)).results;
    expect(results.map((item) => item.anime.id)).toEqual([10, 11, 12]);
    for (const entry of results) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.basedOn.map((item) => item.id)).toEqual([1, 2, 3]);
    }
  });

  it("drops adult, vanished and repeated candidates without repeating an anime", async () => {
    const selected = scenario([
      { id: 10, isAdult: true },
      { id: 11, omit: true },
      { id: 12 },
      { id: 12 },
    ]);
    const results = asRecommendation(await recommend(selected, NO_FILTERS)).results;
    expect(results.map((item) => item.anime.id)).toEqual([12]);
    expect(results[0]?.anime.isAdult).toBe(false);
  });

  it("reports no match for every route to an empty result", async () => {
    // No connections at all.
    selectedThree().forEach((source) => {
      api.connections.set(source.id, { relations: [], recommendations: [] });
    });
    expect(await recommend(selectedThree(), NO_FILTERS)).toEqual({ kind: "no-match" });

    // Every candidate rejected as adult.
    expect(await recommend(scenario([{ id: 10, isAdult: true }]), NO_FILTERS)).toEqual({
      kind: "no-match",
    });

    // Every candidate no longer returned by AniList.
    expect(await recommend(scenario([{ id: 10, omit: true }]), NO_FILTERS)).toEqual({
      kind: "no-match",
    });
  });

  it("never recommends one of the selections", async () => {
    const selected = scenario([{ id: 1 }, { id: 10 }]);
    expect(asRecommendation(await recommend(selected, NO_FILTERS)).results[0]?.anime.id).not.toBe(
      1,
    );
  });

  it("drops a sequel whose prequel is not one of the picks", async () => {
    // Shippuden follows Naruto (20), which the user never selected.
    const selected = scenario([{ id: 10 }, { id: 11, predecessorId: 20 }]);
    const results = asRecommendation(await recommend(selected, NO_FILTERS)).results;
    expect(results.map((item) => item.anime.id)).toEqual([10]);
  });

  it("drops a sequel that arrives as a community recommendation", async () => {
    const selected = scenario([{ id: 10 }, { id: 11, predecessorId: 20 }]);
    // The path the report described: no franchise link, only a fan suggestion.
    selected.forEach((source) => {
      api.connections.set(source.id, {
        relations: [],
        recommendations: [
          communityRecommendation(source.id, 10),
          communityRecommendation(source.id, 11),
        ],
      });
    });
    const results = asRecommendation(await recommend(selected, NO_FILTERS)).results;
    expect(results.map((item) => item.anime.id)).toEqual([10]);
  });

  it("keeps a sequel once its prequel is one of the picks", async () => {
    const selected = scenario([{ id: 10 }, { id: 11, predecessorId: 2 }]);
    const results = asRecommendation(await recommend(selected, NO_FILTERS)).results;
    expect(results.map((item) => item.anime.id)).toContain(11);
  });

  it("reports no match when every candidate continues an unwatched show", async () => {
    const selected = scenario([
      { id: 10, predecessorId: 20 },
      { id: 11, predecessorId: 30 },
    ]);
    expect(await recommend(selected, NO_FILTERS)).toEqual({ kind: "no-match" });
  });

  it("picks the higher scoring candidate", async () => {
    const selected = scenario([{ id: 10 }, { id: 11 }]);
    api.batch.set(
      10,
      anime(10, { genres: [], themes: [], mainStudios: [], type: null, year: null }),
    );
    expect(asRecommendation(await recommend(selected, NO_FILTERS)).results[0]?.anime.id).toBe(11);
  });

  it("is deterministic under shuffled candidates and reordered selections", async () => {
    const candidates = [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }];

    const forward = scenario(candidates);
    const runA = await recommend(forward, NO_FILTERS);
    const runB = await recommend(forward, NO_FILTERS);

    // A fresh scenario with the candidates offered in a different order.
    api.connections.clear();
    api.batch.clear();
    const shuffled = scenario(reversed(candidates));
    const runC = await recommend(shuffled, NO_FILTERS);

    // ...and the same three selections handed over back to front.
    api.connections.clear();
    api.batch.clear();
    const reordered = scenario(candidates);
    const runD = await recommend(reversed(reordered), NO_FILTERS);

    expect(runA).toEqual(runB);

    for (const other of [runC, runD]) {
      const a = asRecommendation(runA);
      const b = asRecommendation(other);
      expect(b.results.map((item) => item.anime.id)).toEqual(
        a.results.map((item) => item.anime.id),
      );
      expect(b.results[0]?.reasons).toEqual(a.results[0]?.reasons);
    }
  });

  it("propagates a failure from the connections lookup", async () => {
    api.connections.clear();
    await expect(recommend(selectedThree(), NO_FILTERS)).rejects.toThrow(/no connections stubbed/);
  });
});

describe("recommend with filters", () => {
  /** Fills the discovery queue with hydrated titles matching the offered rows. */
  function offer(count: number, overrides = {}): number[] {
    const ids = Array.from({ length: count }, (_, offset) => 500 + offset);
    api.discovery = ids.map((id) => discoveryCandidate(id, overrides));
    for (const row of api.discovery) {
      const label = row.format ? ANIME_FORMAT_LABELS[row.format] : null;
      api.batch.set(row.id, anime(row.id, { type: label, episodes: row.episodes }));
    }
    return ids;
  }

  it("fills all 24 slots with movies when movies are what the pool is short of", async () => {
    const selected = scenario([{ id: 10, format: "MOVIE" }]);
    const extra = offer(40, { format: "MOVIE" });
    const results = asRecommendation(await recommend(selected, filters({ formats: ["MOVIE"] })));
    expect(results.results).toHaveLength(CANDIDATE_LIMIT);
    expect(results.results.every((item) => item.anime.type === "Movie")).toBe(true);
    // The connected pick keeps the lead; the discovered movies fill the rest.
    expect(results.results[0]?.anime.id).toBe(10);
    expect(results.results.map((item) => item.anime.id)).toEqual(
      expect.arrayContaining(extra.slice(0, CANDIDATE_LIMIT - 1)),
    );
  });

  it("asks AniList to filter by format instead of filtering a general page", async () => {
    const selected = scenario([{ id: 10, format: "MOVIE" }]);
    offer(30, { format: "MOVIE" });
    await recommend(selected, filters({ formats: ["MOVIE"] }));
    expect(getDiscoveryCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ formats: ["MOVIE"] }),
    );
  });

  it("leaves the format out of the query when any format is allowed", async () => {
    const selected = scenario([{ id: 10 }]);
    offer(30);
    await recommend(selected, NO_FILTERS);
    expect(getDiscoveryCandidates).toHaveBeenCalledWith(expect.objectContaining({ formats: [] }));
  });

  it("excludes the selections and everything already pooled from the top-up", async () => {
    const selected = scenario([{ id: 10 }]);
    offer(30);
    await recommend(selected, NO_FILTERS);
    const call = vi.mocked(getDiscoveryCandidates).mock.calls[0]?.[0];
    expect(call?.excludeIds).toEqual([1, 2, 3, 10]);
  });

  it("keeps a title with no published episode count", async () => {
    const selected = scenario([{ id: 10, episodes: 12 }]);
    api.discovery = [discoveryCandidate(500, { episodes: null })];
    api.batch.set(500, anime(500, { episodes: null }));
    const results = asRecommendation(await recommend(selected, filters({ maxEpisodes: 24 })));
    expect(results.results.map((item) => item.anime.id)).toContain(500);
  });

  it("drops a title that sits above the ceiling", async () => {
    const selected = scenario([{ id: 10, episodes: 12 }]);
    api.discovery = [discoveryCandidate(500, { episodes: 26 })];
    api.batch.set(500, anime(500, { episodes: 26 }));
    const results = asRecommendation(await recommend(selected, filters({ maxEpisodes: 24 })));
    expect(results.results.map((item) => item.anime.id)).toEqual([10]);
  });

  it("keeps a title sitting exactly on the ceiling", async () => {
    const selected = scenario([{ id: 10, episodes: 12 }]);
    api.discovery = [discoveryCandidate(500, { episodes: 24 })];
    api.batch.set(500, anime(500, { episodes: 24 }));
    const results = asRecommendation(await recommend(selected, filters({ maxEpisodes: 24 })));
    expect(results.results.map((item) => item.anime.id)).toEqual([10, 500]);
  });

  it("never discards a discovered title before hydrating the rest of the pool", async () => {
    const selected = scenario([{ id: 10, episodes: 12 }]);
    // The thin discovery payload is filtered on episodes before any hydration.
    api.discovery = [
      discoveryCandidate(500, { episodes: 96 }),
      discoveryCandidate(501, { episodes: 12 }),
    ];
    const batch = vi.mocked(getAnimeBatch);
    batch.mockClear();
    api.batch.set(501, anime(501));
    const results = asRecommendation(await recommend(selected, filters({ maxEpisodes: 24 })));
    const hydratedIds = batch.mock.calls.flatMap((call) => call[0]);
    expect(hydratedIds).not.toContain(500);
    expect(results.results.map((item) => item.anime.id)).toEqual([10, 501]);
  });

  it("ranks a relation-backed pick above a broader discovery match", async () => {
    const selected = scenario([{ id: 10 }]);
    api.discovery = [discoveryCandidate(500)];
    api.batch.set(500, anime(500));
    const results = asRecommendation(await recommend(selected, NO_FILTERS));
    expect(results.results[0]?.anime.id).toBe(10);
  });

  it("returns a short list rather than padding it when discovery cannot help", async () => {
    const selected = scenario([{ id: 10 }, { id: 11 }]);
    expect(asRecommendation(await recommend(selected, NO_FILTERS)).results).toHaveLength(2);
  });

  it("requests a second page only when the first one came up short", async () => {
    const selected = scenario([{ id: 10 }]);
    // One row per page, and the pool needs far more than the two pages allow.
    vi.mocked(getDiscoveryCandidates).mockImplementation(async ({ page }) => [
      discoveryCandidate(900 + page),
    ]);
    for (let id = 900; id < 1200; id += 1) api.batch.set(id, anime(id));
    await recommend(selected, NO_FILTERS);
    expect(getDiscoveryCandidates).toHaveBeenCalledTimes(2);
  });

  it("stops after one page when that page already fills the pool", async () => {
    const selected = scenario([{ id: 10 }]);
    offer(40);
    await recommend(selected, NO_FILTERS);
    expect(getDiscoveryCandidates).toHaveBeenCalledTimes(1);
  });

  it("never asks twice for the same title when pages overlap", async () => {
    const selected = scenario([{ id: 10 }]);
    vi.mocked(getDiscoveryCandidates).mockImplementation(async () => [
      discoveryCandidate(500),
      discoveryCandidate(500),
      discoveryCandidate(501),
    ]);
    api.batch.set(500, anime(500));
    api.batch.set(501, anime(501));
    const results = asRecommendation(await recommend(selected, NO_FILTERS));
    expect(results.results.map((item) => item.anime.id)).toEqual([10, 500, 501]);
  });

  it("emits a title once when it is both related and discovered", async () => {
    const selected = scenario([{ id: 10 }]);
    // The pool is short, and discovery hands back a title already in it.
    vi.mocked(getDiscoveryCandidates).mockImplementation(async () => [discoveryCandidate(10)]);
    const results = asRecommendation(await recommend(selected, NO_FILTERS));
    expect(results.results.map((item) => item.anime.id)).toEqual([10]);
  });

  it("shows the partial pool when discovery fails mid-request", async () => {
    const selected = scenario([{ id: 10 }, { id: 11 }]);
    vi.mocked(getDiscoveryCandidates).mockRejectedValueOnce(new Error("AniList is down"));
    const results = asRecommendation(await recommend(selected, NO_FILTERS));
    expect(results.results.map((item) => item.anime.id)).toEqual([10, 11]);
  });

  it("reports the failure when discovery fails and there is nothing else to show", async () => {
    const selected = scenario([{ id: 10, isAdult: true }]);
    vi.mocked(getDiscoveryCandidates).mockRejectedValueOnce(new Error("AniList is down"));
    await expect(recommend(selected, NO_FILTERS)).rejects.toThrow(/AniList is down/);
  });

  it("applies filters without changing the order of an already full pool", async () => {
    const pool = Array.from({ length: 30 }, (_, offset) => ({ id: 10 + offset }));
    const unfiltered = scenario(pool);
    const loose = asRecommendation(await recommend(unfiltered, NO_FILTERS)).results;

    api.connections.clear();
    api.batch.clear();
    const filtered = scenario(pool);
    const exact = asRecommendation(await recommend(filtered, NO_FILTERS)).results;
    expect(exact.map((item) => item.anime.id)).toEqual(loose.map((item) => item.anime.id));
  });

  it("is deterministic with filters applied", async () => {
    const candidates = [
      { id: 10, format: "MOVIE" },
      { id: 11, format: "MOVIE" },
    ];
    const active = filters({ formats: ["MOVIE"], maxEpisodes: 24 });

    const first = scenario(candidates);
    offer(30, { format: "MOVIE" });
    const runA = await recommend(first, active);

    api.connections.clear();
    api.batch.clear();
    const shuffled = scenario(reversed(candidates));
    offer(30, { format: "MOVIE" });
    const runB = await recommend(shuffled, active);

    expect(runA).toEqual(runB);
  });

  it("makes no discovery request when the picks share no genres", async () => {
    const selected = scenario([{ id: 10 }]).map((source) => ({
      ...source,
      genres: [],
      themes: [],
    }));
    await recommend(selected, NO_FILTERS);
    expect(getDiscoveryCandidates).not.toHaveBeenCalled();
  });
});
