# AniNext — Deployment Readiness Plan

**Host:** Hostinger Business plan (Node.js Web App flow, GitHub auto-deploy)
**Architecture:** Option A — pure static client-side SPA, no backend
**Status:** In progress — implementation order set (§11.3); branch 1 landed.
Hostinger panel access is unavailable, so every branch except the deploy itself
proceeds now and deployment is deferred.
**Date:** 2026-10-15

---

## 1. Summary

AniNext is a client-only Vite + React SPA that calls the AniList GraphQL API
directly from the browser. AniList returns `access-control-allow-origin: *`, so
no CORS proxy is required and the app deploys as static files.

The primary engineering risk is **API request volume against AniList's rate
limit**, which was verified live to be **30 requests per minute** (degraded from
the documented 90), enforced per IP, with a burst limiter on top. AniList
reserves the right to manually block IPs making excessive requests.

The dominant cost is **search**, not submit. Reducing search requests via
debounce tuning and a cache repair is the highest-leverage change in this plan.

Expected outcome: a realistic session drops from **~20 requests to ~8–10**.

---

## 2. Verified facts

Established by inspection, a full local `pnpm check`, and live API probing.

### 2.1 Current state

| Item           | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Build          | passes — `tsc --noEmit && vite build`                     |
| Tests          | 274 passing across 13 files                               |
| Bundle         | 257.27 kB JS (80.55 kB gzip), 19.12 kB CSS (4.24 kB gzip) |
| Router         | none — single URL, so no SPA fallback needed              |
| Persistence    | none — memory only                                        |
| CI             | none — no `.github/` directory                            |
| LICENSE        | absent                                                    |
| `public/` dir  | absent — no favicon declared                              |
| Error boundary | absent                                                    |
| Preview script | absent                                                    |

### 2.2 AniList rate limit (measured)

Request headers from a live `POST https://graphql.anilist.co`:

```
x-ratelimit-limit: 30
x-ratelimit-remaining: 29
access-control-expose-headers: X-RateLimit-Limit, X-RateLimit-Remaining,
                               X-RateLimit-Reset, Content-Length, Content-Range
access-control-allow-origin: *
```

Burning the bucket confirmed request 31 returns:

```
HTTP 429
retry-after: 55
x-ratelimit-remaining: 0
{"data":null,"errors":[{"message":"Too Many Requests.","status":429}]}
```

**Consequences:**

- The limit is **30/min**, not the documented 90. AniList's docs state the API
  is "currently in a degraded state."
- The limit is **per IP**, and the browser holds the visitor's IP — not the
  operator's. Corporate NAT, universities, and mobile carrier CGNAT therefore
  share one budget across many users. This is the structural risk.
- `X-RateLimit-*` headers **are readable from the browser**, so the client can
  observe its own remaining budget.
- AniList may **manually block** IPs making excessive requests.

### 2.3 Request cost breakdown

| Action                                   | Requests |
| ---------------------------------------- | -------- |
| Search, one field, current config        | 2–4      |
| Search, one field, tuned config          | 1        |
| Submit, unfiltered path                  | 5        |
| Submit, filtered + discovery top-up      | ~10      |
| Any request under 429, `MAX_RETRIES = 2` | up to 3× |

The retry multiplier is the sharpest edge: **one submit can consume an entire
30/min budget** when the API is degraded.

### 2.4 Existing retry behaviour (already good)

`src/api/anilist.ts` `fetchJson` implements `MAX_RETRIES = 2`, exponential
backoff from 500 ms, `Retry-After` header support, and abort propagation. 28
tests cover the API module. This handles individual 429s well; it does not
address aggregate exhaustion, since there is no shared budget to observe.

---

## 3. Hostinger deployment configuration

Business plan supports the Node.js Web App flow with GitHub auto-deploy.

### 3.1 hPanel build settings

| Setting          | Value     | Note                                    |
| ---------------- | --------- | --------------------------------------- |
| Application type | `vite`    | detected from `package.json`            |
| Node version     | `22`      | **set explicitly** — see risk R1        |
| Build script     | `build`   | the _script name_, **not** `pnpm build` |
| Output directory | `dist`    | matches Vite default                    |
| Entry file       | _(empty)_ | static site, no Node server runs        |
| Package manager  | `pnpm`    | auto-detected from `pnpm-lock.yaml`     |
| Root directory   | `/`       |                                         |

### 3.2 Deployment filesystem layout

```
hbuilds/current/nodejs        build artefacts
public_html/                  live static output
public_html/.htaccess         auto-generated by Hostinger — do not hand-edit
```

