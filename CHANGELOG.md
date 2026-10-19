# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Dark mode. The page now honours the operating system's colour-scheme
  preference through `light-dark()` tokens, and a Theme control in the masthead
  — System, Light, or Dark — overrides it for the session. The override is
  deliberately in memory only, so the choice resets to the system default on
  reload and the app stays free of `localStorage` and cookies. The browser
  chrome's `theme-color` follows whichever theme is resolved

- An explicit `<meta name="referrer">` (`strict-origin-when-cross-origin`) on
  the page, so the referrer sent to AniList and on any outbound link is the
  same in every browser rather than left to each browser's default

- A native Git pre-push hook (`.githooks/pre-push`) that runs `pnpm check`, so
  lint, format, tests and build are verified before a push rather than only when
  someone remembers. It needs no new dependency: a `prepare` script sets
  `core.hooksPath` to `.githooks` on `pnpm install`, so it is wired up
  automatically for each contributor. CI remains the enforcement point — the
  hook is fast, local feedback and is bypassable with `--no-verify`

- An error boundary around the app. A render crash previously produced a blank
  page with no diagnostic surface at all, because `console.log` is deliberately
  absent from `src/`. The boundary catches the failure and shows the existing
  plain-language error card with a Reload action, so the raw error never reaches the user

- Search now reads AniList's `X-RateLimit-Remaining` response header and refuses
  to auto-fire once the budget falls to three requests or fewer, surfacing the
  existing "Search is unavailable. Try again." state instead of spending the
  last requests into a hard 429

- A `public/favicon.svg` icon and its `<link rel="icon">`, so the browser tab
  and bookmark show a mark instead of requesting a missing `/favicon.ico` on
  every load. It uses the existing palette — the Press Red accent on the paper
  surface
- User-facing `index.html` metadata: a description written for a person rather
  than a developer, a `theme-color`, and Open Graph and Twitter card tags.
  `canonical`, `og:url` and the social preview image are deliberately omitted
  until the domain and a 1200x630 asset exist
- A `preview` script so the production build can be served and checked locally
  before a push
- An MIT `LICENSE`, required before the repository is distributed publicly
- A Deployment section in `README.md` recording the static client-only
  architecture, the hPanel build settings, and the first-deploy risks around
  `engines`, `packageManager` and `allowBuilds`

- A GitHub Actions CI workflow (`.github/workflows/ci.yml`) running
  `pnpm install --frozen-lockfile` and `pnpm check` on every pull request and
  push to `main`. It enables corepack rather than pinning a pnpm version, so
  the `packageManager` field stays the single source of truth. This is a
  quality gate, not the deploy mechanism: Hostinger builds with the `build`
  script alone, which type-checks but runs no lint, format or tests, so
  without CI a failing test could merge and deploy

- The AniList community score now sits with the other stats on a result card, as
  "AniList score 8.4 / 10" under the studio credit. The score was never
  requested before: `averageScore` joins `BATCH_QUERY`, `Anime` carries a
  validated `score: number | null`, and the 0-100 average is presented on the
  ten point scale people expect. A title AniList has not rated shows no figure
  at all rather than a zero, and the internal ranking score stays hidden
- Tests for it: the score surviving normalization, an unrated title reporting
  none, the ten point conversion, its placement on the card, and its absence
  when there is nothing to report

- `DESIGN.md`, the visual system extracted from the existing implementation:
  the "Broadsheet Desk" north star, the Press Red / Press Blue / Slate palette on
  uncoated stock, the two-voice Georgia-and-sans type split, the flat-by-default
  elevation doctrine, and per-component behaviour. It records the design
  decisions that were already in `src/styles.css` rather than introducing new
  ones. `.impeccable/design.json` accompanies it with tonal ramps, motion
  tokens, and drop-in component snippets

- `PRODUCT.md`, a durable record of product truth for future work: who the two
  audiences are, the discovery-not-continuation and deterministic-explainability
  claims, confirmed capabilities and constraints, the binding voice and
  attribution commitments, and the WCAG 2.2 AA keyboard-complete bar. It records
  deployment, score visibility, and MyAnimeList integration as explicitly
  undecided rather than answering them

- A filter panel offering multi-select format chips (TV, TV Short, Movie,
  OVA, ONA, Special; nothing pressed means any format) and an episode
  ceiling on a slider whose floor is pinned at one episode, with an
  "Any length" toggle for turning the ceiling off
- Filters are applied **before** the 24 recommendations are elected, never
  after. The format is applied while the candidate pool is being
  collected — it is already known on every relation and community
  recommendation — so asking for Movies collects Movies rather than
  collecting everything and discarding most of it. The episode ceiling is
  applied to an enlarged candidate pool before ranking, so narrowing
  still aims to fill all 24 slots
