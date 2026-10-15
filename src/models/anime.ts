export const ANIME_FORMATS = ["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL"] as const;

export type AnimeFormat = (typeof ANIME_FORMATS)[number];

export const ANIME_FORMAT_LABELS: Readonly<Record<AnimeFormat, string>> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
};

export function isAnimeFormat(value: string): value is AnimeFormat {
  return (ANIME_FORMATS as readonly string[]).includes(value);
}

export interface RecommendationFilters {
  formats: AnimeFormat[];
  maxEpisodes: number | null;
}

export const NO_FILTERS: RecommendationFilters = { formats: [], maxEpisodes: null };

export interface AnimeSearchResult {
  id: number;
  title: string;
  nativeTitle: string | null;
  imageUrl: string | null;
  type: string | null;
  year: number | null;
  episodes: number | null;
}

export interface Anime extends AnimeSearchResult {
  genres: string[];
  themes: string[];
  mainStudios: string[];
  popularity: number;
  score: number | null;
  isAdult: boolean;
  relations: AnimeRelation[];
}

export interface AnimeRelation {
  id: number;
  title: string;
  mediaType: string;
  format: string;
  relationType: string;
}

export interface RelatedAnime {
  id: number;
  title: string;
  mediaType: string;
  format: string;
  sourceId: number;
  relationType: string;
}

export interface CommunityRecommendation {
  id: number;
  title: string;
  mediaType: string;
  format: string;
  sourceId: number;
  rating: number;
}

export interface AnimeConnections {
  relations: RelatedAnime[];
  recommendations: CommunityRecommendation[];
}

export interface DiscoveryCandidate {
  id: number;
  format: AnimeFormat | null;
  episodes: number | null;
  popularity: number;
}

export interface CandidateRelation {
  sourceId: number | null;
  relationType: string;
  weight: number;
}

export type CandidateOrigin = "relation" | "discovery";

export interface CandidateSeed {
  id: number;
  origin: CandidateOrigin;
  relations: CandidateRelation[];
  sourceCount: number;
  relationScore: number;
}

export interface Candidate extends CandidateSeed {
  anime: Anime;
  finalScore: number;
  reasons: string[];
}

export interface Recommendation {
  anime: Anime;
  reasons: string[];
  basedOn: Anime[];
}

export type RecommendationResult =
  { kind: "recommendation"; results: Recommendation[] } | { kind: "no-match" };