**`public_html` and `hbuilds/` are overwritten on every redeploy.** Manual edits
via File Manager, FTP, or SSH will not persist. Source changes must go through
GitHub and a redeploy.

Because the app has no router, the generated `.htaccess` is harmless — no SPA
fallback rule is required.

### 3.3 First-deploy risks

| ID  | Risk                                                                                                       | Mitigation                                                       |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1  | `engines: ">=20.19.0"` is a range, not a pin; Hostinger expects a concrete version                         | Set Node `22` explicitly in hPanel                               |
| R2  | `packageManager: "pnpm@12.6.0"` may trip corepack if unavailable                                           | If install fails, set package manager to `pnpm` explicitly       |
| R3  | `pnpm-workspace.yaml` sets `allowBuilds: esbuild: false`; a different pnpm major may not recognise the key | Builds locally today; escalate only if the Hostinger build fails |

### 3.4 Deploy sequence

1. Push the prepared branch to `main`.
2. hPanel → Websites → the site → Dashboard → Connect to GitHub.
3. Authorize the Hostinger GitHub App for `angelortjimz/anime`.
4. Review auto-detected build settings against §3.1.
5. Deploy; inspect the build log on failure.
6. Verify the live URL, including the smoke tests in §8.2.

---

## 4. Phase 1 — Search request reduction (highest leverage)

Target: a realistic session from ~20 requests to ~8–10.

### 4.1 Raise the debounce — `src/ui/config.ts`

`SEARCH_DEBOUNCE_MS`: `300` → `600`.

Proportional reduction in mid-typing fires. Trade-off: results arrive ~300 ms
later. Acceptable against a hard 30/min ceiling.

### 4.2 Raise the minimum query length — `src/api/anilist.ts`

`SEARCH_MIN_LENGTH`: `2` → `3`.

Eliminates intermediate queries such as `"co"` and `"cow"`, which return noise
and each cost a request. The value is exported and also drives the hint copy in
`SearchField`, so the user-facing message stays consistent automatically.

Trade-off: two-character titles require a third character. `"91 Days"` will not
fire on `91 ` but will on `91 D` — which is what a user would type regardless.

### 4.3 Repair the dead search cache — `src/api/anilist.ts`

**This is a defect, not a tuning choice.**

```ts
function cached<T>(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal) return load();   // cache bypassed whenever a signal is present
  ...
}
```

`SearchField` always constructs an `AbortController` and always passes its
signal, so `searchAnime` never reads or writes the cache. The cache is correct
but unreachable from the UI. Every debounce tick is a guaranteed network call.

**Fix shape** — cache the shared promise, let each caller race its own abort:

```ts
const current = cache.get(key) as Promise<T> | undefined;
const shared = current ?? startAndCache(key, load);
if (!signal) return shared;
return Promise.race([shared, rejectOnAbort(signal)]);
```

Result: two fields searching `"bebop"` concurrently cost **1** request;
re-searching an already-fetched term costs **0**.

**Test impact — requires deliberate review.** `src/api/anilist.test.ts:602`
currently asserts:

```ts
// The two calls must not share one in-flight request.
expect(fetchMock).toHaveBeenCalledTimes(2);
```

The stated intent — _"one caller's abort must not fail a concurrent search"_ —
is preserved and strengthened by the fix. The assertion as written encodes
"no sharing". Rewrite it to assert the real invariant instead: one fetch, both
callers served, aborting one leaves the other intact.

This reverses a prior design decision. It is approved, but the rewrite must be
a conscious change with the reasoning recorded in `CHANGELOG.md`.

### 4.4 Normalize cache keys — `src/api/anilist.ts`

`searchAnime("Cowboy")` and `searchAnime("cowboy")` are currently two requests.
Key on lowercased, whitespace-collapsed input. Effectively free.

### 4.5 Gate on rate-limit headers — `src/api/anilist.ts`

The client can read `X-RateLimit-Remaining` (confirmed exposed via CORS).

When remaining falls to ~3, stop auto-firing searches and surface the existing
"Search is unavailable. Try again." style message. This converts a hard failure
into a graceful one and provides the signal needed to decide whether the
caching proxy (Option B) is ever warranted.

---

## 5. Phase 2 — Production correctness

### 5.1 Add an error boundary

None exists. `AGENTS.md` forbids `console.log`, so a render crash in production
is a blank page with no diagnostic output at all.

Wrap the tree in `main.tsx`; on catch, render the existing plain-language error
state. This is consistent with the standing commitment that raw errors are
never shown to users.

### 5.2 Cache `getAnimeBatch`

