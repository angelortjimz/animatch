export const ELIGIBLE_RELATION_WEIGHTS = {
  SIDE_STORY: 0.8,
  SPIN_OFF: 0.7,
  ALTERNATIVE: 0.6,
  SAME_UNIVERSE: 0.5,
  OTHER: 0.4,
} as const satisfies Readonly<Record<string, number>>;

export type EligibleRelationType = keyof typeof ELIGIBLE_RELATION_WEIGHTS;

export function relationWeight(relationType: string): number | undefined {
  if (!Object.hasOwn(ELIGIBLE_RELATION_WEIGHTS, relationType)) return undefined;
  return ELIGIBLE_RELATION_WEIGHTS[relationType as EligibleRelationType];
}

export const COMMUNITY_RELATION_TYPE = "COMMUNITY";
export const COMMUNITY_WEIGHT = 0.5;

export const PREREQUISITE_RELATION_TYPES = ["PREQUEL", "PARENT"] as const;
export const PREREQUISITE_MEDIA_FORMATS = ["TV", "TV_SHORT"] as const;
export const CONTINUATION_RELATION_TYPES = ["SEQUEL", "PARENT"] as const;
export function includesRelationType(types: readonly string[], relationType: string): boolean {
  return types.includes(relationType);
}

export const SCORING_WEIGHTS = {
  relation: 0.4,
  metadata: 0.6,
  genre: 0.45,
  theme: 0.25,
  type: 0.1,
  studio: 0.1,
  era: 0.1,
} as const satisfies Readonly<Record<string, number>>;

export const ERA_SIMILARITY_YEARS = 10;

export const CANDIDATE_LIMIT = 24;

export const FILTERED_POOL_SIZE = 60;

export const DISCOVERY_RELATION_TYPE = "DISCOVERY";

export const DISCOVERY_RELATION_WEIGHT = 0.3;

export const DISCOVERY_GENRE_LIMIT = 3;

export const DISCOVERY_PER_PAGE = 50;

export const DISCOVERY_MAX_PAGES = 2;

export const EPISODE_SLIDER_MIN = 1;

export const EPISODE_SLIDER_MAX = 200;

export const EPISODE_SLIDER_DEFAULT = 24;

export const MAX_REASONS = 2;

export const REQUIRED_SELECTIONS = 3;

export const MIN_SHARED_SELECTIONS = 2;