- A discovery query that tops the pool back up to 24 when narrowing (or
  simply running out of connected titles) leaves it short. AniList applies
  the format filter server side, and the episode ceiling is applied to the
  thin response before any of it is hydrated. Titles with no published
  episode count are always kept, since a ceiling is a preference about
  length rather than a verified fact
- The result card states which filters it was scored against, and changing
  a filter marks a shown result stale exactly like editing a pick does
- Undo now restores the picks and the filters together, so reverting never
  leaves the user in a mix they did not choose
- Tests for all of the above: format and episode matching, the unknown
  episode count, the slider floor, the server-side format argument, the
  top-up (paging, exclusions, overlaps, deduplication, failure), and
  determinism under shuffled input with filters applied

- A prerequisite gate on candidates: a title that follows another
  series — a sequel, a later season, or a film continuation such as
  _Cowboy Bebop: The Movie_ or _The End of Evangelion_ — is only
  recommended when the series it follows is one of the three picks.
  Candidates now carry their own AniList relations, and only a
  `PREQUEL`/`PARENT` edge to a **TV series** counts as required
  viewing, so extras tagged as prequels (ONE PIECE's prequel ONA,
  _Attack on Titan: No Regrets_, _Tokyo Ghoul: [PINTO]_,
  _JUJUTSU KAISEN 0_) leave the title recommendable
- Tests for the gate: unmet and met predecessors, OVA/ONA/movie and
  manga predecessors, manga continuations, an unmirrored relation
  edge, and sequel candidates arriving by community recommendation

- A direct AniList link on the result title plus a quiet "View on
  AniList" link on the card, both opening in a new tab with
  `rel="noopener noreferrer"`
- A page footer crediting AniList as the source of the anime data and
  cover art, and stating the app is not affiliated with AniList
- A re-roll control on the recommendation card: a "Seen it — show me
  another" button steps through the next-ranked eligible candidates
  without re-querying AniList. `recommend()` now returns the full
  ranked queue instead of only the winner, and the button is replaced
  by a note once every match has been seen
- "Back to the previous one" beside the re-roll button, plus a visible
  "N of M" queue position, so a skipped title is recoverable
- Undo for the selection change that invalidates a result: the previous
  card stays on screen dimmed with "Undo my last change" and
  "Edit my picks" instead of vanishing
- The anime metadata already in the model now reaches the result card —
  native title, main studio and genre chips
- Year, format and episode count stay visible under each locked search
  field, so a pick can be verified after it is made
- Anime already locked into another field is marked "Already chosen" and
  disabled in the suggestion list, preventing a duplicate instead of
  reporting one afterwards
- A pick counter in the section note ("Choose 2 more") and a next action
  in the exhausted-queue state
- A shared `src/ui/format.ts` with `metaLine` and `studioLine`, replacing
  two disagreeing metadata formatters ("26 eps" vs "26 episodes")
- `nativeTitle` on `AnimeSearchResult`, dropped when it duplicates the
  displayed title
- Tests for the stale-card and undo flow, Enter-to-submit, duplicate
  prevention in the suggestion list, the queue back control, focus
  landing on the answer, and the reason copy naming the user's titles
- Component tests for `App`, `SearchField` and `ResultRegion`, covering
  the selection state machine, every `UiState` branch, search debouncing
  and abort isolation, stale-response rejection, combobox keyboard
  navigation with wrap-around, and combobox ARIA wiring
- `@testing-library/react` and `jsdom` as devDependencies; component
  tests opt into a `jsdom` environment per file so the pure-logic suite
  keeps running in `node`
- A design-token layer for colour, type scale, spacing and layout
  constants, consumed through `var()` so no raw hex or magic number
  remains in the component rules
- A minimum text size of `0.875rem`, replacing the previous
  `0.78`–`0.9rem` status, label and metadata sizes
- A `prefers-reduced-motion` guard that stops the loading spinner
- An explicit disabled treatment for the submit button, replacing
  `opacity: 0.45`, so the control stays readable while disabled
- `::-webkit-search-cancel-button` suppression, so the browser's own
  clear affordance no longer duplicates the field's Clear button