`src/api/anilist.ts`. `getAnimeConnections` caches via `cached()`;
`getAnimeBatch` does not, so repeat submits re-fetch identical metadata.

Cache on the sorted, de-duplicated ID list. Chunked internally at
`BATCH_LIMIT = 50`, so key the whole request, not each chunk.

### 5.3 Reconsider `SUBMIT_TIMEOUT_MS`

`src/ui/config.ts` — currently `20000`.

Submit costs 5 requests unfiltered and ~10 with discovery top-up. On a slow
connection the deadline fires while work is still in flight, showing the user a
failure for a request that was about to succeed. Either raise the value or make
it scale with the known request count.

---

## 6. Phase 3 — Polish

### 6.1 Favicon

Create `public/favicon.svg` and reference it from `index.html`. No `public/`
directory exists and no icon is declared, so every visitor currently 404s on
`/favicon.ico`.

### 6.2 Rewrite `index.html` metadata

Current description — _"A small, deterministic anime recommendation tool."_ —
is accurate for a developer and meaningless to a user or a crawler.

Replace with a user-facing description. Add Open Graph and Twitter card tags,
`theme-color`, and a canonical URL once the domain is known.

### 6.3 Add a `preview` script

`vite preview` for verifying the production build locally before pushing.

### 6.4 Add a LICENSE

Absent. Required before public distribution.

---

## 7. Phase 4 — CI gate

No `.github/` directory exists.

Add a workflow running:

```
pnpm install --frozen-lockfile
pnpm check
```

Enable **corepack**; do not hardcode a pnpm version. `packageManager` is already
pinned to `pnpm@12.6.0`.

On the Business plan this is a **quality gate**, not the deploy mechanism —
Hostinger handles deployment itself via GitHub integration.

---

## 8. Verification

### 8.1 Automated

`pnpm check` — lint, format, 274+ tests, build. Must pass before every push.

New tests required for Phase 1:

| Change                | Test                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------- |
| 4.3 cache repair      | concurrent same-query searches issue one fetch; aborting one caller does not fail the other |
| 4.3 cache repair      | an abortable caller no longer bypasses a warm cache entry                                   |
| 4.4 key normalization | case and whitespace variants resolve to one request                                         |
| 4.5 header gating     | low `X-RateLimit-Remaining` suppresses further searches                                     |

Tests must use realistic `Headers` objects — a `Map` returns `undefined` where a
real one returns `null`, which silently hides header-handling bugs. Use fake
timers for anything debounce- or backoff-related.

### 8.2 Live smoke test after deploy

1. Load the live URL; confirm the app renders (not a blank page).
2. Search an anime, pick three, submit, confirm a recommendation renders.
3. Open DevTools → Network; confirm requests go to `graphql.anilist.co`.
4. Confirm no console errors.
5. Confirm the favicon resolves (no 404).
6. Check responsive layout at mobile and tablet widths.

### 8.3 Rate-limit observation

Watch `X-RateLimit-Remaining` in DevTools during a full session. It should stay
well clear of zero. Sustained exhaustion under normal use would justify
revisiting the caching proxy decision.

---

## 9. Documentation updates

### 9.1 `PRODUCT.md`

Line 84 currently lists _"Deployment target and hosting"_ under
**"Undecided, and future work must not invent an answer."** Move it to a decided
position recording Hostinger Business and the client-only architecture.

### 9.2 `README.md`

Add a Deployment section covering the hPanel settings from §3.1 and the
first-deploy risks from §3.3.

### 9.3 `CHANGELOG.md`

Required by `AGENTS.md` under `## [Unreleased]`, in Keep a Changelog order:
`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`. The cache repair is a
user-visible latency and reliability improvement; the test rewrite at
`anilist.test.ts:602` warrants an explicit note explaining the reversal.

---

## 10. Constraints carried from `AGENTS.md`

These are unchanged by this work and must not be violated:

- **pnpm only** — never npm, yarn, or bun, including in CI.
- **Never persist AniList data.** The AniList terms prohibit using the API as a
  backup or storage service, and prohibit hoarding. The in-memory cache is
  ephemeral and acceptable. **Do not add localStorage or IndexedDB** for anime
  data. If selections should survive a refresh, store only the three chosen IDs
  and re-fetch.
- **No runtime dependencies** without approval. Phases 1 and 2 use only
  existing packages and platform APIs.
- **Determinism** — no randomness in scoring. All changes are in the request
  layer and do not touch ranking.
