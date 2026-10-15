import type { Recommendation, RecommendationFilters } from "./anime";

export type UiState =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | {
      kind: "recommendation";
      results: Recommendation[];
      index: number;
      filters: RecommendationFilters;
    }
  | { kind: "no-match" }
  | { kind: "unavailable"; field: number }
  | { kind: "error" };
