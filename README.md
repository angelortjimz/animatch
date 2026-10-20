# AniMatch

A small, deterministic anime recommendation app powered by the AniList API. Pick three distinct anime and receive one SFW, discovery-first recommendation based on eligible related titles, community recommendations, and metadata similarity.

## Run locally

Requires Node `22.x` and pnpm; `corepack enable` provides the pnpm version
pinned in `package.json`. `pnpm install` also points Git at the repository's
`.githooks`.

Install dependencies, then start the Vite development server:

```bash
pnpm install
pnpm dev
```

## Checks

```bash
pnpm check
```

That runs everything in sequence. Individually:

| Command             | Purpose                            |
| ------------------- | ---------------------------------- |
| `pnpm test`         | Run the test suite once            |
| `pnpm test:watch`   | Watch mode                         |
| `pnpm lint`         | ESLint (type-aware)                |
| `pnpm lint:fix`     | ESLint with autofix                |
| `pnpm format`       | Format with Prettier               |
| `pnpm format:check` | Verify formatting without writing  |
| `pnpm typecheck`    | `tsc --noEmit`                     |
| `pnpm build`        | Type-check, then build to `dist/`  |
| `pnpm preview`      | Serve the production build locally |

## Deployment

AniMatch is a static, client-only SPA. `pnpm build` writes `dist/`, which any
static host can serve. There is no backend, database, server runtime, or
environment variable to configure; the AniList API is called directly from the
browser.

The build uses relative asset paths (`base: "./"`), so the output also works
from a subdirectory rather than only a domain root.

## How it works

1. **Search** — `src/api/anilist.ts` queries AniList's GraphQL API, with debounced, cancellable search and an in-memory response cache.
2. **Connect** — for each of the three picks it fetches franchise relations and community recommendations, and tops the pool back up to 24 with a genre-based discovery query when those leave it short. Format and episode filters are applied while collecting, before ranking.
3. **Score** — eligible related titles become candidates, scored on relation strength plus metadata similarity (genre, theme, format, main studio, release era). A sequel or later season is only eligible when the series it follows is one of your picks.
4. **Recommend** — up to 24 candidates are ranked, with a deterministic tie-break chain so identical inputs always produce the same order. The top match is shown and the rest are available through re-roll.

Tunables — scoring weights, limits, reason caps — live in `src/recommendation/config.ts`.

## Notes

The app stores selections only in memory. It does not use accounts, a database, a backend, or an AI service. See [AGENTS.md](AGENTS.md) for the conventions this repository follows.

AniMatch is MIT licensed. Background documents live in [`docs/`](docs): the design system, the product record, and the original plan.
