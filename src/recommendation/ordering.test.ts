import { describe, expect, it } from "vitest";
import { compareText } from "./ordering";

describe("compareText", () => {
  it("orders strings by code unit rather than by locale collation", () => {
    expect(["Zebra", "apple"].sort(compareText)).toEqual(["Zebra", "apple"]);
    expect(["éclair", "Zebra"].sort(compareText)).toEqual(["Zebra", "éclair"]);
  });

  it("reports identical strings as equal", () => {
    expect(compareText("Anime 1", "Anime 1")).toBe(0);
  });

  it("produces the same order regardless of the input order", () => {
    const titles = ["Drama", "action", "Comedy", "Zebra", "apple"];
    const forward = [...titles].sort(compareText);
    const backward = [...titles].reverse().sort(compareText);

    expect(forward).toEqual(["Comedy", "Drama", "Zebra", "action", "apple"]);
    expect(backward).toEqual(forward);
  });
});
