import {
  getAnimeBatch,
  getAnimeConnections,
  getDiscoveryCandidates,
  isAbortError,
} from "@/api/anilist";
import type {
  Anime,
  Candidate,
  CandidateSeed,
  RecommendationFilters,
  RecommendationResult,
  RelatedAnime,
} from "@/models/anime";
import { buildCandidateSeeds, buildDiscoverySeeds } from "./candidates";
import {
  CANDIDATE_LIMIT,
  DISCOVERY_MAX_PAGES,
  DISCOVERY_PER_PAGE,
  REQUIRED_SELECTIONS,
} from "./config";
import { matchesEpisodeLimit, sharedGenres } from "./filters";
import { passesPrerequisiteGate } from "./prerequisites";
import { generateReasons } from "./reasons";
import { rankCandidates, scoreCandidate } from "./scoring";

async function hydrateCandidates(
  seeds: CandidateSeed[],
  selected: Anime[],
  signal?: AbortSignal,
): Promise<Candidate[]> {
  if (seeds.length === 0) return [];
  const anime = await getAnimeBatch(
    seeds.map((seed) => seed.id),
    signal,
  );
  const byId = new Map(anime.map((item) => [item.id, item]));
  return seeds.flatMap((seed) => {
    const found = byId.get(seed.id);
    return found && !found.isAdult ? [scoreCandidate(seed, found, selected)] : [];
  });
}

async function eligibleFromSeeds(
  seeds: CandidateSeed[],
  selected: Anime[],
  selectedRelations: RelatedAnime[][],
  filters: RecommendationFilters,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const hydrated = await hydrateCandidates(seeds, selected, signal);
  return hydrated.filter(
    (candidate) =>
      matchesEpisodeLimit(candidate.anime.episodes, filters) &&
      passesPrerequisiteGate(candidate.anime, selected, selectedRelations),
  );
}

async function topUpPool(
  selected: Anime[],
  filters: RecommendationFilters,
  excludeIds: number[],
  shortfall: number,
  signal?: AbortSignal,
): Promise<CandidateSeed[]> {
  const genres = sharedGenres(selected);
  if (genres.length === 0) return [];
  const seen = new Set(excludeIds);
  const discovered: number[] = [];

  for (let page = 1; page <= DISCOVERY_MAX_PAGES && discovered.length < shortfall; page += 1) {
    const rows = await getDiscoveryCandidates(
      {
        genres,
        formats: filters.formats,
        excludeIds: [...seen],
        page,
        perPage: DISCOVERY_PER_PAGE,
      },
      signal,
    );
    for (const row of rows) {
      if (seen.has(row.id) || !matchesEpisodeLimit(row.episodes, filters)) continue;
      seen.add(row.id);
      discovered.push(row.id);
      if (discovered.length >= shortfall) break;
    }
  }
  return buildDiscoverySeeds(discovered, selected.length);
}

function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.anime.id)) return false;
    seen.add(candidate.anime.id);
    return true;
  });
}

export async function recommend(
  selected: Anime[],
  filters: RecommendationFilters,
  signal?: AbortSignal,
): Promise<RecommendationResult> {
  const distinctIds = new Set(selected.map((anime) => anime.id)).size;
  if (selected.length !== REQUIRED_SELECTIONS || distinctIds !== REQUIRED_SELECTIONS) {
    throw new Error(`${REQUIRED_SELECTIONS} different anime are required for a recommendation.`);
  }
  const connections = await Promise.all(
    selected.map((anime) => getAnimeConnections(anime.id, signal)),
  );
  const selectedRelations = connections.map((connection) => connection.relations);
  const seeds = buildCandidateSeeds(
    selected,
    selectedRelations,
    connections.map((connection) => connection.recommendations),
    filters,
  );
  const excludeIds = [...selected.map((anime) => anime.id), ...seeds.map((seed) => seed.id)];
  const eligible = await eligibleFromSeeds(seeds, selected, selectedRelations, filters, signal);

  let candidates = eligible;
  const shortfall = CANDIDATE_LIMIT - eligible.length;
  if (shortfall > 0) {
    let discovered: CandidateSeed[] = [];
    try {
      discovered = await topUpPool(selected, filters, excludeIds, shortfall, signal);
    } catch (error) {
      if (isAbortError(error) || eligible.length === 0) throw error;
    }
    if (discovered.length > 0) {
      const extras = await eligibleFromSeeds(
        discovered,
        selected,
        selectedRelations,
        filters,
        signal,
      );
      candidates = uniqueCandidates([...eligible, ...extras]);
    }
  }

  const results = rankCandidates(candidates)
    .slice(0, CANDIDATE_LIMIT)
    .map((candidate) => ({
      anime: candidate.anime,
      reasons: generateReasons(candidate, selected),
      basedOn: selected,
    }));
  if (results.length === 0) return { kind: "no-match" };
  return { kind: "recommendation", results };
}
