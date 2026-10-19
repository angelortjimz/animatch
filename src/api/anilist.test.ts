import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Anime } from "@/models/anime";
import {
  AnilistError,
  RateLimitError,
  clearAnilistCache,
  getAnimeBatch,
  getAnimeConnections,
  getDiscoveryCandidates,
  isAbortError,
  normalizeAnime,
  normalizeSearchResult,
  searchAnime,
} from "./anilist";
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  RATE_LIMIT_WINDOW_MS,
  REQUEST_TIMEOUT_MS,
} from "./config";

beforeEach(() => {
  clearAnilistCache();
});

afterEach(() => {
  clearAnilistCache();
  vi.useRealTimers();
  // restoreAllMocks does not undo stubGlobal; without this a stubbed `fetch`
  // silently leaks into every later test in this file.
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const media = {
  id: 1,
  title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop", native: "カウボーイビバップ" },
  format: "TV",
  seasonYear: 1998,
  episodes: 26,
  genres: ["Sci-Fi"],
  tags: [
    { name: "Space", category: "Setting-Universe" },
    { name: "Philosophy", category: "Theme-Other" },
    { name: "Ensemble Cast", category: "Cast-Main Cast" },
  ],
  studios: { edges: [{ node: { name: "Sunrise" } }] },
  coverImage: { large: "cover.jpg" },
  isAdult: false,
  popularity: 1000,
  averageScore: 84,
};

/**
 * A fetch-Response stand-in using a real `Headers`, whose `get` returns `null`
 * for a missing key. A `Map` returns `undefined` and hides header handling bugs.
 */
function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): unknown {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init.headers ?? {}),
    json: async () => body,
  };
}

function dataResponse(data: unknown, status = 200): unknown {
  return jsonResponse({ data }, { status });
}

function errorResponse(status: number, headers: Record<string, string> = {}): unknown {
  return jsonResponse({ errors: [{ message: "Boom", status }] }, { status, headers });
}

function stubFetch(...responses: unknown[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  // A 200 with `data: null` is terminal to the client, so the fallback must be
  // a retryable error to keep the retry loop going.
  fetchMock.mockResolvedValue(errorResponse(503));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A fetch stub that honours `signal` the way the real one does. */
function signalAwareFetch(
  handler: (call: number, init: RequestInit) => unknown,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.signal?.aborted) throw abortError();
    return handler(fetchMock.mock.calls.length, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A fetch stub that never resolves, but rejects the moment its signal aborts. */
function hangingFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<never>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(abortError()), { once: true });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  call = 0,
): {
  query: string;
  variables: Record<string, unknown>;
} {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;
  return JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> };
}

function abortError(): DOMException {
  return new DOMException("The request was cancelled.", "AbortError");
}

/** Single-anime convenience over the batch endpoint, which is all the app uses. */
async function loadAnime(id: number): Promise<Anime> {
  const [anime] = await getAnimeBatch([id]);
  if (!anime) throw new AnilistError(`AniList returned no details for ${id}.`);
  return anime;
}

