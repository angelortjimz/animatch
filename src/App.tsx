import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { getAnimeBatch } from "@/api/anilist";
import type { AnimeSearchResult, RecommendationFilters } from "@/models/anime";
import { NO_FILTERS } from "@/models/anime";
import type { UiState } from "@/models/ui";
import { recommend } from "@/recommendation/recommend";
import { FilterBar } from "@/ui/FilterBar";
import { SearchField } from "@/ui/SearchField";
import { ResultRegion } from "@/ui/ResultRegion";
import { SUBMIT_SLOW_MS, SUBMIT_TIMEOUT_MS } from "@/ui/config";

const FIELD_COUNT = 3;

function filterKey(filters: RecommendationFilters): string {
  return `${[...filters.formats].sort().join("+")}|${filters.maxEpisodes ?? ""}`;
}

interface RestorePoint {
  selections: (AnimeSearchResult | null)[];
  filters: RecommendationFilters;
}

export function App(): JSX.Element {
  const [selections, setSelections] = useState<(AnimeSearchResult | null)[]>(() =>
    Array<AnimeSearchResult | null>(FIELD_COUNT).fill(null),
  );
  const [filters, setFilters] = useState<RecommendationFilters>(NO_FILTERS);
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [scoredSelections, setScoredSelections] = useState<(AnimeSearchResult | null)[] | null>(
    null,
  );
  const [scoredFilters, setScoredFilters] = useState<RecommendationFilters | null>(null);
  const [restorePoint, setRestorePoint] = useState<RestorePoint | null>(null);
  const [restoreToken, setRestoreToken] = useState(0);

  const submitRef = useRef<HTMLButtonElement | null>(null);
  const firstFieldRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const slowTimerRef = useRef<number | undefined>(undefined);
  const deadlineRef = useRef<number | undefined>(undefined);
  const previousUiRef = useRef<UiState>({ kind: "idle" });

  const selected = selections.filter(
    (selection): selection is AnimeSearchResult => selection !== null,
  );
  const hasDuplicate = new Set(selected.map((item) => item.id)).size !== selected.length;
  const loading = ui.kind === "loading";
  const canSubmit = selected.length === FIELD_COUNT && !hasDuplicate && !loading;

  const hasResult = ui.kind === "recommendation";
  const isStale =
    hasResult &&
    ((scoredSelections !== null && scoredKey(scoredSelections) !== scoredKey(selections)) ||
      (scoredFilters !== null && filterKey(scoredFilters) !== filterKey(filters)));

  function scoredKey(items: (AnimeSearchResult | null)[]): string {
    return items.map((item) => (item ? String(item.id) : "-")).join(",");
  }

  function snapshot(): void {
    if (hasResult) setRestorePoint({ selections, filters });
  }

  function handleSelectionChange(index: number, selection: AnimeSearchResult | null): void {
    if (selections[index]?.id === selection?.id) return;
    snapshot();
    setSelections((previous) => {
      const next = [...previous];
      next[index] = selection;
      return next;
    });
  }

  function handleFilterChange(next: RecommendationFilters): void {
    if (filterKey(next) === filterKey(filters)) return;
    snapshot();
    setFilters(next);
  }

  function handleUndo(): void {
    if (!restorePoint) return;
    setSelections(restorePoint.selections);
    setFilters(restorePoint.filters);
    setRestoreToken((current) => current + 1);
  }

  function handleEditPicks(): void {
    const first = firstFieldRef.current?.querySelector<HTMLInputElement>("input");
    first?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading || selected.length !== FIELD_COUNT) return;
    await runSubmit();
  }

  async function runSubmit(): Promise<void> {
    if (loading) return;
    const runId = runRef.current + 1;
    runRef.current = runId;
    previousUiRef.current = ui;
    setUi({ kind: "loading", slow: false });
    slowTimerRef.current = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      setUi((current) => (current.kind === "loading" ? { ...current, slow: true } : current));
    }, SUBMIT_SLOW_MS);
    deadlineRef.current = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      runRef.current += 1;
      setUi({ kind: "error" });
    }, SUBMIT_TIMEOUT_MS);
    try {
      const detailed = await getAnimeBatch(selected.map((item) => item.id));
      if (runRef.current !== runId) return;
      if (detailed.length !== selected.length) {
        const missing = selections.findIndex(
          (item) => item !== null && !detailed.some((found) => found.id === item.id),
        );
        setUi({ kind: "unavailable", field: missing >= 0 ? missing + 1 : 1 });
        return;
      }
      const result = await recommend(detailed, filters);
      if (runRef.current !== runId) return;
      if (result.kind === "recommendation") {
        setScoredSelections([...selections]);
        setScoredFilters(filters);
        setRestorePoint(null);
        setUi({ kind: "recommendation", results: result.results, index: 0, filters });
      } else {
        setUi({ kind: "no-match" });
      }
    } catch {
      if (runRef.current !== runId) return;
      setUi({ kind: "error" });
    } finally {
      if (runRef.current === runId) {
        window.clearTimeout(slowTimerRef.current);
        window.clearTimeout(deadlineRef.current);
      }
    }
  }

  function handleCancel(): void {
    runRef.current += 1;
    window.clearTimeout(slowTimerRef.current);
    window.clearTimeout(deadlineRef.current);
    setUi(previousUiRef.current);
  }

  function handleReroll(): void {
    setUi((previous) =>
      previous.kind === "recommendation"
        ? { ...previous, index: Math.min(previous.index + 1, previous.results.length - 1) }
        : previous,
    );
  }

  function handleBack(): void {
    setUi((previous) =>
      previous.kind === "recommendation"
        ? { ...previous, index: Math.max(previous.index - 1, 0) }
        : previous,
    );
  }

  useEffect(() => {
    if (canSubmit) submitRef.current?.focus();
  }, [canSubmit]);

  useEffect(() => {
    return () => {
      window.clearTimeout(slowTimerRef.current);
      window.clearTimeout(deadlineRef.current);
    };
  }, []);

  const pickedIds = selections
    .filter((selection): selection is AnimeSearchResult => selection !== null)
    .map((selection) => selection.id);

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">Anime discovery engine</p>
        <h1 className="display-title">What should you watch next?</h1>
        <p className="lead">
          Pick three anime you enjoyed. We will find one adjacent discovery, not the next franchise
          installment.
        </p>
      </header>
      <form
        className="selector"
        aria-labelledby="selection-title"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="section-heading">
          <h2 className="section-title" id="selection-title">
            Your three
          </h2>
          <p className="section-note">
            {selected.length < FIELD_COUNT
              ? `Choose ${FIELD_COUNT - selected.length} more — pick an exact match from each search.`
              : "All three chosen. Press Enter to find your recommendation."}
          </p>
        </div>
        <div className="search-grid" ref={firstFieldRef}>
          {selections.map((_, index) => (
            <SearchField
              key={index}
              index={index + 1}
              disabled={loading}
              pickedIds={pickedIds}
              restoreToken={restoreToken}
              restoredSelection={restorePoint?.selections[index] ?? null}
              invalid={ui.kind === "unavailable" && ui.field === index + 1}
              onSelectionChange={(next) => handleSelectionChange(index, next)}
            />
          ))}
        </div>
        {hasDuplicate ? (
          <p className="field-error" role="alert">
            Please select three different anime.
          </p>
        ) : null}
        <FilterBar filters={filters} disabled={loading} onChange={handleFilterChange} />
        <button className="submit-button" type="submit" ref={submitRef} disabled={!canSubmit}>
          Find a recommendation
        </button>
      </form>
      <ResultRegion
        ui={ui}
        isStale={isStale}
        onReroll={handleReroll}
        onBack={handleBack}
        onUndo={isStale && restorePoint ? handleUndo : undefined}
        onEditPicks={isStale ? handleEditPicks : undefined}
        onCancel={loading ? handleCancel : undefined}
        onRetry={ui.kind === "error" && canSubmit ? () => void runSubmit() : undefined}
      />
      <footer className="credit">
        Anime data and cover art from{" "}
        <a
          className="anilist-link"
          href="https://anilist.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          AniList
        </a>
        . Recommendations are generated on your device and are not affiliated with AniList.
      </footer>
    </main>
  );
}
