import type {
  Anime,
  CandidateRelation,
  CandidateSeed,
  CommunityRecommendation,
  RecommendationFilters,
  RelatedAnime,
} from "@/models/anime";
import {
  COMMUNITY_RELATION_TYPE,
  COMMUNITY_WEIGHT,
  CANDIDATE_LIMIT,
  DISCOVERY_RELATION_TYPE,
  DISCOVERY_RELATION_WEIGHT,
  FILTERED_POOL_SIZE,
  relationWeight,
} from "./config";
import { isUnfiltered, matchesRawFormat } from "./filters";

interface CandidateAccumulator {
  bySource: Map<number, CandidateRelation>;
}

export function buildCandidateSeeds(
  selected: Anime[],
  relations: RelatedAnime[][],
  recommendations: CommunityRecommendation[][],
  filters: RecommendationFilters,
): CandidateSeed[] {
  const selectedIds = new Set(selected.map((anime) => anime.id));
  const candidates = new Map<number, CandidateAccumulator>();

  const addCandidate = (id: number, relation: CandidateRelation): void => {
    const existing = candidates.get(id);
    if (!existing) {
      candidates.set(id, { bySource: new Map([[relation.sourceId ?? id, relation]]) });
      return;
    }
    const current = existing.bySource.get(relation.sourceId ?? id);
    if (!current || relation.weight > current.weight) {
      existing.bySource.set(relation.sourceId ?? id, relation);
    }
  };

  relations.flat().forEach((relation) => {
    const weight = relationWeight(relation.relationType);
    if (weight === undefined || relation.mediaType !== "anime" || selectedIds.has(relation.id))
      return;
    if (!matchesRawFormat(relation.format, filters)) return;
    addCandidate(relation.id, {
      sourceId: relation.sourceId,
      relationType: relation.relationType,
      weight,
    });
  });

  recommendations.flat().forEach((recommendation) => {
    if (recommendation.mediaType !== "anime" || selectedIds.has(recommendation.id)) return;
    if (!matchesRawFormat(recommendation.format, filters)) return;
    addCandidate(recommendation.id, {
      sourceId: recommendation.sourceId,
      relationType: COMMUNITY_RELATION_TYPE,
      weight: COMMUNITY_WEIGHT,
    });
  });

  return rankSeeds(
    [...candidates.entries()].map(([id, candidate]) =>
      toSeed(id, "relation", candidate.bySource, selected.length),
    ),
    filters,
  );
}

export function buildDiscoverySeeds(ids: number[], selectedCount: number): CandidateSeed[] {
  return ids.map((id) => ({
    id,
    origin: "discovery" as const,
    relations: [
      { sourceId: null, relationType: DISCOVERY_RELATION_TYPE, weight: DISCOVERY_RELATION_WEIGHT },
    ],
    sourceCount: 1,
    relationScore: DISCOVERY_RELATION_WEIGHT / selectedCount,
  }));
}

function toSeed(
  id: number,
  origin: CandidateSeed["origin"],
  bySource: Map<number, CandidateRelation>,
  selectedCount = 1,
): CandidateSeed {
  const relations = [...bySource.values()];
  return {
    id,
    origin,
    relations,
    sourceCount: relations.length,
    relationScore:
      relations.reduce((total, relation) => total + relation.weight, 0) / selectedCount,
  };
}

function rankSeeds(seeds: CandidateSeed[], filters: RecommendationFilters): CandidateSeed[] {
  const poolSize = isUnfiltered(filters) ? CANDIDATE_LIMIT : FILTERED_POOL_SIZE;
  return seeds
    .sort(
      (a, b) => b.relationScore - a.relationScore || b.sourceCount - a.sourceCount || a.id - b.id,
    )
    .slice(0, poolSize);
}
