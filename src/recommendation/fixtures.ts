import type {
  Anime,
  AnimeRelation,
  CommunityRecommendation,
  DiscoveryCandidate,
  RecommendationFilters,
  RelatedAnime,
} from "@/models/anime";

export const anime = (id: number, overrides: Partial<Anime> = {}): Anime => ({
  id,
  title: `Anime ${id}`,
  nativeTitle: null,
  imageUrl: null,
  type: "TV",
  year: 2020,
  episodes: 12,
  genres: ["Drama", "Mystery"],
  themes: ["Psychological"],
  mainStudios: ["Studio A"],
  popularity: 100,
  score: 82,
  isAdult: false,
  relations: [],
  ...overrides,
});

export const animeRelation = (
  id: number,
  overrides: Partial<AnimeRelation> = {},
): AnimeRelation => ({
  id,
  title: `Anime ${id}`,
  mediaType: "anime",
  format: "TV",
  relationType: "PREQUEL",
  ...overrides,
});

export const selectedThree = (): Anime[] => [anime(1), anime(2), anime(3)];

export const relation = (
  sourceId: number,
  id: number,
  relationType: string,
  mediaType = "anime",
  format = "TV",
): RelatedAnime => ({
  sourceId,
  id,
  relationType,
  mediaType,
  format,
  title: `Anime ${id}`,
});

export const communityRecommendation = (
  sourceId: number,
  id: number,
  rating = 10,
  mediaType = "anime",
  format = "TV",
): CommunityRecommendation => ({
  sourceId,
  id,
  rating,
  mediaType,
  format,
  title: `Anime ${id}`,
});

export const discoveryCandidate = (
  id: number,
  overrides: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id,
  format: "TV",
  episodes: 12,
  popularity: 100,
  ...overrides,
});

export const filters = (overrides: Partial<RecommendationFilters> = {}): RecommendationFilters => ({
  formats: [],
  maxEpisodes: null,
  ...overrides,
});

export function reversed<T>(items: T[]): T[] {
  return [...items].reverse();
}
