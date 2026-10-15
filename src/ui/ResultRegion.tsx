import { useEffect, useRef, type JSX, type RefObject } from "react";
import type { Recommendation, RecommendationFilters } from "@/models/anime";
import type { UiState } from "@/models/ui";
import { filterLabel } from "@/recommendation/filters";
import { anilistUrl, metaLine, studioLine } from "./format";

interface ResultRegionProps {
  ui: UiState;
  isStale: boolean;
  onReroll?: () => void;
  onBack?: () => void;
  onUndo?: () => void;
  onEditPicks?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

function announcement(ui: UiState, isStale: boolean): string {
  switch (ui.kind) {
    case "idle":
      return "";
    case "loading":
      return ui.slow
        ? "Still finding your next anime. This is taking longer than usual."
        : "Finding your next anime.";
    case "recommendation": {
      const current = ui.results[ui.index];
      if (!current) return "";
      if (isStale) {
        return `Your picks or filters changed. This is the previous recommendation: ${current.anime.title}.`;
      }
      const position = ui.index + 1;
      const total = ui.results.length;
      return total > 1
        ? `Recommendation ${position} of ${total}: ${current.anime.title}.`
        : `Recommendation: ${current.anime.title}.`;
    }
    case "no-match":
      return "No discovery match for this combination.";
    case "unavailable":
      return `Anime ${ui.field} is no longer available.`;
    case "error":
      return "We could not reach the anime database.";
  }
}

function GenreChips({ genres }: { genres: string[] }): JSX.Element | null {
  if (genres.length === 0) return null;
  return (
    <ul className="chip-list" aria-label="Genres">
      {genres.map((genre) => (
        <li key={genre} className="chip">
          {genre}
        </li>
      ))}
    </ul>
  );
}

function RecommendationCard({
  recommendation,
  filters,
  hasAnother,
  hasPrevious,
  position,
  total,
  isStale,
  onReroll,
  onBack,
  onUndo,
  onEditPicks,
  headingRef,
}: {
  recommendation: Recommendation;
  filters: RecommendationFilters;
  hasAnother: boolean;
  hasPrevious: boolean;
  position: number;
  total: number;
  isStale: boolean;
  onReroll?: () => void;
  onBack?: () => void;
  onUndo?: () => void;
  onEditPicks?: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}): JSX.Element {
  const anime = recommendation.anime;
  const studios = studioLine(anime.mainStudios);
  const activeFilters = filterLabel(filters);
  return (
    <section
      className={isStale ? "result-card is-stale" : "result-card"}
      aria-labelledby="recommendation-title"
    >
      <div className="result-head">
        <p className="eyebrow">{isStale ? "Previous recommendation" : "Your recommendation"}</p>
        {total > 1 && !isStale ? (
          <p className="queue-position">
            {position} of {total}
          </p>
        ) : null}
      </div>
      {activeFilters ? (
        <p className="active-filters">
          {isStale ? "Was matched to your filters" : "Matched to your filters"}: {activeFilters}
        </p>
      ) : null}
      {isStale ? (
        <p className="stale-note">
          Your picks or filters changed since this one was scored, so it no longer reflects them.
        </p>
      ) : null}
      <div className="result-layout">
        {anime.imageUrl ? (
          <img
            className="cover"
            src={encodeURI(anime.imageUrl)}
            alt={`Cover art for ${anime.title}`}
          />
        ) : (
          <div className="cover cover--placeholder" aria-hidden="true"></div>
        )}
        <div>
          <h2 className="result-title" id="recommendation-title" ref={headingRef} tabIndex={-1}>
            <a
              className="title-link"
              href={anilistUrl(anime.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {anime.title}
            </a>
          </h2>
          {anime.nativeTitle ? <p className="native-title">{anime.nativeTitle}</p> : null}
          <p className="meta">{metaLine(anime) || "Anime"}</p>
          {studios ? <p className="studio-credit">Studio: {studios}</p> : null}
          <GenreChips genres={anime.genres} />
          <h3 className="reason-heading">Why this one</h3>
          <ul className="reason-list">
            {recommendation.reasons.map((reason, reasonIndex) => (
              <li key={reasonIndex}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="based-on">
        Based on {recommendation.basedOn.map((item) => item.title).join(" / ")}
      </p>
      {isStale ? (
        <div className="result-actions">
          {onUndo ? (
            <button className="reroll-button" type="button" onClick={onUndo}>
              Undo my last change
            </button>
          ) : null}
          {onEditPicks ? (
            <button
              className="reroll-button reroll-button--quiet"
              type="button"
              onClick={onEditPicks}
            >
              Edit my picks
            </button>
          ) : null}
        </div>
      ) : (
        <div className="result-actions">
          {hasPrevious && onBack ? (
            <button className="reroll-button reroll-button--quiet" type="button" onClick={onBack}>
              Back to the previous one
            </button>
          ) : null}
          {onReroll ? (
            <button className="reroll-button" type="button" onClick={onReroll}>
              Seen it — show me another
            </button>
          ) : null}
          {!hasAnother ? (
            <p className="exhausted-note">
              That was the last match for this combination. Change one pick to explore again.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function ResultRegion({
  ui,
  isStale,
  onReroll,
  onBack,
  onUndo,
  onEditPicks,
  onCancel,
  onRetry,
}: ResultRegionProps): JSX.Element | null {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const current = ui.kind === "recommendation" ? ui.results[ui.index] : undefined;
  const focusKey = isStale ? null : (current?.anime.id ?? null);

  useEffect(() => {
    if (focusKey !== null) headingRef.current?.focus();
  }, [focusKey]);

  if (ui.kind === "idle") return null;

  const status = (
    <p className="visually-hidden" role="status">
      {announcement(ui, isStale)}
    </p>
  );

  if (
    ui.kind === "loading" ||
    ui.kind === "no-match" ||
    ui.kind === "unavailable" ||
    ui.kind === "error"
  ) {
    return (
      <>
        {status}
        <OutcomeCard ui={ui} onCancel={onCancel} onRetry={onRetry} />
      </>
    );
  }
  if (!current) return null;
  const hasAnother = ui.index + 1 < ui.results.length;
  return (
    <>
      {status}
      <RecommendationCard
        key={current.anime.id}
        recommendation={current}
        filters={ui.filters}
        hasAnother={hasAnother}
        hasPrevious={ui.index > 0}
        position={ui.index + 1}
        total={ui.results.length}
        isStale={isStale}
        onReroll={hasAnother ? onReroll : undefined}
        onBack={onBack}
        onUndo={onUndo}
        onEditPicks={onEditPicks}
        headingRef={headingRef}
      />
    </>
  );
}

function OutcomeCard({
  ui,
  onCancel,
  onRetry,
}: {
  ui: UiState;
  onCancel?: () => void;
  onRetry?: () => void;
}): JSX.Element {
  if (ui.kind === "loading") {
    return (
      <section className="message-card message-card--loading">
        <span className="spinner" aria-hidden="true"></span>
        <p className="message-body">Finding your next anime...</p>
        {ui.slow ? (
          <p className="message-body">
            This is taking longer than usual. Keep waiting, or cancel and try again.
          </p>
        ) : null}
        {onCancel ? (
          <button className="reroll-button reroll-button--quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </section>
    );
  }
  if (ui.kind === "no-match") {
    return (
      <section className="message-card">
        <h2 className="card-title">No discovery match yet</h2>
        <p className="message-body">
          Every candidate for these three picks was a direct sequel or spin-off of one you chose, or
          missing from the database. Try a different mix of anime.
        </p>
      </section>
    );
  }
  if (ui.kind === "unavailable") {
    return (
      <section className="message-card message-card--warn">
        <h2 className="card-title">One selection is no longer available</h2>
        <p className="message-body">
          Anime {ui.field} is no longer listed. Clear that field and try again.
        </p>
      </section>
    );
  }
  return (
    <section className="message-card message-card--error">
      <h2 className="card-title">We could not find a recommendation</h2>
      <p className="message-body">
        The anime database is temporarily unavailable. Please try again in a moment.
      </p>
      {onRetry ? (
        <button className="reroll-button" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
