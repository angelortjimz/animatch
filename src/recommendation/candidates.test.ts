import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/models/anime";
import { buildCandidateSeeds, buildDiscoverySeeds } from "./candidates";
import { CANDIDATE_LIMIT, DISCOVERY_RELATION_TYPE, FILTERED_POOL_SIZE } from "./config";
import { communityRecommendation, filters, relation, selectedThree } from "./fixtures";

describe("buildCandidateSeeds", () => {
  const selected = selectedThree();

  it("filters unsafe relation types and deduplicates strongest source links", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [
        [relation(1, 10, "SIDE_STORY"), relation(1, 10, "OTHER"), relation(1, 11, "SEQUEL")],
        [relation(2, 10, "SPIN_OFF"), relation(2, 12, "OTHER", "manga")],
        [relation(3, 1, "OTHER")],
      ],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ id: 10, sourceCount: 2, relationScore: 0.5 });
    expect(seeds[0]?.relations).toHaveLength(2);
  });

  it("includes same-universe relations as discovery candidates", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[relation(1, 10, "SAME_UNIVERSE")], [relation(2, 10, "SAME_UNIVERSE")], []],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ id: 10, sourceCount: 2, relationScore: 1 / 3 });
  });

  it("includes community recommendations as candidates", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[], [], []],
      [[communityRecommendation(1, 10, 30)], [communityRecommendation(2, 10, 12)], []],
      NO_FILTERS,
    );
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({ id: 10, sourceCount: 2, relationScore: 1 / 3 });
    expect(seeds[0]?.relations.every((item) => item.relationType === "COMMUNITY")).toBe(true);
  });

  it("prefers the higher weight when one source both relates and recommends a title", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[relation(1, 10, "OTHER")], [], []],
      [[communityRecommendation(1, 10)], [], []],
      NO_FILTERS,
    );
    expect(seeds[0]?.relations).toHaveLength(1);
    expect(seeds[0]?.relations[0]).toMatchObject({
      sourceId: 1,
      relationType: "COMMUNITY",
      weight: 0.5,
    });
  });

  it("excludes the selections themselves and non-anime media", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [
        [relation(1, 1, "SIDE_STORY"), relation(1, 2, "SIDE_STORY"), relation(1, 3, "SIDE_STORY")],
        [relation(2, 20, "SIDE_STORY", "manga")],
      ],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds).toEqual([]);
  });

  it("counts each source once no matter how many links it contributes", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[relation(1, 10, "SIDE_STORY"), relation(1, 10, "OTHER")], [], []],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds[0]).toMatchObject({ sourceCount: 1, relationScore: 0.8 / selected.length });
  });

  it("caps the candidate list and orders it by relation score", () => {
    const relations = [1, 2, 3].map((sourceId) =>
      Array.from({ length: 12 }, (_, offset) =>
        relation(sourceId, 100 + sourceId * 20 + offset, "SIDE_STORY"),
      ),
    );
    const seeds = buildCandidateSeeds(selected, relations, [[], [], []], NO_FILTERS);
    expect(seeds).toHaveLength(CANDIDATE_LIMIT);
    const scores = seeds.map((seed) => seed.relationScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("breaks equal scores by source count then id", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [
        [relation(1, 10, "SIDE_STORY"), relation(2, 10, "SIDE_STORY")],
        [relation(1, 11, "SIDE_STORY")],
      ],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds.map((seed) => seed.id)).toEqual([10, 11]);
  });

  it("returns nothing when there are no eligible connections", () => {
    expect(buildCandidateSeeds(selected, [[], [], []], [[], [], []], NO_FILTERS)).toEqual([]);
  });

  it("drops titles whose format the request excludes, before the pool is capped", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [
        [relation(1, 10, "SIDE_STORY", "anime", "MOVIE"), relation(1, 11, "SIDE_STORY")],
        [relation(2, 12, "SIDE_STORY", "anime", "OVA")],
      ],
      [[], [], []],
      filters({ formats: ["MOVIE"] }),
    );
    expect(seeds.map((seed) => seed.id)).toEqual([10]);
  });

  it("keeps every requested format rather than only the first", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [
        [
          relation(1, 10, "SIDE_STORY", "anime", "MOVIE"),
          relation(1, 11, "SIDE_STORY", "anime", "OVA"),
        ],
        [relation(2, 12, "SIDE_STORY", "anime", "TV")],
      ],
      [[], [], []],
      filters({ formats: ["MOVIE", "OVA"] }),
    );
    expect(seeds.map((seed) => seed.id)).toEqual([10, 11]);
  });

  it("applies the format filter to community recommendations too", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[], [], []],
      [[communityRecommendation(1, 10, 30, "anime", "MOVIE"), communityRecommendation(1, 11)], []],
      filters({ formats: ["MOVIE"] }),
    );
    expect(seeds.map((seed) => seed.id)).toEqual([10]);
  });

  it("treats an unknown format as a non-match when formats are requested", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[relation(1, 10, "SIDE_STORY", "anime", "MUSIC_VIDEO")], []],
      [[], [], []],
      filters({ formats: ["MOVIE"] }),
    );
    expect(seeds).toEqual([]);
  });

  it("widens the pool beyond the result size while a filter is active", () => {
    const relations = [1, 2, 3].map((sourceId) =>
      Array.from({ length: FILTERED_POOL_SIZE }, (_, offset) =>
        relation(sourceId, 1000 + sourceId * 100 + offset, "SIDE_STORY"),
      ),
    );
    const unfiltered = buildCandidateSeeds(selected, relations, [[], [], []], NO_FILTERS);
    const filtered = buildCandidateSeeds(
      selected,
      relations,
      [[], [], []],
      filters({ maxEpisodes: 24 }),
    );
    expect(unfiltered).toHaveLength(CANDIDATE_LIMIT);
    expect(filtered).toHaveLength(FILTERED_POOL_SIZE);
  });

  it("marks every relation-backed seed with its origin", () => {
    const seeds = buildCandidateSeeds(
      selected,
      [[relation(1, 10, "SIDE_STORY")], [], []],
      [[], [], []],
      NO_FILTERS,
    );
    expect(seeds[0]?.origin).toBe("relation");
  });
});

describe("buildDiscoverySeeds", () => {
  it("attributes each seed to discovery with no source selection behind it", () => {
    const [seed] = buildDiscoverySeeds([10, 11], 3);
    expect(seed).toMatchObject({ id: 10, origin: "discovery", sourceCount: 1 });
    expect(seed?.relations).toEqual([
      { sourceId: null, relationType: DISCOVERY_RELATION_TYPE, weight: 0.3 },
    ]);
  });

  it("scores below any relation-backed candidate", () => {
    const [discovered] = buildDiscoverySeeds([10], 3);
    const [related] = buildCandidateSeeds(
      selectedThree(),
      [[relation(1, 11, "OTHER")], [], []],
      [[], [], []],
      NO_FILTERS,
    );
    expect(discovered?.relationScore).toBeLessThan(related?.relationScore ?? 0);
  });

  it("keeps the order it was given", () => {
    expect(buildDiscoverySeeds([12, 10, 11], 3).map((seed) => seed.id)).toEqual([12, 10, 11]);
  });

  it("builds nothing for an empty discovery response", () => {
    expect(buildDiscoverySeeds([], 3)).toEqual([]);
  });
});