- **No `console.log`** in `src/`. Rate-limit counters must not introduce one.
- **Raw API errors are never surfaced** to users.
- **Never edit `dist/`** — it is generated by the build.
- **Tests colocated** as `*.test.ts(x)` next to source, one file per module.
- **`pnpm check` must pass** before declaring work done.

### AniList terms compliance

- **Naming:** "AniNext" does not contain "AniList" or "AniChart", so the
  mandatory `UNOFFICIAL` suffix does **not** apply.
- **Attribution:** the footer credit naming AniList as the data source and the
  non-affiliation statement are a standing commitment — keep them as written.
- **Commercial use:** free under $150/month revenue. Not a concern at present.
- **Adult content:** already filtered at the query level via `isAdult: false`.
  AniList notes "Ecchi" is not classified adult, which matters only if app
  store distribution is ever pursued.

---

## 11. Branch strategy

### 11.1 Why branch at all

The repository already works this way. Two prior pull requests merged into
`main` (`ui/add-react`, `ui/improve-filters`), and `main` tracks `origin/main`
cleanly. Branching is not a new convention here.

The reason it matters more than usual on this project is the deploy model:

- **Pushing a branch deploys nothing.**
- **Merging to `main` triggers a Hostinger build.**

A branch is therefore a genuine staging area. Work can be pushed, reviewed, and
`pnpm check`-verified without touching production.

### 11.2 One branch per phase, not one for the plan

Splitting is not ceremony. Each merge is a production deploy, so a branch per
phase means a regression costs one phase to revert rather than the whole plan.

Phase 1 (§4.3, the cache repair) warrants isolation on its own: it reverses a
prior design decision and forces a rewrite of the test at
`src/api/anilist.test.ts:602`. It is the change most likely to need a second
pass, and should not arrive bundled with unrelated edits.

### 11.3 Sequence

Ordered by risk, not convenience. Each branch merges to `main` on its own, and
is verified with `pnpm check` before it does.

| #   | Branch                         | Contents                                    | Why here                                                | Status   |
| --- | ------------------------------ | ------------------------------------------- | ------------------------------------------------------- | -------- |
| 1   | `ci/quality-gate`              | §7 CI workflow                              | Gates every later PR; no product risk                   | **Done** |
| 2   | `site/deploy-baseline`         | §6 favicon, meta, `LICENSE`, preview script | Low risk; proves the deploy pipeline end to end         | **Done** |
| 3   | `api/search-request-reduction` | §4 debounce, cache repair, header gating    | The risky change, isolated and revertable               | **Done** |
| 4   | `app/production-resilience`    | §5 error boundary, batch cache, timeout     | Independent of Phase 1                                  | Pending  |
| 5   | `chore/git-hooks`              | §12 pre-push hook, `prepare` script         | Depends on nothing; last because it is pure convenience | Pending  |

Hostinger panel access is currently unavailable, so the deploy steps in §3.4 —
connecting GitHub, confirming the build settings, and the first build — are
deferred. Every branch can still be authored, `pnpm check`-verified and merged
ahead of that first deploy; nothing in branches 1–5 requires the panel. The
first live build (and its R1/R2/R3 risks) remains the moment to arrive at with
`main` already CI-gated and baseline-proven.

**Do not make the Phase 1 change the first deploy.** If the first Hostinger
build fails on risk R1 (`engines` is a range, not a pin), R2 (corepack versus
`packageManager`), or R3 (`allowBuilds` under a different pnpm major), that
failure should land on a branch that reverts in seconds — not on the cache
reversal.

Branch 1 runs first because CI executes `pnpm check` on pull requests. Note what
that actually buys: Hostinger's build script is `build`, which expands to
`tsc --noEmit && vite build`. It catches type errors but **not** lint, format,
or test failures. Without it, a failing test merges cleanly and deploys.

Collapsing to two branches — CI, then everything else — is defensible if four
pull requests feels excessive. Five remains the preference, for the §4.3
isolation alone.

### 11.4 Per-branch requirements

Every pull request must satisfy `AGENTS.md`:

- `pnpm check` passing — lint, format, tests, build.
- A `CHANGELOG.md` entry under `## [Unreleased]`, in Keep a Changelog order.

Sequential branches appending to `[Unreleased]` do not conflict; the sections
differ per phase.

### 11.5 Before merging branch 3

Run a production build locally:

```
pnpm exec vite preview
```

No `preview` script exists until §6.3 lands on branch 2, so invoke it through
`pnpm exec` until then. Verify the debounce behaviour and request counts in
DevTools before merging — that work has no visual regression to catch it.

### 11.6 Restore the untracked documents first

