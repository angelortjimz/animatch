import type { Anime, RelatedAnime } from "@/models/anime";
import {
  CONTINUATION_RELATION_TYPES,
  PREREQUISITE_MEDIA_FORMATS,
  PREREQUISITE_RELATION_TYPES,
  includesRelationType,
} from "./config";

function requiredPredecessors(candidate: Anime): number[] {
  return candidate.relations
    .filter(
      (relation) =>
        relation.mediaType === "anime" &&
        includesRelationType(PREREQUISITE_RELATION_TYPES, relation.relationType) &&
        includesRelationType(PREREQUISITE_MEDIA_FORMATS, relation.format),
    )
    .map((relation) => relation.id);
}

function continuesASelection(candidate: Anime, selectedRelations: RelatedAnime[][]): boolean {
  return selectedRelations.some((relations) =>
    relations.some(
      (relation) =>
        relation.id === candidate.id &&
        relation.mediaType === "anime" &&
        includesRelationType(CONTINUATION_RELATION_TYPES, relation.relationType),
    ),
  );
}

export function passesPrerequisiteGate(
  candidate: Anime,
  selected: Anime[],
  selectedRelations: RelatedAnime[][],
): boolean {
  if (continuesASelection(candidate, selectedRelations)) return true;
  const watched = new Set(selected.map((anime) => anime.id));
  return requiredPredecessors(candidate).every((id) => watched.has(id));
}
