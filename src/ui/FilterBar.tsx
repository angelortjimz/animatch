import { useId, useState, type JSX } from "react";
import { ANIME_FORMATS, ANIME_FORMAT_LABELS, NO_FILTERS, type AnimeFormat } from "@/models/anime";
import {
  EPISODE_SLIDER_DEFAULT,
  EPISODE_SLIDER_MAX,
  EPISODE_SLIDER_MIN,
} from "@/recommendation/config";
import { clampMaxEpisodes, episodeLabel, filterLabel, formatLabel } from "@/recommendation/filters";

interface FilterBarProps {
  filters: { formats: AnimeFormat[]; maxEpisodes: number | null };
  disabled: boolean;
  onChange: (filters: { formats: AnimeFormat[]; maxEpisodes: number | null }) => void;
}

function toggleFormat(formats: AnimeFormat[], format: AnimeFormat): AnimeFormat[] {
  return formats.includes(format)
    ? formats.filter((current) => current !== format)
    : ANIME_FORMATS.filter((current) => current === format || formats.includes(current));
}

function ceilingFill(ceiling: number): number {
  const span = EPISODE_SLIDER_MAX - EPISODE_SLIDER_MIN;
  if (span <= 0) return 0;
  return ((ceiling - EPISODE_SLIDER_MIN) / span) * 100;
}

export function FilterBar({ filters, disabled, onChange }: FilterBarProps): JSX.Element {
  const formatGroupId = useId();
  const limitId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const unlimited = filters.maxEpisodes === null;
  const [ceiling, setCeiling] = useState(filters.maxEpisodes ?? EPISODE_SLIDER_DEFAULT);
  const [knownCeiling, setKnownCeiling] = useState(filters.maxEpisodes);
  if (filters.maxEpisodes !== knownCeiling) {
    setKnownCeiling(filters.maxEpisodes);
    if (filters.maxEpisodes !== null) setCeiling(filters.maxEpisodes);
  }

  function changeCeiling(value: number): void {
    const next = clampMaxEpisodes(value);
    setCeiling(next);
    if (filters.maxEpisodes !== null) onChange({ ...filters, maxEpisodes: next });
  }

  const activeSummary = filterLabel(filters);

  return (
    <section className="filters" aria-labelledby={`${formatGroupId}-heading`}>
      <div className="section-heading section-heading--filters">
        <h2 id={`${formatGroupId}-heading`}>
          <button
            className="filter-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            Narrow it down
            <svg
              className="filter-toggle-chevron"
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </h2>
        <div className="filter-status">
          {activeSummary ? (
            <>
              <p className="filter-active" data-testid="collapsed-filter-summary">
                {activeSummary}
              </p>
              <button
                className="filter-clear"
                type="button"
                disabled={disabled}
                onClick={() => onChange(NO_FILTERS)}
              >
                Clear filters
              </button>
            </>
          ) : (
            <p className="section-note">
              Optional. We still aim for 24 recommendations that already match.
            </p>
          )}
        </div>
      </div>
      <div className="filter-panel" id={panelId} hidden={!open}>
        <div className="filter-row">
          <p className="filter-label" id={`${formatGroupId}-label`}>
            Format
          </p>
          <div className="filter-controls">
            <div
              className="chip-list chip-list--filters"
              role="group"
              aria-labelledby={`${formatGroupId}-label`}
            >
              {ANIME_FORMATS.map((format) => {
                const active = filters.formats.includes(format);
                return (
                  <button
                    key={format}
                    className={active ? "chip chip--toggle is-active" : "chip chip--toggle"}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() =>
                      onChange({ ...filters, formats: toggleFormat(filters.formats, format) })
                    }
                  >
                    {ANIME_FORMAT_LABELS[format]}
                  </button>
                );
              })}
            </div>
            <p className="filter-summary" data-testid="format-summary">
              {formatLabel(filters)}
            </p>
          </div>
        </div>

        <div className="filter-row">
          <label className="filter-label" htmlFor={limitId}>
            Episodes
          </label>
          <div className="filter-controls">
            <div className="episode-head">
              <output className="episode-readout" htmlFor={limitId} data-testid="episode-summary">
                {episodeLabel(filters)}
              </output>
              <label className="unlimited-toggle">
                <input
                  type="checkbox"
                  checked={unlimited}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      maxEpisodes: event.target.checked ? null : clampMaxEpisodes(ceiling),
                    })
                  }
                />
                Any length
              </label>
            </div>
            <div className="episode-track" data-disabled={unlimited || disabled}>
              <span className="episode-rail" aria-hidden="true">
                <span
                  className="episode-fill"
                  style={{ transform: `scaleX(${unlimited ? 0 : ceilingFill(ceiling) / 100})` }}
                ></span>
              </span>
              <input
                className="episode-slider"
                id={limitId}
                type="range"
                min={EPISODE_SLIDER_MIN}
                max={EPISODE_SLIDER_MAX}
                step={1}
                value={ceiling}
                disabled={disabled || unlimited}
                aria-describedby={`${limitId}-help`}
                onChange={(event) => changeCeiling(Number(event.target.value))}
              />
            </div>
            <p className="episode-scale" aria-hidden="true">
              <span>{EPISODE_SLIDER_MIN}</span>
              <span>{EPISODE_SLIDER_MAX}+</span>
            </p>
            <p className="filter-help" id={`${limitId}-help`}>
              Between {EPISODE_SLIDER_MIN} and {ceiling} episodes. Ongoing series with no published
              count are always kept.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