describe("AniList normalization", () => {
  it("keeps the application model narrow", () => {
    expect(normalizeSearchResult(media)).toEqual({
      id: 1,
      title: "Cowboy Bebop",
      nativeTitle: "カウボーイビバップ",
      imageUrl: "cover.jpg",
      type: "TV",
      year: 1998,
      episodes: 26,
    });
    expect(normalizeAnime(media)).toMatchObject({
      id: 1,
      genres: ["Sci-Fi"],
      themes: ["Space", "Philosophy"],
      mainStudios: ["Sunrise"],
      popularity: 1000,
      score: 84,
      isAdult: false,
    });
  });

  it("keeps AniList's score, and reports an unrated title as having none", () => {
    expect(normalizeAnime(media)?.score).toBe(84);
    expect(normalizeAnime({ ...media, averageScore: null })?.score).toBeNull();
    expect(normalizeAnime({ ...media, averageScore: 0 })?.score).toBeNull();
  });

  it("maps format casing and falls back through title languages", () => {
    expect(normalizeSearchResult({ ...media, format: "MOVIE" })?.type).toBe("Movie");
    expect(normalizeSearchResult({ ...media, format: "TV_SHORT" })?.type).toBe("TV Short");
    expect(normalizeSearchResult({ ...media, title: { romaji: "R", native: "N" } })?.title).toBe(
      "R",
    );
    expect(normalizeSearchResult({ ...media, title: { native: "N" } })?.title).toBe("N");
  });

  it("keeps the native title alongside the display title, and drops a duplicate", () => {
    expect(normalizeSearchResult(media)?.nativeTitle).toBe("カウボーイビバップ");
    expect(
      normalizeSearchResult({
        ...media,
        title: { english: "Same", romaji: "Same", native: "Same" },
      })?.nativeTitle,
    ).toBeNull();
    expect(normalizeSearchResult({ ...media, title: { romaji: "R" } })?.nativeTitle).toBeNull();
  });

  it("drops blank and unnamed studio edges", () => {
    const candidate = normalizeAnime({
      ...media,
      studios: { edges: [{ node: { name: "Sunrise" } }, { node: { name: "   " } }, {}, null] },
    });
    expect(candidate?.mainStudios).toEqual(["Sunrise"]);
  });

  it("normalizes every relation edge, keeping manga links for the policy layer", () => {
    const candidate = normalizeAnime({
      ...media,
      relations: {
        edges: [
          {
            relationType: "PREQUEL",
            node: { id: 20, type: "ANIME", format: "TV", title: { english: "Naruto" } },
          },
          {
            relationType: "ADAPTATION",
            node: { id: 30011, type: "MANGA", format: "MANGA", title: { romaji: "Naruto" } },
          },
          { relationType: "OTHER", node: { id: 5, type: "ANIME" } },
          { relationType: "SIDE_STORY", node: null },
          null,
        ],
      },
    });
    expect(candidate?.relations).toEqual([
      { id: 20, title: "Naruto", mediaType: "anime", format: "TV", relationType: "PREQUEL" },
      {
        id: 30011,
        title: "Naruto",
        mediaType: "manga",
        format: "MANGA",
        relationType: "ADAPTATION",
      },
    ]);
  });

  it("reports no relations when AniList sends none", () => {
    expect(normalizeAnime(media)?.relations).toEqual([]);
    expect(normalizeAnime({ ...media, relations: { edges: [] } })?.relations).toEqual([]);
  });

  it("skips rows missing required fields instead of failing the whole page", () => {
    expect(normalizeSearchResult({ ...media, id: undefined })).toBeNull();
    expect(normalizeSearchResult({ ...media, title: {} })).toBeNull();
    expect(normalizeAnime({ ...media, id: undefined })).toBeNull();
    expect(normalizeAnime({ ...media, title: {} })).toBeNull();
  });
});

