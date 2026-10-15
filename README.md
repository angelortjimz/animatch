# AniMatch

A small, deterministic anime recommendation app powered by the AniList API. Pick three distinct anime and receive one SFW, discovery-first recommendation based on eligible related titles, community recommendations, and metadata similarity.

## Run locally

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

AniMatch is a pure static, client-only SPA. It has no backend, database, or
server runtime; the AniList API is called directly from the browser. It deploys
to Hostinger's Business plan through the Node.js Web App flow with GitHub
auto-deploy.

Configure the app in hPanel as follows:

| Setting          | Value   | Note                                             |
| ---------------- | ------- | ------------------------------------------------ |
| Application type | `vite`  | Detected from `package.json`                     |
| Node version     | `22`    | Set explicitly — `engines` is a range, not a pin |
| Build script     | `build` | The script name, not `pnpm build`                |
| Output directory | `dist`  | Matches the Vite default                         |
| Entry file       | (empty) | Static site, no Node server runs                 |
| Package manager  | `pnpm`  | Auto-detected from `pnpm-lock.yaml`              |
| Root directory   | `/`     |                                                  |

Merging to `main` triggers the Hostinger build. `public_html/` and `hbuilds/`
are overwritten on every redeploy, so never hand-edit the deployed files —
source changes go through GitHub.

First-deploy risks to watch:

- `engines.node` (`>=20.19.0`) is a range; Hostinger expects a concrete
  version, so set Node `22` explicitly in hPanel.
- `packageManager` (`pnpm@12.6.0`) may trip corepack if that version is
  unavailable; if the install fails, set the package manager to `pnpm`
  explicitly.
- `pnpm-workspace.yaml` sets `allowBuilds: esbuild: false`; a different pnpm
  major may not recognise the key. It builds locally today — escalate only if
  the Hostinger build fails.

## How it works

1. **Search** — `src/api/anilist.ts` queries AniList's GraphQL API, with debounced, cancellable search and an in-memory response cache.
2. **Connect** — for each of the three selections it fetches franchise relations and community recommendations.
3. **Score** — eligible related titles become candidates. Each is scored on relation strength plus metadata similarity (genre, theme, format, main studio, release era).
4. **Recommend** — the highest-scoring candidate wins, with a deterministic tie-break chain so identical inputs always produce the same answer.

Tunables — scoring weights, limits, reason caps — live in `src/recommendation/config.ts`.

## Notes

The app stores selections only in memory. It does not use accounts, a database, a backend, or an AI service. See [AGENTS.md](AGENTS.md) for the conventions this repository follows.
