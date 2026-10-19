import {
  ANIME_FORMAT_LABELS,
  isAnimeFormat,
  type Anime,
  type AnimeConnections,
  type AnimeFormat,
  type AnimeRelation,
  type AnimeSearchResult,
  type CommunityRecommendation,
  type DiscoveryCandidate,
  type RelatedAnime,
} from "@/models/anime";
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  RATE_LIMIT_FLOOR,
  RATE_LIMIT_WINDOW_MS,
  REQUEST_TIMEOUT_MS,
  RETRY_AFTER_MAX_MS,
} from "./config";

const BASE_URL = "https://graphql.anilist.co";
const SEARCH_LIMIT = 5;
export const SEARCH_MIN_LENGTH = 3;
const BATCH_LIMIT = 50;
const RECOMMENDATION_LIMIT = 25;
const MAX_RETRIES = 2;

export class AnilistError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AnilistError";
  }
}

export class RateLimitError extends AnilistError {
  constructor(public readonly retryAt: number) {
    super("AniList is temporarily unavailable. Please try again shortly.");
    this.name = "RateLimitError";
  }
}

interface AnilistTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface AnilistTag {
  name?: string | null;
  category?: string | null;
}

interface AnilistCoverImage {
  large?: string | null;
  medium?: string | null;
}

interface AnilistStudio {
  name?: string | null;
}

interface AnilistStudioEdge {
  node?: AnilistStudio | null;
}

interface AnilistRecommendationNode {
  rating?: number | null;
  mediaRecommendation?: AnilistMedia | null;
}

interface AnilistMedia {
  id?: number;
  title?: AnilistTitle;
  format?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  genres?: Array<string | null>;
  tags?: AnilistTag[];
  studios?: { edges?: Array<AnilistStudioEdge | null> };
  coverImage?: AnilistCoverImage;
  isAdult?: boolean | null;
  type?: string | null;
  popularity?: number | null;
  averageScore?: number | null;
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: AnilistMedia | null;
    } | null>;
  };
  recommendations?: {
    edges?: Array<{
      node?: AnilistRecommendationNode | null;
    } | null>;
  };
}

interface AnilistResponse<T> {
  data?: T | null;
  errors?: Array<{ message?: string; status?: number }>;
}

interface AnilistPageResponse {
  Page?: { media?: AnilistMedia[] };
}

interface AnilistMediaResponse {
  Media?: AnilistMedia | null;
}

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, isAdult: false) {
        id
        title { romaji english native }
        format
        seasonYear
        episodes
        coverImage { large medium }
      }
    }
  }
`;

const CONNECTIONS_QUERY = `
  query ($id: Int, $perPage: Int) {
    Media(id: $id) {
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english native }
            format
            type
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: $perPage) {
        edges {
          node {
            rating
            mediaRecommendation {
              id
              title { romaji english native }
              format
              type
            }
          }
        }
      }
    }
  }
`;

const BATCH_QUERY = `
  query ($ids: [Int], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(id_in: $ids, type: ANIME, isAdult: false) {
        id
        title { romaji english native }
        format
        seasonYear
        episodes
        genres
        tags { name category }
        studios(isMain: true) { edges { node { name } } }
        coverImage { large medium }
        isAdult
        popularity
        averageScore
        relations {
          edges {
            relationType
            node { id title { romaji english native } type format }
          }
        }
      }
    }
  }
`;

const DISCOVERY_QUERY = `
  query ($genres: [String], $formatIn: [MediaFormat], $idNotIn: [Int], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(
        genre_in: $genres
        format_in: $formatIn
        id_not_in: $idNotIn
        type: ANIME
        isAdult: false
        sort: POPULARITY_DESC
      ) {
        id
        format
        episodes
        popularity
      }
    }
  }