Commit `f8a6a4d` moved `DESIGN.md`, `PRODUCT.md`, and `plan.md` into `docs/`
while adding `docs/` to `.gitignore`. Git did not record a move — it recorded
three **deletions**, and the files are currently untracked.

```
$ git ls-files | Select-String "DESIGN|PRODUCT|plan"
AGENTS.md
CHANGELOG.md
```

This matters beyond tidiness:

- `AGENTS.md` cites `plan.md` as documented project context.
- `PRODUCT.md` §"Evidence on Hand" cites all three files by name.
- §9.1 of this plan requires editing `PRODUCT.md` line 84 — impossible to review
  against an untracked file.
- A fresh clone receives a repository missing its product spec.

`docs/` has since been removed from `.gitignore`, so the fix is to re-add the
files:

```
git add docs/DESIGN.md docs/PRODUCT.md docs/plan.md docs/deployment-readiness.md
```

Keep this in its own branch. It is a pure restoration with no behavioural
change, and keeping it separate means it reverts cleanly if the `docs/`
location itself is reconsidered.

---

## 12. Local git hooks

### 12.1 What already exists, and what is missing

`pnpm check` already runs lint, format, test, and build. The gap is _when_ it
runs — today it runs only when a human remembers.

The checks have materially different costs, which is what makes hook design a
real decision rather than a default:

| Check          | Approx. cost | Consequence of failure           |
| -------------- | ------------ | -------------------------------- |
| `format:check` | ~1s          | Trivial — autofixable            |
| `lint`         | ~3s          | Low                              |
| `test`         | ~8s          | Medium — 274 tests               |
| `build`        | ~1s          | High, but only matters at deploy |

Running all four on every commit costs roughly 13s of friction to catch
problems that `pnpm format` fixes in two seconds. That mismatch is the usual
reason hook setups get abandoned.

### 12.2 Recommended: a native pre-push hook, no new dependency

`AGENTS.md` requires approval for dev tooling additions. This approach needs
none — it uses git's built-in `core.hooksPath` and a single script.

`.githooks/pre-push`:

```bash
#!/bin/sh
pnpm check
```

Install it via `package.json`, so `core.hooksPath` is set automatically:

```json
{
  "scripts": {
    "prepare": "git config core.hooksPath .githooks"
  }
}
```

`prepare` runs on `pnpm install`, so each contributor sets this up once without
a documented manual step.

**Why pre-push and not pre-commit.** Push is the moment that matters: it is what
triggers the Hostinger build. A pre-commit hook running the full suite would tax
every intermediate commit to guard only the final one.

### 12.3 Optional fast subset on commit

If the pre-push gate proves too late to catch formatting, add a cheap
`pre-commit` hook alongside it:

```bash
#!/bin/sh
pnpm lint && pnpm format:check
```

Keep it to lint and format — under five seconds, and both are autofixable. Do
not include `test` or `build` here.

### 12.4 Constraints

- **CI must not depend on this hook.** It relies on a local `git config` that a
  fresh clone or CI runner does not have. The §7 workflow runs `pnpm check`
  independently and must stand alone.
- **Hooks are bypassable** with `--no-verify`, and are not a security boundary.
  CI is the enforcement point; the hook is fast feedback.
- **`prepare` also runs on `pnpm install --frozen-lockfile`** in CI. Harmless —
  it sets a git config in an ephemeral workspace — but worth knowing.

### 12.5 Why not lefthook

lefthook was considered and set aside. It is a good tool, and its usual shape
suits this repo well:

```yaml
# lefthook.yml — illustrative only, not adopted
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: pnpm lint
pre-push:
  commands:
    check:
      run: pnpm check
```

It earns its keep with multiple hook types, staged-file filtering, and parallel
execution across a larger team. None of that applies yet, and adopting it means
a new dependency plus a binary download for a two-script problem.

Revisit if hook complexity grows — for example if formatting, lint, and test
scoping start diverging per file type.

---

## 13. Out of scope

- **Caching proxy (Option B).** A serverless layer would deduplicate across
  users and cache at the edge, fixing shared-IP exhaustion. It introduces a
  backend, which `AGENTS.md` forbids without approval, concentrates egress on
  one IP, and adds cost. Revisit only if §8.3 shows sustained 429s.
- **MyAnimeList integration.** Discussed in `plan.md` as a future idea, never a
  commitment.
- **SSR / SEO prerendering.** The app is a single interactive screen; there is
  no content to index.
- **Analytics or error monitoring.** Optional; adds a runtime dependency and
  conflicts with the no-tracking posture implied by the current design.
