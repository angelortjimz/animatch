import {
  ANIME_FORMAT_LABELS,
  isAnimeFormat,
  type Anime,
  type AnimeFormat,
  type RecommendationFilters,
} from "@/models/anime";
import { DISCOVERY_GENRE_LIMIT, EPISODE_SLIDER_MAX, EPISODE_SLIDER_MIN } from "./config";
import { compareText } from "./ordering";

export function clampMaxEpisodes(value: number): number {
  if (!Number.isFinite(value)) return EPISODE_SLIDER_MIN;
  return Math.min(EPISODE_SLIDER_MAX, Math.max(EPISODE_SLIDER_MIN, Math.round(value)));
}

export function rawAnimeFormat(label: string | null | undefined): AnimeFormat | null {
  if (!label) return null;
  const match = (Object.entries(ANIME_FORMAT_LABELS) as [AnimeFormat, string][]).find(
    ([, text]) => text === label,
  );
  return match?.[0] ?? null;
}

export function matchesFormat(anime: Anime, filters: RecommendationFilters): boolean {
  if (filters.formats.length === 0) return true;
  const format = rawAnimeFormat(anime.type);
  return format !== null && filters.formats.includes(format);
}

export function matchesRawFormat(format: string, filters: RecommendationFilters): boolean {
  if (filters.formats.length === 0) return true;
  return isAnimeFormat(format) && filters.formats.includes(format);
}

export function matchesEpisodeLimit(
  episodes: number | null,
  filters: RecommendationFilters,
): boolean {
  if (filters.maxEpisodes === null) return true;
  if (episodes === null) return true;
  return episodes >= EPISODE_SLIDER_MIN && episodes <= filters.maxEpisodes;
}

export function isUnfiltered(filters: RecommendationFilters): boolean {
  return filters.formats.length === 0 && filters.maxEpisodes === null;
}

export function sharedGenres(selected: Anime[]): string[] {
  const counts = new Map<string, number>();
  for (const anime of selected) {
    for (const genre of new Set(anime.genres)) {
      if (genre.trim()) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, DISCOVERY_GENRE_LIMIT)
    .map(([genre]) => genre);
}

const PLURAL_FORMAT_LABELS: Readonly<Record<AnimeFormat, string>> = {
  TV: "TV",
  TV_SHORT: "TV shorts",
  MOVIE: "Movies",
  OVA: "OVAs",
  ONA: "ONAs",
  SPECIAL: "Specials",
};

export function formatLabel(filters: RecommendationFilters): string {
  if (filters.formats.length === 0) return "Any format";
  const labels = filters.formats.map((format) => PLURAL_FORMAT_LABELS[format]);
  if (labels.length === 1) return labels[0] ?? "Any format";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function episodeLabel(filters: RecommendationFilters): string {
  return filters.maxEpisodes === null
    ? "Any length"
    : `Up to ${filters.maxEpisodes} episode${filters.maxEpisodes === 1 ? "" : "s"}`;
}

export function filterLabel(filters: RecommendationFilters): string | null {
  if (isUnfiltered(filters)) return null;
  return `${formatLabel(filters)}, ${episodeLabel(filters).toLowerCase()}`;
}