`;

const FORMAT_LABELS: Readonly<Record<string, string>> = ANIME_FORMAT_LABELS;

function isThemeCategory(category: string | null | undefined): boolean {
  return category?.startsWith("Theme-") === true || category?.startsWith("Setting-") === true;
}

function imageUrl(media: AnilistMedia): string | null {
  return media.coverImage?.large ?? media.coverImage?.medium ?? null;
}

function isId(value: number | undefined | null): value is number {
  return Number.isInteger(value);
}

function requiredId(media: AnilistMedia): number {
  if (!isId(media.id)) {
    throw new AnilistError("The anime response did not include a valid identifier.");
  }
  return media.id;
}

function scoreOf(media: AnilistMedia): number | null {
  const score = media.averageScore;
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) return null;
  return score;
}

function titleOf(media: Pick<AnilistMedia, "title">): string | null {
  const title = [media.title?.english, media.title?.romaji, media.title?.native].find((value) =>
    value?.trim(),
  );
  return title?.trim() ?? null;
}

function requiredTitle(media: AnilistMedia): string {
  const title = titleOf(media);
  if (!title) {
    throw new AnilistError("The anime response did not include a title.");
  }
  return title;
}

function formatLabel(media: Pick<AnilistMedia, "format">): string | null {
  const format = media.format;
  if (!format) return null;
  return FORMAT_LABELS[format] ?? format.replace(/_/g, " ");
}

function mainStudios(media: AnilistMedia): string[] {
  return (media.studios?.edges ?? []).flatMap((edge) => {
    const name = edge?.node?.name?.trim();
    return name ? [name] : [];
  });
}

function themes(media: AnilistMedia): string[] {
  return (media.tags ?? []).flatMap((tag) =>
    isThemeCategory(tag.category) && tag.name?.trim() ? [tag.name] : [],
  );
}

function genres(media: AnilistMedia): string[] {
  return (media.genres ?? []).flatMap((genre) => (genre?.trim() ? [genre] : []));
}

function animeRelations(media: AnilistMedia): AnimeRelation[] {
  return (media.relations?.edges ?? []).flatMap((edge) => {
    const node = edge?.node;
    const id = node?.id;
    const relationType = edge?.relationType?.trim();
    const title = node ? titleOf(node) : null;
    const mediaType = node ? mediaTypeLabel(node) : null;
    const format = node?.format?.trim();
    if (!node || !isId(id) || !title || !mediaType || !relationType || !format) return [];
    return [{ id, title, mediaType, format, relationType }];
  });
}

function mediaTypeLabel(media: AnilistMedia): string | null {
  return media.type === "ANIME" ? "anime" : media.type === "MANGA" ? "manga" : null;
}

function nativeTitleOf(media: Pick<AnilistMedia, "title">, display: string): string | null {
  const native = media.title?.native?.trim();
  return native && native !== display ? native : null;
}

export function normalizeSearchResult(media: AnilistMedia): AnimeSearchResult {
  const title = requiredTitle(media);
  return {
    id: requiredId(media),
    title,
    nativeTitle: nativeTitleOf(media, title),
    imageUrl: imageUrl(media),
    type: formatLabel(media),
    year: media.seasonYear ?? null,
    episodes: media.episodes ?? null,
  };
}

export function normalizeAnime(media: AnilistMedia): Anime {
  return {
    ...normalizeSearchResult(media),
    genres: genres(media),
    themes: themes(media),
    mainStudios: mainStudios(media),
    popularity: media.popularity ?? 0,
    score: scoreOf(media),
    isAdult: media.isAdult ?? false,
    relations: animeRelations(media),
  };
}

function toRelatedAnime(
  edge: { relationType?: string | null; node?: AnilistMedia | null } | null | undefined,
  sourceId: number,
): RelatedAnime | null {
  const node = edge?.node;
  const id = node?.id;
  const title = node ? titleOf(node) : null;
  const mediaType = node ? mediaTypeLabel(node) : null;
  const format = node?.format?.trim();
  const relationType = edge?.relationType?.trim() ?? null;
  if (!node || !isId(id) || !title || !mediaType || !format || !relationType) return null;
  return { id, title, mediaType, format, sourceId, relationType };
}

function toCommunityRecommendation(
  edge: { node?: AnilistRecommendationNode | null } | null | undefined,
  sourceId: number,
): CommunityRecommendation | null {
  const node = edge?.node;
  const media = node?.mediaRecommendation;
  const id = media?.id;
  const title = media ? titleOf(media) : null;
  const mediaType = media ? mediaTypeLabel(media) : null;
  const format = media?.format?.trim();
  if (!node || !media || !isId(id) || !title || !mediaType || !format) return null;
  return {
    id,
    title,
    mediaType,
    format,
    sourceId,
    rating: typeof node.rating === "number" && Number.isFinite(node.rating) ? node.rating : 0,
  };
}

function toDiscoveryCandidate(media: AnilistMedia): DiscoveryCandidate | null {
  const id = media.id;
  if (!isId(id)) return null;
  const format = media.format?.trim() ?? "";
  const episodes = media.episodes;
  return {
    id,
    format: isAnimeFormat(format) ? format : null,
    episodes: typeof episodes === "number" && Number.isFinite(episodes) ? episodes : null,
    popularity:
      typeof media.popularity === "number" && Number.isFinite(media.popularity)
        ? media.popularity
        : 0,
  };
}

function abortError(): Error {
  const error = new Error("The request was cancelled.");
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

function timeoutError(): Error {
  const error = new Error("The request timed out.");
  error.name = "TimeoutError";
  return error;
}

interface DeadlinedSignal {
  signal: AbortSignal;
  dispose: () => void;
}

function withDeadline(signal?: AbortSignal): DeadlinedSignal {
  const controller = new AbortController();
  if (signal?.aborted) {
    controller.abort();
    return { signal: controller.signal, dispose: () => {} };
  }
  const abort = (): void => controller.abort();
  const timer = setTimeout(() => controller.abort(timeoutError()), REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    function onAbort(): void {
      clearTimeout(timeout);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error("The request failed."));
      },
    );
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("Retry-After")?.trim();
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return clamp(seconds * 1000, 0, RETRY_AFTER_MAX_MS);
  }
  const date = Date.parse(header);
  if (!Number.isFinite(date)) return null;
  return clamp(date - Date.now(), 0, RETRY_AFTER_MAX_MS);
}

function isRetryable(status: number | undefined): boolean {
  return status === 429 || (status ?? 0) >= 500;
}

interface RawResponse<T> {
  response: Response;
  payload: AnilistResponse<T>;
}

async function requestOnce<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RawResponse<T>> {
  const request = withDeadline(signal);
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: request.signal,
    });
    trackRateLimit(response);
    const payload = (await response.json()) as AnilistResponse<T>;
    return { response, payload };
  } finally {
    request.dispose();
  }
}

async function fetchJson<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw abortError();
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const backoff = 500 * 2 ** attempt;
    try {
      const { response, payload } = await requestOnce<T>(query, variables, signal);
      const graphQlError = payload.errors?.[0];
      const status = response.ok ? (graphQlError?.status ?? 200) : response.status;
      if (response.ok && !graphQlError) {
        if (payload.data === null || payload.data === undefined) {
          throw new AnilistError("AniList returned no data.");
        }
        return payload.data;
      }
      if (!isRetryable(status)) {
        throw new AnilistError("AniList could not retrieve this anime.", status);
      }
      lastError = new AnilistError("AniList is temporarily unavailable.", status);
      if (attempt < MAX_RETRIES) {
        await delay(retryAfterMs(response) ?? backoff, signal);
      }
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (error instanceof AnilistError && !isRetryable(error.status)) throw error;
      lastError = error;
      if (attempt < MAX_RETRIES) await delay(backoff, signal);
    }
  }
  if (lastError instanceof AnilistError) throw lastError;
  throw new AnilistError("We could not connect to AniList. Please try again.");
}

interface RateLimitState {
  remaining: number | null;
  resetAt: number | null;
}

const rateLimit: RateLimitState = { remaining: null, resetAt: null };

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function trackRateLimit(response: Response): void {
  const now = Date.now();
  const remaining = headerNumber(response.headers, "X-RateLimit-Remaining");
  if (remaining !== null) rateLimit.remaining = Math.max(0, remaining);
  if (rateLimit.remaining === null) return;
  if (rateLimit.remaining > RATE_LIMIT_FLOOR) {
    rateLimit.resetAt = null;
    return;
  }
  const reset = headerNumber(response.headers, "X-RateLimit-Reset");
  if (reset !== null && reset > 0) {
    rateLimit.resetAt = Math.min(Math.max(reset * 1000, now), now + RATE_LIMIT_WINDOW_MS);
  } else if (rateLimit.resetAt === null || rateLimit.resetAt <= now) {
    rateLimit.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
}

function rateLimitRetryAt(): number | null {
  if (rateLimit.remaining === null || rateLimit.remaining > RATE_LIMIT_FLOOR) return null;
  const now = Date.now();
  if (rateLimit.resetAt === null) rateLimit.resetAt = now + RATE_LIMIT_WINDOW_MS;
  if (now >= rateLimit.resetAt) {
    rateLimit.remaining = null;
    rateLimit.resetAt = null;
    return null;
  }
  return rateLimit.resetAt;
}

function assertRateLimitBudget(): void {
  const retryAt = rateLimitRetryAt();
  if (retryAt !== null) throw new RateLimitError(retryAt);
}

interface CacheEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
  createdAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function dropEntry(key: string, entry: CacheEntry<unknown>): void {
  if (cache.get(key) === entry) cache.delete(key);
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.createdAt >= CACHE_TTL_MS;
}

function touchEntry(key: string, entry: CacheEntry<unknown>): void {
  cache.delete(key);
  cache.set(key, entry);
}

function evictOverflow(): void {
  if (cache.size <= CACHE_MAX_ENTRIES) return;
  for (const [key, entry] of cache) {
    if (entry.subscribers > 0 || !entry.settled) continue;
    cache.delete(key);
    if (cache.size <= CACHE_MAX_ENTRIES) return;
  }
}

function startEntry<T>(key: string, load: (signal: AbortSignal) => Promise<T>): CacheEntry<T> {
  const controller = new AbortController();
  const promise = load(controller.signal);
  const entry: CacheEntry<T> = {
    promise,
    controller,
    subscribers: 0,
    settled: false,
    createdAt: Date.now(),
  };
  promise.then(
    () => {
      entry.settled = true;
    },
    () => {
      entry.settled = true;
      dropEntry(key, entry);
    },
  );
  promise.catch(() => {});
  cache.set(key, entry);
  evictOverflow();
  return entry;
}

function cached<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && isExpired(entry)) {
    dropEntry(key, entry);
    entry = undefined;
  }
  if (entry) {
    touchEntry(key, entry);
  } else {
    entry = startEntry(key, load);
  }
  entry.subscribers += 1;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    entry.subscribers -= 1;
    if (entry.subscribers <= 0 && !entry.settled) {
      entry.controller.abort();
      dropEntry(key, entry);
    }
  };
  return withAbort(entry.promise, signal).finally(release);
}

function normalizeQueryKey(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ");
}

export async function searchAnime(
  query: string,
  signal?: AbortSignal,
): Promise<AnimeSearchResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < SEARCH_MIN_LENGTH) return [];
  const variables = { search: cleanQuery, page: 1, perPage: SEARCH_LIMIT };
  const key = `search:${normalizeQueryKey(cleanQuery)}`;
  return cached(
    key,
    async (requestSignal) => {
      assertRateLimitBudget();
      const response = await fetchJson<AnilistPageResponse>(SEARCH_QUERY, variables, requestSignal);
      const media = response.Page?.media;
      if (!Array.isArray(media))
        throw new AnilistError("AniList returned an invalid search response.");
      return media.map(normalizeSearchResult);
    },
    signal,
  );
}

export function getAnimeConnections(id: number, signal?: AbortSignal): Promise<AnimeConnections> {
  return cached(
    `connections:${id}`,
    async (requestSignal) => {
      assertRateLimitBudget();
      const response = await fetchJson<AnilistMediaResponse>(
        CONNECTIONS_QUERY,
        { id, perPage: RECOMMENDATION_LIMIT },
        requestSignal,
      );
      const media = response.Media;
      if (!media) throw new AnilistError("AniList returned no anime details.");
      const relationEdges = media.relations?.edges;
      if (!Array.isArray(relationEdges)) {
        throw new AnilistError("AniList returned invalid relation data.");
      }
      const relations = relationEdges
        .map((edge) => toRelatedAnime(edge, id))
        .filter((relation): relation is RelatedAnime => relation !== null);
      const recommendationEdges = media.recommendations?.edges ?? [];
      const recommendations = recommendationEdges
        .map((edge) => toCommunityRecommendation(edge, id))
        .filter(
          (recommendation): recommendation is CommunityRecommendation => recommendation !== null,
        );
      return { relations, recommendations };
    },
    signal,
  );
}

export function getAnimeBatch(ids: number[], signal?: AbortSignal): Promise<Anime[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return Promise.resolve([]);
  const key = `batch:${[...uniqueIds].sort((a, b) => a - b).join(",")}`;
  return cached(
    key,
    async (requestSignal) => {
      const anime: Anime[] = [];
      for (let offset = 0; offset < uniqueIds.length; offset += BATCH_LIMIT) {
        assertRateLimitBudget();
        const chunk = uniqueIds.slice(offset, offset + BATCH_LIMIT);
        const response = await fetchJson<AnilistPageResponse>(
          BATCH_QUERY,
          {
            ids: chunk,
            page: 1,
            perPage: chunk.length,
          },
          requestSignal,
        );
        const media = response.Page?.media;
        if (!Array.isArray(media))
          throw new AnilistError("AniList returned an invalid batch response.");
        anime.push(...media.map(normalizeAnime));
      }
      return anime;
    },
    signal,
  );
}

export interface DiscoveryRequest {
  genres: string[];
  formats: AnimeFormat[];
  excludeIds: number[];
  page: number;
  perPage: number;
}

export async function getDiscoveryCandidates(
  request: DiscoveryRequest,
  signal?: AbortSignal,
): Promise<DiscoveryCandidate[]> {
  if (request.genres.length === 0 || request.excludeIds.length === 0) return [];
  const variables: Record<string, unknown> = {
    genres: request.genres,
    idNotIn: request.excludeIds,
    page: request.page,
    perPage: request.perPage,
  };

  if (request.formats.length > 0) variables.formatIn = request.formats;
  assertRateLimitBudget();
  const response = await fetchJson<AnilistPageResponse>(DISCOVERY_QUERY, variables, signal);
  const media = response.Page?.media;
  if (!Array.isArray(media))
    throw new AnilistError("AniList returned an invalid discovery response.");
  return media.flatMap((entry) => {
    const candidate = toDiscoveryCandidate(entry);
    return candidate ? [candidate] : [];
  });
}

export function clearAnilistCache(): void {
  for (const entry of cache.values()) {
    if (!entry.settled) entry.controller.abort();
  }
  cache.clear();
  rateLimit.remaining = null;
  rateLimit.resetAt = null;
}
