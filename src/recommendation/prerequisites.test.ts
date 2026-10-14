import { describe, expect, it } from "vitest";
import { anime, animeRelation, relation, selectedThree } from "./fixtures";
import { passesPrerequisiteGate } from "./prerequisites";

describe("passesPrerequisiteGate", () => {
  const selected = selectedThree();
  const noSelectionRelations = [[], [], []];

  it("blocks a sequel whose prequel is not one of the picks", () => {
    const shippuden = anime(1735, { relations: [animeRelation(20)] });
    expect(passesPrerequisiteGate(shippuden, selected, noSelectionRelations)).toBe(false);
  });

  it("keeps the sequel once its prequel is one of the picks", () => {
    const shippuden = anime(1735, { relations: [animeRelation(20)] });
    expect(
      passesPrerequisiteGate(shippuden, [anime(20), anime(2), anime(3)], noSelectionRelations),
    ).toBe(true);
  });

  it("blocks a film sequel of a series, as Cowboy Bebop's movie is of the show", () => {
    const movie = anime(5, { relations: [animeRelation(1, { relationType: "PARENT" })] });
    const otherPicks = [anime(2), anime(3), anime(4)];
    expect(passesPrerequisiteGate(movie, otherPicks, noSelectionRelations)).toBe(false);
    expect(
      passesPrerequisiteGate(movie, [anime(1), anime(2), anime(3)], noSelectionRelations),
    ).toBe(true);
  });

  it("ignores OVA, ONA and movie predecessors, which are extras rather than prerequisites", () => {
    const onePiece = anime(21, { relations: [animeRelation(167404, { format: "ONA" })] });
    const attackOnTitan = anime(16498, { relations: [animeRelation(20811, { format: "OVA" })] });
    const jujutsuKaisen = anime(113415, {
      relations: [animeRelation(131573, { format: "MOVIE" })],
    });
    for (const candidate of [onePiece, attackOnTitan, jujutsuKaisen]) {
      expect(passesPrerequisiteGate(candidate, selected, noSelectionRelations)).toBe(true);
    }
  });

  it("ignores manga predecessors, which cannot have been watched", () => {
    const candidate = anime(10, { relations: [animeRelation(30011, { mediaType: "manga" })] });
    expect(passesPrerequisiteGate(candidate, selected, noSelectionRelations)).toBe(true);
  });

  it("ignores relations that are not required viewing", () => {
    const candidate = anime(10, {
      relations: [
        animeRelation(20, { relationType: "ALTERNATIVE" }),
        animeRelation(21, { relationType: "SIDE_STORY" }),
      ],
    });
    expect(passesPrerequisiteGate(candidate, selected, noSelectionRelations)).toBe(true);
  });

  it("blocks when only one of several predecessors is unmet", () => {
    const candidate = anime(1735, {
      relations: [animeRelation(1), animeRelation(2), animeRelation(20)],
    });
    expect(passesPrerequisiteGate(candidate, selected, noSelectionRelations)).toBe(false);
  });

  it("keeps a candidate AniList does not order against anything", () => {
    expect(passesPrerequisiteGate(anime(10), selected, noSelectionRelations)).toBe(true);
  });

  it("keeps a candidate a pick already declares as its continuation", () => {
    const shippuden = anime(1735);
    const relations = [[relation(20, 1735, "SEQUEL")], [], []];
    expect(passesPrerequisiteGate(shippuden, [anime(20), anime(2), anime(3)], relations)).toBe(
      true,
    );
  });

  it("does not read a manga edge as a continuation", () => {
    const candidate = anime(10, { relations: [animeRelation(20)] });
    const relations = [[relation(1, 10, "SEQUEL", "manga")], [], []];
    expect(passesPrerequisiteGate(candidate, selected, relations)).toBe(false);
  });

  it("blocks a candidate two installments past the user's pick", () => {
    const boruto = anime(97938, { relations: [animeRelation(1735)] });
    const relations = [[relation(20, 1735, "SEQUEL")], [], []];
    expect(passesPrerequisiteGate(boruto, [anime(20), anime(2), anime(3)], relations)).toBe(false);
  });
});