- A bounded submit: a slow-wait admission ("This is taking longer than
  usual") after `SUBMIT_SLOW_MS`, a hard deadline at `SUBMIT_TIMEOUT_MS`
  that fails the run instead of spinning forever, and a Cancel button on
  the loading card that restores the previous answer. Both tunables live
  in `src/ui/config.ts`. A cancelled or timed-out run can no longer
  overwrite the UI once its late response lands
- A "Try again" retry on the error card that re-runs the same three
  picks, and a "Try the search again" retry after a failed search, so
  "try again" copy is now an action rather than advice
- The unavailable state names the field to clear ("Anime 3 is no longer
  listed") and marks that field `aria-invalid`, replacing a three-way
  guess across visually identical inputs
- A collapsible filter section. The format chips and the episode ceiling now
  sit behind a "Narrow it down" disclosure that starts closed, so the
  one-shot viewer reaches the submit button without nine controls in the
  way, while the fold's right-hand slot names the active narrowing
  ("Movies, up to 12 episodes") whenever filters are in force. The panel is
  a real disclosure — `aria-expanded`/`aria-controls`, hidden while
  folded, and both rows hidden from the tab order with it
- Tests for the collapse: the panel stays out of the DOM by default, opens
  on press, closes again without losing the choices, and keeps reporting
  the active narrowing while folded
- The episode ceiling reads out beside the slider as a labelled value, in
  tabular numerals so the line does not shift as the number changes. It is
  an `<output>`, so moving the slider announces the new ceiling instead of
  leaving the change to the range input's raw value alone
- A "Clear filters" control in the filter heading, offered only while
  something is actually narrowed and reachable whether the panel is open
  or folded. One press returns the format chips and the episode ceiling
  together, and it is captured by the same undo snapshot as any other
  filter change, so a cleared result is still recoverable
- Tests for it: absent while unfiltered, clearing both axes in a single
  change, still reachable while the panel is folded, and locked while a
  recommendation is being scored

### Changed

- `engines.node` is pinned to `22.x` instead of the open-ended `>=20.19.0`
  range, so the Hostinger build receives the concrete version it expects.
  CI already ran Node 22, so the workflow is unchanged
- The production build sets a relative `base` (`"./"`), so asset, script and
  favicon URLs resolve from any deploy path instead of assuming the site is
  served from the domain root
- The `prepare` script is non-fatal. It still points Git at `.githooks`, but a
  checkout without a `.git` directory — the Hostinger build — no longer fails
  `pnpm install` when the `git config` call exits non-zero

- The app is renamed from AniNext to AniMatch across the UI, user-facing
  metadata, documentation, and the package name (`animatch`). No behaviour
  changed: no code identifier, CSS class, test, or scoring rule referenced the
  old name

- `getAnimeBatch` results are cached on the sorted, de-duplicated id list, so a
  repeat submit with the same picks reuses the metadata already fetched instead
  of re-requesting it. The internal 50-per-request chunking stays inside the one cached load
- The submit deadline rose from 20s to 45s. A submit costs around five requests
  unfiltered and ten with discovery top-up, and under AniList's degraded rate
  limit a single request can legitimately wait out a `Retry-After` longer than
  the old deadline, so it could fail a run that was about to succeed. The
  slow-wait message and Cancel button still cover the wait
- The search debounce rose from 300ms to 600ms and the minimum query length from
  2 to 3 characters, cutting the requests a session fires against a limit
  measured at 30/minute. Results arrive about 300ms later, and a two-character
  title needs a third keystroke before it searches
- `searchAnime` now shares one in-flight request between callers searching the
  same term, and a term already fetched is served from cache, so re-searching or
  a second field typing the same word costs no request

- The episode ceiling tops out at 120 episodes instead of 200. 200 was far past
  the point where a ceiling still describes anything — most long-running
  series the slider could reach are ones a reader would already rule out. The
  scale's right-hand label dropped its `+`, which had been claiming more than
  the slider could express at any ceiling
- The slider is no longer blocked while "Any length" is selected. Moving it
  applies the ceiling and unticks the box in the same change, since "any
  length" is just the absence of a ceiling rather than a separate mode. The
  remembered ceiling, clearing the filters, and undo all behave as before. The
  rail fill now tracks the thumb, because a slider that can be dragged must not
  look inert, and the help line reads "Any length is allowed. Move the slider
  to set a ceiling." while the box is ticked instead of describing a ceiling
  that is not in force
- The "Matched to your filters" line on a result card no longer butts against
  the recommendation above it. It stays exactly the plain single sentence it
  always was — same sans, same caption size, same quiet tone — but now opens
  32px above the answer instead of 0, and is capped at the 68ch measure so it
  cannot run the full width of the card. The fix is spacing only; the line's
  voice is unchanged

- The episode ceiling control was rebuilt around a real range: an 8px rail
  with an accent fill running to the thumb, a 26px thumb with its own
  hover, active and focus states, and the floor and ceiling labelled under
  the rail in tabular numerals. The "Any length" checkbox grew from 16px to
  20px and moved out of the label column into a bordered toggle beside the
  value it disables, where the relationship is legible, with a checked
  state that reads as a setting rather than an empty box. The fill is
  driven by `transform: scaleX()` so dragging never animates layout
- The "Any length" toggle keeps its remembered ceiling, so ticking and
  unticking it still restores the value the slider was left at, and
  clearing the filters does not discard it either
- `recommend()` now takes the active filters, and `buildCandidateSeeds()`
  takes them too: the format check happens on the raw format already
  carried by every relation and community recommendation, before the
  pool is sorted and capped. While any filter is active the pool widens to
  `FILTERED_POOL_SIZE` so the final slice of `CANDIDATE_LIMIT` still has
  enough left to fill it
- `RelatedAnime` and `CommunityRecommendation` now carry the raw AniList
  `format` the connections query was already selecting but discarding.
  Without it a format filter could not run before hydration
- The format enum and its display labels moved to `src/models/anime.ts`
  as `ANIME_FORMATS` / `ANIME_FORMAT_LABELS`, so the raw value sent in a
  query and the label shown to the user come from one definition
- `CandidateSeed` carries an `origin` (`relation` or `discovery`), and a
  discovery candidate's relation has a null `sourceId` — so it never
  claims a link to a pick in its reasons and scores below anything that
  is genuinely connected
- The stale-card note now reads "picks or filters", since either can put
  the shown result out of date
- The recommendation card now reads as the peak of the page instead of a
  quiet continuation of the selector: it is set off by the same 3px ink
  rule the selector uses (drawn in once on arrival, respecting reduced
  motion), the cover art sits on a soft plate, the title steps up to a
  dedicated display size, and the re-roll control becomes the card's
  primary solid action with the secondary actions kept quiet. Eyebrow,
  "Why this one" and "Based on" are separated by hairline rules so the
  card scans in three bands
- Reasons are written as an argument rather than a score dump: they name
  the user's own picks ("Fans of Cowboy Bebop and Trigun also went on to
  watch this"), lead with the strongest signal, and are capped at two.
  The templates no longer leak `MIN_SHARED_SELECTIONS` or the phrase
  "at least N selections", and the fallback is a concrete sentence
  instead of "Strong overall metadata match"
- Changing any of the three selections no longer clears a shown
  recommendation. The card stays visible, dimmed, labelled as no longer
  reflecting the current picks, with undo and edit-picks actions
- The selector is a `<form>` with a `type="submit"` button, so Enter
  completes the flow; focus moves to that button once the third distinct
  pick lands
- The result card is no longer wrapped in a blanket `aria-live` region,
  which re-announced the whole card on every re-roll. A short
  `role="status"` sentence carries the state instead, and focus moves to
  the result heading when an answer arrives
- The duplicate error is only in the DOM when there is a duplicate,
  rather than registering an empty alert region from first paint
- Error and status copy no longer names AniList in user-facing text
- Each non-result state gets its own accent weight, replacing the
  identical 4px left border on all four
- `MAX_REASON_GENRES` and `MAX_REASON_THEMES` were replaced by a single
  `MAX_REASONS` cap
- `index.html` mounts into a `<div>` so the page has one `<main>`
  landmark rather than two
- ESLint ignores the `.opencode/` and `.impeccable/` tool directories,
  which are outside the TypeScript project and failed to parse
- The test suite was consolidated from 126 to 94 cases. Redundant
  restatements were folded into the test that already made the same
  claim — the four ways of reaching `no-match`, the adult/vanished/
  repeated candidate filters, the retry-backoff header cases, and the
  re-roll button states asserted identically in both `App` and
  `ResultRegion` — and two vacuous tests were dropped (a pure function
  called twice, and assertions already covered by `App`). No behaviour
  lost its coverage; the `anilist` retry-exhaustion test moved onto fake
  timers, cutting that file from 1053ms to 37ms
- `RecommendationResult.recommendation` was replaced by `results`
  (the ranked queue) and `UiState` gained an `index` cursor for re-rolls
- Focus outlines now meet WCAG 1.4.11 (3:1 non-text contrast) against
  the page surface, with an inner surface-coloured ring so they stay
  visible on both light and dark fills
- Muted text, the search input border and the suggestion meta text were
  darkened to meet WCAG 1.4.5 (4.5:1 text contrast)
- Element-level selectors (`h1, h2, h3, p`, `label`, `input`, `ul`)
  replaced with component classes, and the stylesheet is split into
  `reset`, `tokens`, `base` and `components` cascade layers
- `Inter` was dropped from the font stack in favour of a system font
  stack; it was never loaded, so every visitor already received
  `system-ui`
- `.cover-placeholder`, which had no matching rule, is now
  `.cover--placeholder`, and the search-result placeholder shares a
  single `.suggestion-thumb` class
- `.page-shell` is now the `<main>` landmark, and the search field is
  a `<div>` rather than an unattributed `<section>`
- Body text now inherits a `1.5` line height, and long body copy is
  constrained to a `68ch` measure

- ESLint 9 (flat config, type-aware via `typescript-eslint`) and Prettier
  as devDependencies, with `lint`, `lint:fix`, `format`, `format:check`,
  `typecheck` and `check` scripts. `check` runs lint, format, tests and
  build in one command
- Search suggestions are keyboard navigable: arrow keys move the active
  option, `Enter` selects it, `Escape` dismisses the list
- Test coverage for the recommendation engine: `recommend()` validation,
  the no-match path, adult and missing candidates being dropped, never
  recommending a selection, determinism across repeated calls and
  reordered inputs, and propagation of lookup failures
- Test coverage for retry backoff timing, retry exhaustion, cache
  eviction on failure, batch splitting above the AniList page limit, and
  abort isolation between concurrent searches
- Ranking assertions now cover each tie-breaker in turn (score, source
  count, popularity, id) plus input-order independence and non-mutation
- `AGENTS.md` — instructions and restrictions for AI coding agents
  (pnpm-only workflow, deterministic recommendations, zero runtime deps)
- Community recommendations from AniList (`Media.recommendations`, sorted
  by rating) as a candidate signal alongside franchise relations
- `SAME_UNIVERSE` relations are now eligible discovery candidates
- Batched media fetching (`Page.media(id_in)`) — selection and candidate
  details load in a single request instead of up to 24
- Metadata scoring: main-studio similarity, release-era proximity, and a
  popularity tie-breaker
- React 19 (`react`, `react-dom`) with `@vitejs/plugin-react` — the UI is
  now component-based (`src/App.tsx`, `src/main.tsx`, `src/ui/`)

- The filters read as one fold in the page rather than a paragraph between
  two loud elements: the fold row sits in its own band with breathing room
  above and below, and the rule at the top of it draws in from the left as
  a terracotta crease when the panel opens — the same device that opens the
  result card, at the fold's own scale
- The active narrowing while folded is terracotta bold text instead of a
  rounded pill, keeping the section's only colour on the word that matters
- Format toggles are square, like every other control on the page; the pill
  is now reserved for read-only genre chips, so a control and a label are no
  longer the same shape
- The three search fields read as cells in a spec table, matching the
  filter rows' rail-and-hairline structure, and the focused field carries a
  terracotta bottom edge so the live edge of the form is unmistakable
- One shared 160ms easing across the hoverable controls (chips, clear,
  retry, re-roll, suggestion rows, credit link), which previously snapped
  while the submit button and the fold eased
- The open filter panel is laid out as two rails and two hairline-separated
  rows: the labels and the "Any length" switch sit in a 9rem left rail, the
  controls in the rest. It reads as one instrument panel instead of four
  stacked fragments, and the rail collapses under the controls below 700px
- "Find a recommendation" is set in the display serif at lead size with a
  fixed minimum width, and goes full width below 700px, so the form ends on
  a deliberate action rather than a small dark chip floating left
- The AniList credit now carries the `.anilist-link` treatment the
  stylesheet already defined for it, so the source is named as an
  attribution instead of reading as more body text

- Retry decisions in the API client go through a single `isRetryable(status)`
  helper instead of repeating the condition in the request and catch paths
- Tunable numbers moved into config modules: reason caps
  (`MAX_REASON_GENRES`, `MAX_REASON_THEMES`), the shared-selection
  threshold (`MIN_SHARED_SELECTIONS`), `REQUIRED_SELECTIONS`, and the
  search debounce (`SEARCH_DEBOUNCE_MS`). Reason text now derives its
  counts from the selection list instead of hardcoding "3" and "2"
- `tsconfig.json` gained `paths` for the `@` alias plus
  `noUncheckedIndexedAccess`, `noImplicitOverride` and
  `verbatimModuleSyntax`. All cross-directory imports under `src/` use `@/`
- Config objects use `as const satisfies`, so a misspelled weight key read
  is a compile error rather than a silent `undefined`. Lookups go through
  the new `relationWeight()` helper, which also rejects inherited keys
- `package.json` declares `packageManager` and `engines.node`, so the
  pnpm-only rule is enforced by the tooling
- Studio lookups ask AniList for main studios directly
  (`studios(isMain: true)`) rather than fetching every studio and
  filtering on `isMain` client-side
- Recommendation hydration builds scored `Candidate`s directly instead of
  returning `{ seed, anime }` tuples for a second mapping pass, and
  `recommend()` no longer mutates the winning candidate to attach reasons
- The "Find a recommendation" button and the debounced search timer call
  their async handlers through a `void` wrapper rather than passing a
  promise-returning function where a void return is expected
- The three search fields render from the `selections` array rather than a
  second `Array.from` over the same count
- Test infrastructure hardened: fetch mocks use real `Headers` objects
  rather than `Map`, retry and abort tests drive fake timers instead of
  sleeping, `vi.stubGlobal` is undone with `vi.unstubAllGlobals()`, and
  the response cache is cleared in `beforeEach`. The previous `Map` mock
  returned `undefined` where a real `Headers` returns `null`, which is
  what allowed the broken retry backoff to pass CI
- Recommendation tests split to mirror `src/`: `similarity.test.ts`,
  `candidates.test.ts`, `scoring.test.ts`, `reasons.test.ts` and
  `recommend.test.ts`, sharing `fixtures.ts`. The previous
  `recommendation.test.ts` covered four modules in one file
- `UiState` moved from `src/ui/ResultRegion.tsx` to `src/models/ui.ts`
- `style.css` moved to `src/styles.css`
- Tests run in the default node environment; `jsdom` is no longer
  configured globally now that the API layer no longer uses `window`
- Recommendation engine re-keyed from MyAnimeList ids to AniList ids;
  titles without a MAL id are now selectable and can be recommended
- Relation eligibility and weights now keyed by AniList relation enums
  instead of display labels
- UI migrated from vanilla TypeScript DOM manipulation to React;
  `src/ui/search.ts` and `src/ui/results.ts` replaced by
  `src/ui/SearchField.tsx` and `src/ui/ResultRegion.tsx`, state is now
  managed with hooks, and `escapeHtml` was dropped (React escapes by
  default). Behavior and markup structure are unchanged
- `README.md` and `AGENTS.md` — use `pnpm` commands instead of `npm`

### Removed

- `getAnime()` and its dedicated `MEDIA_QUERY`. The app only ever fetched
  single anime through `getAnimeBatch`; nothing in `src/` called it
  outside tests
- Unused fields on the domain model that were populated but never read:
  `Anime.malId`, `Anime.studios`, and the six per-dimension score fields
  on `Candidate` (`genreScore`, `themeScore`, `typeScore`, `studioScore`,
  `eraScore`, `metadataScore`)
- `CandidateSeed.title`, which was carried through scoring but never
  displayed; `anime.title` is used instead
- Six `as` casts in the AniList client, replaced by an `isId()` type guard
  and explicit `typeof` checks
- Five `FORMAT_LABELS` entries that were identical to the existing
  underscore-to-space fallback (`TV`, `SPECIAL`, `OVA`, `ONA`, `MUSIC`)
- `jsdom` devDependency. Tests run in the node environment and the only
  `window` usage is in the untested UI layer
- `src/main.ts` — replaced by `src/main.tsx` as the Vite entry point
  (`index.html` updated accordingly)
- Per-candidate detail request fan-out (replaced by the batched fetch)
- `DETAIL_CONCURRENCY` (no longer needed with batched fetching)

### Fixed

- Active filter chips and selected text no longer take their foreground from
  the surface palette. Both used a surface token (`stock-raised`, then
  `ink-on-strong`) as the text colour on the Press Red fill, which produced
  dark-on-red text once surfaces invert. They now use a dedicated
  `ink-on-accent` token, so the selected state stays legible in either theme.
  The slider thumb's shadow likewise moves to a `shadow-thumb` token so it can
  darken with the theme instead of staying slate-tinted

- Reason and genre ordering no longer depends on the browser locale. The
  recommendation reasons and the discovery genre list sorted user-visible
  strings with `localeCompare`, whose ICU collation can order the same AniList
  data differently from one browser to the next. Both now compare by UTF-16
  code unit, a fixed ordering, so identical data renders the same text
  everywhere — the determinism the engine already guaranteed for its ranking
  now holds for its copy as well

- The AniList response cache grew without bound for the life of the tab. Every
  search term and every distinct batch id list stayed resident forever, and a
  request that never settled pinned its key indefinitely. Entries now expire
  after `CACHE_TTL_MS` (10 minutes) and the cache is capped at
  `CACHE_MAX_ENTRIES` (50) with least-recently-used eviction, so a long session
  cannot accumulate hydrated `Anime` payloads without limit. Both bounds live in
  `src/api/config.ts` alongside the other tunables. A live entry is never
  evicted — its callers are still waiting on it — so the cap is a soft ceiling
  under extreme concurrency
- Cache eviction is identity-guarded: a superseded or aborted entry can no
  longer delete the fresh entry that reuses its key when its rejection lands
  late. This closes an ABA race between an entry that is cleared and a
  replacement created for the same term before the first settles
- `clearAnilistCache` now aborts in-flight requests before dropping their
  entries, instead of orphaning their controllers so they kept retrying unseen

- A stalled AniList request could hang a search or a submit forever. `fetch`
  accepted a caller's signal but nothing created a deadline,
  `getAnimeConnections` discarded its cache's signal, `getDiscoveryCandidates`
  took none, and the submit deadline and Cancel only changed UI state while the
  fetches kept retrying. Every request attempt now carries a 15s internal
  deadline, `recommend()` forwards a signal to the connections, batch and
  discovery calls, and Cancel, the 45s submit deadline and unmount abort the
  in-flight controller. An abort is no longer swallowed by the discovery
  top-up's partial-pool fallback
- `Retry-After` is clamped to one minute and now understands the HTTP-date
  form. A header such as `1e308` previously produced `Infinity`, which
  `setTimeout` silently capped at roughly 24.8 days, and an HTTP date was
  discarded entirely, falling back to exponential backoff
- Abort detection is structural (`isAbortError`) instead of an
  `instanceof DOMException` check, so the API layer stays free of DOM globals
  and a cancellation raised as a plain `Error` is still recognised

- The search response cache was unreachable from the UI. `cached()` bypassed the
  cache whenever an `AbortSignal` was present, and `SearchField` always passes
  one, so every debounce tick was a guaranteed network call. The cache now holds
  the shared in-flight promise and each caller races its own abort against it:
  concurrent identical searches make one request, a warm entry serves abortable
  callers, and the shared request is aborted only once the last caller has gone,
  so it cannot retry unseen and spend budget nobody is waiting for. This
  reverses the earlier "abortable searches bypass the cache" decision — the test
  that encoded it is rewritten to assert the real invariant: one fetch, both
  callers served, aborting one leaves the other intact
- `searchAnime("Cowboy")` and `searchAnime("cowboy")` were two requests; cache
  keys are now lowercased with whitespace collapsed, so case and spacing variants
  resolve to one entry
- An already-aborted signal now rejects before any request is made, instead of
  issuing one fetch that is immediately abandoned

- Every search field showed a dead "Clear" button, whether or not a title
  was chosen. `hidden` on `.field-clear` was defeated by the rule's own
  `display: inline-flex`, so a divider sat permanently inside the control
  and the focus underline stopped short of it. The button is now rendered
  only once a selection exists
- The search field drew two focus indicators at once: the input's own
  outline, clipped inside the box it shares with the clear button, plus the
  control's focus treatment. The input no longer outlines, so the control
  carries one complete ring and the underline is never interrupted
- An arriving recommendation sat below the form, so answering "Find a
  recommendation" left the user scrolling past the picks, the filters and
  the submit button to see the result. The result card and every outcome
  card now scroll into view on arrival — smoothly, or without animation
  under `prefers-reduced-motion` — and both card types carry a
  `scroll-margin-top` so nothing lands flush against the viewport edge.
  The loading card is deliberately excluded, since it sits directly under
  the button that was just pressed, and re-rolling the queue in place
  leaves the page where it is. Each new run reveals its own outcome again,
  so a second failure below the fold is not silently left there, and the
  result heading no longer scrolls the viewport on its own — the reveal is
  the only thing that moves the page
- The suggestion dropdown had no height cap, so a long result list could
  run past the bottom of the viewport with no way to reach the tail
- Below 700px the folded filter summary butted straight against the
  disclosure title, because the heading stacks there
- Dead `.anilist-credit` and `.filter-heading` rules, and an unused
  `--text-xl` token, removed from the stylesheet
- The 64px chapter break the stylesheet had been promising never existed:
  `.result-region` was dead CSS, so a recommendation, a loading card and an
  error card all arrived a few pixels under the submit button with no
  separation from the form that produced them. The margin now sits on
  `.result-card` and `.message-card` themselves, so every outcome is set off
  from the selector
- `img { height: auto }` in the base layer, so cover art with an unexpected
  intrinsic ratio cannot stretch the box that was sized for a 2:3 plate

- A sequel could be recommended before its prequel. Relation-based
  candidates were already filtered to discovery types, but
  `Media.recommendations` had no such filter and nothing downstream
  knew a candidate's own relations, so _Naruto: Shippuden_ was offered
  to users who never picked Naruto and _The End of Evangelion_ to
  users who never picked _Neon Genesis Evangelion_
- The candidate batch query now asks for each candidate's
  `relations`, adding fields to an existing request rather than a
  round trip
- The re-roll queue no longer runs past its last entry. `handleReroll`
  incremented the cursor without a ceiling, and an out-of-range index fell
  back to the first result, so pressing "Seen it — show me another" past the
  final title showed pick #1 again under a counter reading "25 of 24" while
  the button stayed clickable forever. The cursor is now clamped to the last
  result, the button is hidden once the queue is exhausted (leaving the
  existing next-action note in its place), and an out-of-range index renders
  no card instead of the wrong title
- The result card renders the "View on AniList" link its test asserted.
  The link was documented and covered but never rendered, so
  `ResultRegion.test.tsx` failed on a clean checkout
- Retry backoff was effectively disabled. A missing `Retry-After` header
  returned `null`, and `Number(null)` is `0`, which passed the
  `Number.isFinite` check — so every 429/5xx retry waited 0 ms instead of
  backing off exponentially
- Aborting one search no longer fails a concurrent search for the same
  query. The response cache stored a promise bound to the first caller's
  `AbortSignal`, so a second caller inherited it and died with its
  `AbortError`; abortable calls now bypass the cache
- Search suggestions use a valid ARIA combobox/listbox pattern. Options
  were `<button role="option">` inside a `role="listbox"` container; they
  are now `<li role="option">` with `aria-selected`, and the input
  exposes `aria-expanded`, `aria-controls`, `aria-autocomplete` and
  `aria-activedescendant`
- An anime that AniList no longer lists now shows "One selection is no
  longer available" instead of the generic failure message. The previous
  code threw an error that was immediately caught and discarded
- The keyboard could select an anime the pointer path refused. Enter on
  the combobox read `matches[activeIndex]` without the taken check, so a
  keyboard user could create a duplicate the disabled suggestion button
  prevented — and `aria-activedescendant` could land on a disabled option
  where Enter failed silently. Taken options are now skipped by the arrow
  cycle, refused by Enter with an explanation ("Already chosen — pick a
  different anime"), never made the initial active option, and carry
  `aria-disabled` on the `role="option"` so the state is announced rather
  than implied
- `.field-clear` was a ~21px tap target in the corner of a ~200px column —
  below the WCAG 2.2 AA 2.5.8 minimum and the only route to changing a
  locked pick. It and the episode slider thumb now meet the 24x24 floor,
  with the slider thumb drawn from the existing accent tokens
- The undo for a shown result was destroyed before the request it guards.
  `handleSubmit` cleared the restore point on submit, so a failed
  re-submit left the prior state unrecoverable; the point is now reset
  only when a new result actually lands
- Staleness was conveyed by greyscale alone. The live region announced
  the identical sentence for a fresh and a stale card; it now announces
  "Your picks or filters changed. This is the previous recommendation: …",
  and the filters line on a stale card reads "Was matched to your
  filters" rather than claiming the current filters still apply
- One loading state had two sentences: sighted users read "Finding your
  next anime..." while screen reader users heard "Finding your
  recommendation." The announcement now matches the visible copy, and a
  slow wait gets its own escalating sentence
- The no-match message leaked engine vocabulary ("direct franchise
  continuations") into the state a first-time user is most likely to
  hit; it now names what was actually found — direct sequels and
  spin-offs of the user's own picks — in the user's terms
- A low AniList budget could lock search for the rest of the tab. The gate
  tracked only `X-RateLimit-Remaining`, so once it fell to three the "Try the
  search again" button re-entered the same guard and failed forever, and an
  empty header counted as zero. The client now tracks `X-RateLimit-Reset`
  alongside remaining and releases the gate when it passes, with a one-minute
  fallback when the header is missing, unparseable, or in the past. Empty,
  non-finite, and negative values are ignored or clamped, and a far-future
  reset is clamped to the same window
- Connections, batch and discovery now share the low-budget guard, so a
  throttled server is not retried with more requests while search is already
  parked. The guard sits inside each cache loader, so a warm entry is still
  served without spending budget
- The search field now distinguishes a rate-limited search from a failed one:
  it shows a temporary-unavailable message and keeps "Try the search again"
  disabled until the reset passes, instead of offering an instant retry that
  re-enters the same guard

## [0.1.0]

### Added

- Initial release: anime search UI with three selection slots
- AniList API client (search, details, relations)
- Deterministic recommendation engine (candidates, similarity, scoring, reasons)
- Vitest + jsdom test suite
