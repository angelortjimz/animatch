# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences are intended equally, and design work should not privilege one:

- **The one-shot viewer.** Someone who has just finished a run of shows and has nothing left
  lined up. They arrive with three titles already in mind, want one answer, and leave. They do
  not know what genre, theme, or relation weights mean, and nothing on screen should require them
  to.
- **The deliberate taste explorer.** Someone who tests many combinations of three titles and
  re-rolls repeatedly, treating the recommender as a discovery toy. They re-read why a result was
  chosen, walk the ranked queue, and change one pick to explore a different neighbourhood.

The second audience is not an accident of the first: the product deliberately surfaces a 24-deep
queue rather than a single answer, which only pays off for someone willing to browse it.

## Product Purpose

AniMatch takes three distinct anime a user enjoyed and returns one SFW, discovery-first
recommendation, computed entirely on the user's device from AniList metadata.

Success means the user leaves with a title they would not have found on their own, and enough
factual reason to trust it — not with a number, an AI paragraph, or an account to return to.

## Positioning

The claim a generic "anime recommendations" site could not truthfully copy is two-part and
load-bearing as a single idea:

- **Discovery, not continuation.** The recommender will not hand back the next franchise
  installment. Direct continuations are only eligible when the series they continue is one of the
  user's own three picks, and only where the prerequisite is a TV series.
- **Deterministic and explainable.** The same three picks and filters always produce the same
  answer, from a fixed scoring formula, with reasons derived from the same data that produced the
  score. No model, no sampling, no re-roll that changes the underlying answer — re-rolling walks
  a pre-ranked queue.

## Operating Context

- A single screen, no routing. Search, filters, submit, and the result all live in one viewport.
- AniList's GraphQL API is the only data source: titles, cover art, genres, themes, format,
  episodes, year, studio, relations, and community recommendations.
- `pnpm dev` is the working dev command; the app is run and judged locally.
- State is in-memory only. A refresh loses all three picks and the queue. This is a confirmed
  constraint, not an oversight, and the UI is not expected to compensate with persistence.
- The keyboard route through the flow (type, arrow, Enter, Enter) is a first-class path, not a
  convenience.
- Long API waits are part of the experience: search is debounced, a submit can take several
  round trips, and users may re-run combinations freely.

## Capabilities and Constraints

Confirmed functionality:

- Exactly three distinct anime, chosen by explicit selection from search results. The first
  result is never auto-selected.
- Optional filters — format chips and an episode ceiling — applied _before_ ranking, so the
  results already match what was asked for. No pressed chip means any format.
- A prerequisite gate on candidates, so a sequel is recommended only when its series is among the
  picks.
- A ranked queue of up to 24 eligible candidates with re-roll and back navigation.
- Results marked stale when picks or filters change, with undo that restores both together.
- Full outcome states: loading, no match, selection no longer available, network failure.
- AniList link on the result title and on the card, both opening in a new tab.

Hard constraints:

- No accounts, database, backend, or LLM. No randomness anywhere in scoring.
- Determinism is a tested property, not an aspiration.
- Raw API errors are never shown; failures read as plain-language recovery.
- Tunable numbers (weights, limits, reason caps) live in `src/recommendation/config.ts`.
- API access stays in `src/api/`; recommendation logic never fetches.
- All anime data originates from AniList. There is no proprietary catalogue.

Undecided, and future work must not invent an answer:

- Whether the input layer is ever replaced by a MyAnimeList profile — `plan.md` discusses it as a
  future idea, which is not a commitment.

Decided, and no longer open:

- Deployment target and hosting. AniMatch is a pure static, client-only SPA — no backend,
  database, or server runtime — deployed to Hostinger's Business plan via the Node.js Web App
  flow with GitHub auto-deploy. Merging to `main` triggers the build.
- Score visibility. AniList's public community score is shown on the result card, as a caption
  alongside the studio and episode metadata. The engine's own numeric score never surfaces: it is
  an internal mechanism, and the card's claims stay traceable to public metadata or the user's picks.

## Brand Commitments

- **Name:** AniMatch. Product name is fixed.
- **Voice:** warm but plain-spoken. No hype words, no urgency or countdown pressure, no
  exclamation marks. Reasons describe the user's own taste, not the algorithm's internals.
- **Language:** English-first. Japanese native titles may appear as secondary text and must be
  allowed to typeset correctly next to the English title.
- **Attribution:** the footer credit naming AniList as the source of anime data and cover art,
  and the statement that the app is not affiliated with AniList, stay as written. This is a
  standing commitment, not decoration.

## Evidence on Hand

- Live AniList data: metadata and cover art for real titles, relations, and community
  recommendations.
- `CHANGELOG.md` — the shipped behavioural record, current through the filters and prerequisite
  gate work.
- `plan.md` — historical design document referencing the Jikan API. Background context only; the
  implementation uses AniList (`src/api/anilist.ts`).
- A dated critique of the single-screen UI under `.impeccable/critique/`, useful as a record of
  known weaknesses rather than as current truth.

Not available, and never to be fabricated: testimonials, user counts, press, pricing, licensing
terms, accuracy benchmarks, or any claim that AniMatch is better than another recommender.

## Product Principles

1. **One answer is the unit of value; the queue is the depth.** The headline result is a single
   title the user can act on. Everything else in the queue exists to serve the user who wants to
   keep exploring, and must never make the first answer harder to read.
2. **Never recommend the next installment.** Continuity with what the user already finished is
   not discovery. Adjacency beats escalation.
3. **Explain in the user's terms.** Every claim on screen must be traceable to public metadata or
   to the user's own three picks. Engine vocabulary, internal scores, and template filler are
   product defects.
4. **Determinism is a feature, visibly.** The same input yields the same answer, and the UI may
   lean on that — nothing about the result should suggest it was guessed or sampled.
5. **Respect the local, stateless session.** No persistence, no sign-in prompts, no dark patterns
   that retain state the user did not ask to retain. Treat every reload as a clean slate the
   user did not have to ask for.

## Accessibility & Inclusion

WCAG 2.2 AA is the product requirement, with the flow keyboard-complete end to end. Specifically:

- Every step of pick → filter → submit → result → re-roll is reachable and operable by keyboard,
  with visible focus at all times.
- State changes (search results, loading, the arriving recommendation, queue position, stale
  invalidation, errors) are announced, not only rendered.
- Focus moves to the result when an answer arrives, so a keyboard user knows the task completed.
- Japanese text must typeset and wrap correctly alongside English.
- Motion respects reduced-motion preferences.