describe("AniList requests", () => {
  it("deduplicates identical searches and keeps them SFW", async () => {
    const fetchMock = stubFetch(dataResponse({ Page: { media: [media] } }));
    await Promise.all([searchAnime("Cowboy"), searchAnime("Cowboy"), searchAnime("Cowboy")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graphql.anilist.co");
    expect(init.method).toBe("POST");
    const body = requestBody(fetchMock);
    expect(body.query).toContain("isAdult: false");
    expect(body.variables).toMatchObject({ search: "Cowboy", perPage: 5 });
  });

  it("makes no request for degenerate input", async () => {
    const fetchMock = stubFetch();
    expect(await searchAnime("a")).toEqual([]);
    expect(await searchAnime("   ")).toEqual([]);
    expect(await getAnimeBatch([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps relation enums and keeps anime without a MAL id", async () => {
    stubFetch(
      dataResponse({
        Media: {
          relations: {
            edges: [
              {
                relationType: "SIDE_STORY",
                node: {
                  id: 5,
                  idMal: 5,
                  title: { english: "The Movie" },
                  format: "MOVIE",
                  type: "ANIME",
                },
              },
              {
                relationType: "ADAPTATION",
                node: {
                  id: 30173,
                  idMal: 173,
                  title: { english: "The Manga" },
                  format: "MANGA",
                  type: "MANGA",
                },
              },
              {
                relationType: "SPIN_OFF",
                node: {
                  id: 9,
                  idMal: null,
                  title: { english: "No MAL id" },
                  format: "TV",
                  type: "ANIME",
                },
              },
              {
                relationType: "OTHER",
                node: { id: 10, idMal: 10, title: { english: "Unknown type" }, format: "TV" },
              },
            ],
          },
          recommendations: { edges: [] },
        },
      }),
    );
    const connections = await getAnimeConnections(1);
    expect(connections.relations).toEqual([
      {
        id: 5,
        title: "The Movie",
        mediaType: "anime",
        format: "MOVIE",
        sourceId: 1,
        relationType: "SIDE_STORY",
      },
      {
        id: 30173,
        title: "The Manga",
        mediaType: "manga",
        format: "MANGA",
        sourceId: 1,
        relationType: "ADAPTATION",
      },
      {
        id: 9,
        title: "No MAL id",
        mediaType: "anime",
        format: "TV",
        sourceId: 1,
        relationType: "SPIN_OFF",
      },
    ]);
    expect(connections.recommendations).toEqual([]);
  });

  it("collects community recommendations and keeps unrated ones", async () => {
    stubFetch(
      dataResponse({
        Media: {
          relations: { edges: [] },
          recommendations: {
            edges: [
              {
                node: {
                  rating: 42,
                  mediaRecommendation: {
                    id: 20,
                    idMal: 20,
                    title: { english: "Top Pick" },
                    format: "TV",
                    type: "ANIME",
                  },
                },
              },
              {
                node: {
                  rating: null,
                  mediaRecommendation: {
                    id: 21,
                    idMal: 21,
                    title: { english: "Unrated" },
                    format: "TV",
                    type: "ANIME",
                  },
                },
              },
              { node: { rating: 10, mediaRecommendation: null } },
              {
                node: {
                  rating: 5,
                  mediaRecommendation: {
                    id: 22,
                    idMal: 22,
                    title: { english: "Manga Rec" },
                    format: "MANGA",
                    type: "MANGA",
                  },
                },
              },
            ],
          },
        },
      }),
    );
    const connections = await getAnimeConnections(1);
    expect(connections.recommendations).toEqual([
      { id: 20, title: "Top Pick", mediaType: "anime", format: "TV", sourceId: 1, rating: 42 },
      { id: 21, title: "Unrated", mediaType: "anime", format: "TV", sourceId: 1, rating: 0 },
      { id: 22, title: "Manga Rec", mediaType: "manga", format: "MANGA", sourceId: 1, rating: 5 },
    ]);
  });

  it("fetches multiple anime in one deduplicated batched request", async () => {
    const fetchMock = stubFetch(
      dataResponse({ Page: { media: [media, { ...media, id: 2, idMal: 2 }] } }),
    );
    const anime = await getAnimeBatch([2, 1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = requestBody(fetchMock);
    expect(body.query).toContain("id_in");
    expect(body.variables).toMatchObject({ ids: [2, 1], perPage: 2 });
    expect(anime.map((item) => item.id)).toEqual([1, 2]);
  });

  it("splits batches larger than the AniList page limit into separate requests", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => index + 1);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { variables: { ids: number[] } };
      return jsonResponse({
        data: { Page: { media: body.variables.ids.map((id) => ({ ...media, id })) } },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const anime = await getAnimeBatch(ids);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock, 0).variables.ids).toHaveLength(50);
    expect(requestBody(fetchMock, 1).variables.ids).toEqual([51]);
    expect(anime.map((item) => item.id)).toEqual(ids);
  });

  it("serves a repeated batch from cache and ignores id order", async () => {
    const fetchMock = stubFetch(
      dataResponse({ Page: { media: [media, { ...media, id: 2, idMal: 2 }] } }),
    );

    await getAnimeBatch([2, 1]);
    await getAnimeBatch([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the good search rows when one row is malformed", async () => {
    const fetchMock = stubFetch(
      dataResponse({ Page: { media: [media, { ...media, id: undefined, title: {} }] } }),
    );

    const rows = await searchAnime("bebop");

    expect(rows.map((row) => row.id)).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the good batch rows when one row is malformed", async () => {
    const fetchMock = stubFetch(
      dataResponse({ Page: { media: [media, { ...media, id: 2, title: {} }] } }),
    );

    const anime = await getAnimeBatch([1, 2]);

    expect(anime.map((item) => item.id)).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts data delivered alongside GraphQL errors as a partial success", async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        data: { Page: { media: [media] } },
        errors: [{ message: "Partial failure.", status: 500 }],
      }),
    );

    const rows = await searchAnime("bebop");

    expect(rows.map((row) => row.id)).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a null response body without retrying", async () => {
    const fetchMock = stubFetch(jsonResponse(null));

    await expect(searchAnime("bebop")).rejects.toThrow(/could not retrieve this anime/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("finds a retryable status in any GraphQL error, not only the first", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      jsonResponse({
        data: null,
        errors: [{ message: "No status." }, { message: "Busy.", status: 503 }],
      }),
      dataResponse({ Page: { media: [media] } }),
    );

    const pending = searchAnime("bebop");
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lets AniList narrow the format instead of fetching a page we would thin out", async () => {
    const fetchMock = stubFetch(
      dataResponse({ Page: { media: [{ id: 9, format: "MOVIE", episodes: 1, popularity: 800 }] } }),
    );
    const rows = await getDiscoveryCandidates({
      genres: ["Action"],
      formats: ["MOVIE"],
      excludeIds: [1, 2, 3],
      page: 1,
      perPage: 50,
    });
    const body = requestBody(fetchMock);
    expect(body.query).toContain("format_in");
    expect(body.variables).toMatchObject({
      genres: ["Action"],
      formatIn: ["MOVIE"],
      idNotIn: [1, 2, 3],
      page: 1,
      perPage: 50,
    });
    expect(rows).toEqual([{ id: 9, format: "MOVIE", episodes: 1, popularity: 800 }]);
  });

  it("omits the format argument entirely when any format is allowed", async () => {
    const fetchMock = stubFetch(dataResponse({ Page: { media: [] } }));
    await getDiscoveryCandidates({
      genres: ["Action"],
      formats: [],
      excludeIds: [1],
      page: 1,
      perPage: 50,
    });
    const { variables } = requestBody(fetchMock);
    expect(variables).not.toHaveProperty("formatIn");
  });

  it("makes no request when there is nothing to search on or exclude from", async () => {
    const fetchMock = stubFetch(dataResponse({ Page: { media: [] } }));
    const base = { formats: [], page: 1, perPage: 50, excludeIds: [1] };
    expect(await getDiscoveryCandidates({ ...base, genres: [] })).toEqual([]);
    expect(await getDiscoveryCandidates({ ...base, genres: ["Action"], excludeIds: [] })).toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a row with an unknown episode count and drops an unusable one", async () => {
    stubFetch(
      dataResponse({
        Page: {
          media: [
            { id: 10, format: "TV", episodes: null, popularity: 500 },
            { id: 11, format: "TV", episodes: 12 },
            { id: 12, format: "TV", episodes: 12 },
            { id: 13, format: "NOT_A_FORMAT", episodes: 12 },
            { format: "TV", episodes: 12 },
          ],
        },
      }),
    );
    const rows = await getDiscoveryCandidates({
      genres: ["Action"],
      formats: [],
      excludeIds: [1],
      page: 1,
      perPage: 50,
    });
    expect(rows).toEqual([
      { id: 10, format: "TV", episodes: null, popularity: 500 },
      { id: 11, format: "TV", episodes: 12, popularity: 0 },
      { id: 12, format: "TV", episodes: 12, popularity: 0 },
      { id: 13, format: null, episodes: 12, popularity: 0 },
    ]);
  });

  it("rejects a discovery page that is not a list", async () => {
    stubFetch(dataResponse({ Page: {} }));
    await expect(
      getDiscoveryCandidates({
        genres: ["Action"],
        formats: [],
        excludeIds: [1],
        page: 1,
        perPage: 50,
      }),
    ).rejects.toThrow(/invalid discovery response/);
  });

  it("treats a 404 as terminal and never leaks the raw API text", async () => {
    // A plain HTTP error body...
    const httpFailure = stubFetch(errorResponse(404));
    await expect(loadAnime(1)).rejects.toThrow(/AniList could not retrieve this anime/);
    expect(httpFailure).toHaveBeenCalledTimes(1);

    // ...and a GraphQL error delivered with a 200 both mean "stop immediately".
    const graphqlFailure = stubFetch(
      jsonResponse({ data: null, errors: [{ message: "Not Found.", status: 404 }] }),
    );
    const error = await loadAnime(999999999).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(AnilistError);
    expect((error as AnilistError).message).toMatch(/AniList could not retrieve this anime/);
    expect((error as AnilistError).message).not.toContain("Not Found.");
    expect(graphqlFailure).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure once and then succeeds", async () => {
    const fetchMock = stubFetch(
      errorResponse(429, { "Retry-After": "0" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );
    const anime = await loadAnime(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(anime.id).toBe(1);
  });

  it("gives up with a friendly error once retries are exhausted and drops the failure from the cache", async () => {
    vi.useFakeTimers();
    const failing = vi.fn(async () => errorResponse(503));
    vi.stubGlobal("fetch", failing);

    const failed = loadAnime(1).catch((error: unknown) => error);
    // One initial attempt plus MAX_RETRIES (2) retries, spaced by 500ms + 1000ms.
    await vi.advanceTimersByTimeAsync(1500);
    const error = await failed;
    expect(failing).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(AnilistError);
    expect((error as AnilistError).message).not.toContain("Boom");

    // The rejected promise must not stay cached, so a later call retries.
    const succeeding = stubFetch(dataResponse({ Page: { media: [{ ...media }] } }));
    expect((await loadAnime(1)).id).toBe(1);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});

describe("AniList retry backoff", () => {
  it("waits progressively longer, and never zero, without a Retry-After header", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => errorResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = loadAnime(1).then(
      (value) => ({ ok: true, value }),
      (error: unknown) => ({ ok: false, error }),
    );

    // Attempt 1 fires immediately.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A zero-length delay would already have produced a second attempt here.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The first backoff is 500ms.
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The second backoff is 1000ms, so the third attempt is still pending here.
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Retries are exhausted, so the call rejects.
    const settled = await outcome;
    expect(settled.ok).toBe(false);
    expect((settled as { error: unknown }).error).toBeInstanceOf(AnilistError);
  });

  it("honours a numeric Retry-After and ignores an unparseable one", async () => {
    vi.useFakeTimers();

    // The header asks for 2s, longer than the 500ms default backoff.
    const honoured = stubFetch(
      errorResponse(429, { "Retry-After": "2" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );
    const pending = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(honoured).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(honoured).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(honoured).toHaveBeenCalledTimes(2);
    expect((await pending).id).toBe(1);

    // A fresh cache, so this second scenario is not served from the first's entry.
    clearAnilistCache();

    // "soon" is not a number, so the exponential backoff applies instead.
    const ignored = stubFetch(
      errorResponse(429, { "Retry-After": "soon" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );
    const second = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(499);
    expect(ignored).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(ignored).toHaveBeenCalledTimes(2);
    expect((await second).id).toBe(1);
  });

  it("clamps an unreasonably large Retry-After to one minute", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      errorResponse(429, { "Retry-After": "1e308" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );

    const pending = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await pending).id).toBe(1);
  });

  it("accepts an HTTP-date Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const retryAt = new Date(Date.now() + 2000).toUTCString();
    const fetchMock = stubFetch(
      errorResponse(429, { "Retry-After": retryAt }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );

    const pending = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await pending).id).toBe(1);
  });

  it("treats a negative Retry-After as immediate and falls back for an empty one", async () => {
    vi.useFakeTimers();

    const immediate = stubFetch(
      errorResponse(429, { "Retry-After": "-5" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );
    const first = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(immediate).toHaveBeenCalledTimes(2);
    expect((await first).id).toBe(1);

    clearAnilistCache();

    const empty = stubFetch(
      errorResponse(429, { "Retry-After": "" }),
      dataResponse({ Page: { media: [{ ...media }] } }),
    );
    const second = loadAnime(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(empty).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(empty).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(empty).toHaveBeenCalledTimes(2);
    expect((await second).id).toBe(1);
  });
});

describe("AniList cancellation", () => {
  it("shares one in-flight request between concurrent searches and isolates aborts", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          resolvers.push(resolve);
          init.signal?.addEventListener("abort", () => reject(abortError()), { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = new AbortController();
    const second = new AbortController();
    const firstSearch = searchAnime("Cowboy", first.signal);
    const secondSearch = searchAnime("cowboy", second.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // One caller's abort must not fail the concurrent search it shares a request with.
    first.abort();
    await expect(firstSearch).rejects.toThrow(/cancelled/);

    resolvers[0]?.(dataResponse({ Page: { media: [media] } }));
    await expect(secondSearch).resolves.toHaveLength(1);
  });

  it("serves an abortable search from a warm cache entry", async () => {
    const fetchMock = stubFetch(dataResponse({ Page: { media: [media] } }));
    await searchAnime("Cowboy");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const fetchMockAfter = stubFetch(dataResponse({ Page: { media: [media] } }));
    await searchAnime("Cowboy", new AbortController().signal);
    expect(fetchMockAfter).not.toHaveBeenCalled();
  });

  it("rejects without requesting when the signal is already aborted", async () => {
    const fetchMock = signalAwareFetch(() => dataResponse({ Page: { media: [media] } }));
    const controller = new AbortController();
    controller.abort();

    await expect(searchAnime("Cowboy", controller.signal)).rejects.toThrow(/cancelled/);
    // An already-aborted signal is terminal before any request is made.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops the shared request once the last caller aborts", async () => {
    vi.useFakeTimers();
    const fetchMock = signalAwareFetch(() => errorResponse(503));

    const controller = new AbortController();
    const pending = searchAnime("Cowboy", controller.signal).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    controller.abort();
    const outcome = await pending;
    expect(isAbortError(outcome)).toBe(true);

    // No further retries may be scheduled once the last caller has gone.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats case and whitespace variants as one cache entry", async () => {
    const fetchMock = stubFetch(dataResponse({ Page: { media: [media] } }));
    await searchAnime("Cowboy  Bebop");
    await searchAnime("  cowboy bebop ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recognises abort-shaped errors without depending on DOMException", () => {
    expect(isAbortError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true);
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("Boom"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });

  it("bounds a request that never responds with the internal deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();

    const pending = loadAnime(1).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const error = await pending;
    expect(error).toBeInstanceOf(AnilistError);
    expect((error as AnilistError).message).not.toMatch(/cancelled/i);
  });

  it("propagates an abort through the connections, batch and discovery entry points", async () => {
    const entryPoints: Array<[string, (signal: AbortSignal) => Promise<unknown>]> = [
      ["connections", (signal) => getAnimeConnections(1, signal)],
      ["batch", (signal) => getAnimeBatch([1], signal)],
      [
        "discovery",
        (signal) =>
          getDiscoveryCandidates(
            { genres: ["Action"], formats: [], excludeIds: [1], page: 1, perPage: 50 },
            signal,
          ),
      ],
    ];

    for (const [name, call] of entryPoints) {
      clearAnilistCache();
      const fetchMock = hangingFetch();
      const controller = new AbortController();
      const pending = call(controller.signal).catch((error: unknown) => error);
      await vi.waitFor(() => expect(fetchMock, name).toHaveBeenCalledTimes(1));

      controller.abort();

      expect(isAbortError(await pending), name).toBe(true);
      expect(fetchMock, name).toHaveBeenCalledTimes(1);
    }
  });
});

describe("AniList cache bounds", () => {
  function searchResponse(): unknown {
    return dataResponse({ Page: { media: [media] } });
  }

  it("evicts the least recently used entry once the cap is reached", async () => {
    const fetchMock = vi.fn(async () => searchResponse());
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < CACHE_MAX_ENTRIES; index += 1) {
      await searchAnime(`term ${index}`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES);

    // Refresh the oldest entry, then add one more: the LRU victim is the second.
    await searchAnime("term 0");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES);

    await searchAnime("term overflow");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 1);

    await searchAnime("term 0");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 1);

    await searchAnime("term 1");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 2);
  });

  it("refetches a cached search once its time to live has elapsed", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => searchResponse());
    vi.stubGlobal("fetch", fetchMock);

    await searchAnime("bebop");
    await searchAnime("bebop");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CACHE_TTL_MS - 1);
    await searchAnime("bebop");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await searchAnime("bebop");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a superseded entry delete the replacement that reused its key", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          resolvers.push(resolve);
          init.signal?.addEventListener("abort", () => reject(abortError()), { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = searchAnime("bebop").catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    clearAnilistCache();
    const second = searchAnime("bebop");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The superseded entry settles only after the replacement has taken its key.
    expect(isAbortError(await first)).toBe(true);

    resolvers[1]?.(searchResponse());
    await expect(second).resolves.toHaveLength(1);

    await searchAnime("bebop");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight work when the cache is cleared", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    const pending = searchAnime("bebop").catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearAnilistCache();
    expect(isAbortError(await pending)).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("AniList rate limiting", () => {
  it("stops searching once the budget is nearly spent", async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "2" } },
      ),
    );

    await searchAnime("bebop");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(searchAnime("trigun")).rejects.toThrow(/unavailable/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps searching while the budget is healthy", async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "12" } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("releases the gate once the reset time passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const resetAt = Math.floor((Date.now() + 30_000) / 1000);
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "2", "X-RateLimit-Reset": String(resetAt) } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_999);
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from a low budget even without a reset header", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "2" } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_WINDOW_MS);
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clamps a far-future reset so the gate cannot lock indefinitely", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const resetAt = Math.floor(Date.now() / 1000) + 86_400;
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "1", "X-RateLimit-Reset": String(resetAt) } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_WINDOW_MS - 1);
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);

    await vi.advanceTimersByTimeAsync(1);
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores an empty or unparseable remaining header", async () => {
    const empty = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "" } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(empty).toHaveBeenCalledTimes(2);

    clearAnilistCache();

    const unparseable = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "soon" } },
      ),
      dataResponse({ Page: { media: [media] } }),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).resolves.toHaveLength(1);
    expect(unparseable).toHaveBeenCalledTimes(2);
  });

  it("clamps a negative remaining header rather than treating it as healthy", async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "-2" } },
      ),
    );

    await searchAnime("bebop");
    await expect(searchAnime("trigun")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("suppresses connections, batch and discovery while the budget is low", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const resetAt = Math.floor((Date.now() + 30_000) / 1000);
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "2", "X-RateLimit-Reset": String(resetAt) } },
      ),
    );

    await searchAnime("bebop");
    await expect(getAnimeConnections(2)).rejects.toBeInstanceOf(RateLimitError);
    await expect(getAnimeBatch([2])).rejects.toBeInstanceOf(RateLimitError);
    await expect(
      getDiscoveryCandidates({
        genres: ["Action"],
        formats: [],
        excludeIds: [1],
        page: 1,
        perPage: 50,
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a warm cached search while the budget is low", async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        { data: { Page: { media: [media] } } },
        { headers: { "X-RateLimit-Remaining": "1" } },
      ),
    );

    await searchAnime("bebop");
    await expect(searchAnime("bebop")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
