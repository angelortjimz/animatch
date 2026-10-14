import { describe, expect, it } from "vitest";
import { anime, filters } from "./fixtures";
import {
  clampMaxEpisodes,
  episodeLabel,
  filterLabel,
  formatLabel,
  isUnfiltered,
  matchesEpisodeLimit,
  matchesFormat,
  matchesRawFormat,
  rawAnimeFormat,
  sharedGenres,
} from "./filters";
import { EPISODE_SLIDER_MAX, EPISODE_SLIDER_MIN } from "./config";

describe("rawAnimeFormat", () => {
  it("maps every display label back to its raw format", () => {
    expect(rawAnimeFormat("TV")).toBe("TV");
    expect(rawAnimeFormat("TV Short")).toBe("TV_SHORT");
    expect(rawAnimeFormat("Movie")).toBe("MOVIE");
  });

  it("returns null for a label it does not own", () => {
    expect(rawAnimeFormat("Music Video")).toBeNull();
    expect(rawAnimeFormat(null)).toBeNull();
  });
});

describe("matchesFormat", () => {
  const movie = anime(10, { type: "Movie" });
  const tv = anime(11, { type: "TV" });

  it("allows everything when no format is requested", () => {
    expect(matchesFormat(movie, filters())).toBe(true);
    expect(matchesFormat(tv, filters())).toBe(true);
  });

  it("keeps only the requested formats", () => {
    const only = filters({ formats: ["MOVIE"] });
    expect(matchesFormat(movie, only)).toBe(true);
    expect(matchesFormat(tv, only)).toBe(false);
  });

  it("keeps a title matching any one of several requested formats", () => {
    const either = filters({ formats: ["OVA", "MOVIE"] });
    expect(matchesFormat(movie, either)).toBe(true);
    expect(matchesFormat(anime(12, { type: "OVA" }), either)).toBe(true);
    expect(matchesFormat(tv, either)).toBe(false);
  });

  it("cannot match a title whose format AniList never reported", () => {
    expect(matchesFormat(anime(13, { type: null }), filters({ formats: ["MOVIE"] }))).toBe(false);
  });
});

describe("matchesRawFormat", () => {
  it("agrees with the hydrated check for every supported format", () => {
    const requested = filters({ formats: ["MOVIE"] });
    expect(matchesRawFormat("MOVIE", requested)).toBe(true);
    expect(matchesRawFormat("TV", requested)).toBe(false);
    expect(matchesRawFormat("MUSIC_VIDEO", requested)).toBe(false);
  });

  it("allows every format when none is requested", () => {
    expect(matchesRawFormat("MUSIC_VIDEO", filters())).toBe(true);
  });
});

describe("matchesEpisodeLimit", () => {
  it("allows everything when there is no ceiling", () => {
    expect(matchesEpisodeLimit(500, filters())).toBe(true);
    expect(matchesEpisodeLimit(null, filters())).toBe(true);
  });

  it("keeps a title exactly on the ceiling", () => {
    expect(matchesEpisodeLimit(24, filters({ maxEpisodes: 24 }))).toBe(true);
  });

  it("drops a single episode over the ceiling", () => {
    expect(matchesEpisodeLimit(25, filters({ maxEpisodes: 24 }))).toBe(false);
  });

  it("keeps a single-episode title under any legal ceiling", () => {
    expect(matchesEpisodeLimit(1, filters({ maxEpisodes: 1 }))).toBe(true);
  });

  it("never lets a title below the one-episode floor through", () => {
    expect(matchesEpisodeLimit(0, filters({ maxEpisodes: 24 }))).toBe(false);
  });

  it("keeps an unknown count, because a ceiling is a preference not a fact", () => {
    expect(matchesEpisodeLimit(null, filters({ maxEpisodes: 1 }))).toBe(true);
  });
});

describe("clampMaxEpisodes", () => {
  it("holds the floor at one episode", () => {
    expect(clampMaxEpisodes(0)).toBe(EPISODE_SLIDER_MIN);
    expect(clampMaxEpisodes(-40)).toBe(EPISODE_SLIDER_MIN);
  });

  it("holds the ceiling at the widest the slider offers", () => {
    expect(clampMaxEpisodes(EPISODE_SLIDER_MAX + 500)).toBe(EPISODE_SLIDER_MAX);
  });

  it("rounds and passes through a legal value", () => {
    expect(clampMaxEpisodes(24)).toBe(24);
    expect(clampMaxEpisodes(23.6)).toBe(24);
  });

  it("refuses a value that is not a number at all", () => {
    expect(clampMaxEpisodes(Number.NaN)).toBe(EPISODE_SLIDER_MIN);
  });
});

describe("isUnfiltered", () => {
  it("recognises an untouched filter set", () => {
    expect(isUnfiltered(filters())).toBe(true);
  });

  it("treats either dimension as a narrowing", () => {
    expect(isUnfiltered(filters({ formats: ["MOVIE"] }))).toBe(false);
    expect(isUnfiltered(filters({ maxEpisodes: 24 }))).toBe(false);
  });
});

describe("sharedGenres", () => {
  it("ranks the most widely shared genre first, then sorts ties by name", () => {
    const selected = [
      anime(1, { genres: ["Action", "Drama"] }),
      anime(2, { genres: ["Action", "Comedy"] }),
      anime(3, { genres: ["Action", "Sports"] }),
    ];
    expect(sharedGenres(selected)).toEqual(["Action", "Comedy", "Drama"]);
  });

  it("counts a genre once per selection however often it repeats", () => {
    const selected = [anime(1, { genres: ["Action", "Action"] }), anime(2, { genres: ["Action"] })];
    expect(sharedGenres(selected)).toEqual(["Action"]);
  });

  it("skips blank genre names and ignores duplicates across picks", () => {
    const selected = [anime(1, { genres: ["  "] }), anime(2, { genres: ["Drama", "Drama"] })];
    expect(sharedGenres(selected)).toEqual(["Drama"]);
  });

  it("returns nothing when the picks share no genres", () => {
    expect(sharedGenres([anime(1, { genres: [] }), anime(2, { genres: [] })])).toEqual([]);
  });
});

describe("filter labels", () => {
  it("stays silent when nothing is narrowed", () => {
    expect(filterLabel(filters())).toBeNull();
  });

  it("names the single requested format", () => {
    expect(filterLabel(filters({ formats: ["MOVIE"] }))).toBe("Movies, any length");
  });

  it("joins several formats readably", () => {
    expect(filterLabel(filters({ formats: ["TV", "MOVIE", "OVA"] }))).toBe(
      "TV, Movies and OVAs, any length",
    );
  });

  it("reads the ceiling in plain words", () => {
    expect(filterLabel(filters({ maxEpisodes: 24 }))).toBe("Any format, up to 24 episodes");
    expect(filterLabel(filters({ maxEpisodes: 1 }))).toBe("Any format, up to 1 episode");
  });

  it("describes each dimension on its own", () => {
    expect(formatLabel(filters())).toBe("Any format");
    expect(episodeLabel(filters())).toBe("Any length");
  });
});
