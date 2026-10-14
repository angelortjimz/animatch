import type { Recommendation, RecommendationFilters } from "./anime";

export type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "recommendation";
      results: Recommendation[];
      index: number;
      filters: RecommendationFilters;
    }
  | { kind: "no-match" }
  | { kind: "unavailable" }
  | { kind: "error" };
