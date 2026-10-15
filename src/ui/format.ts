import type { AnimeSearchResult } from "@/models/anime";
import { ANILIST_SCORE_SCALE } from "./config";

export function metaLine(item: AnimeSearchResult): string {
  return [item.year, item.type, item.episodes ? `${item.episodes} episodes` : null]
    .filter(Boolean)
    .join(" - ");
}

export function studioLine(studios: string[]): string {
  return studios.join(", ");
}

export function scoreLine(score: number | null): string | null {
  if (score === null) return null;
  return `AniList score ${(score / ANILIST_SCORE_SCALE).toFixed(1)} / ${ANILIST_SCORE_SCALE}`;
}

export function anilistUrl(id: number): string {
  return `https://anilist.co/anime/${encodeURIComponent(String(id))}`;
}
