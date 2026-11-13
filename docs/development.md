# Development

Node.js 22.18 or newer (the CI and the image use Node 26, see `.node-version`)
and pnpm (the version of `packageManager` in `package.json`).

```bash
pnpm install
pnpm build                      # client bundle into dist/public
NOVA_PUBLIC_URL=http://localhost:8080 pnpm start
NOVA_PUBLIC_URL=http://localhost:8080 pnpm cli invite me@example.org
```

The server runs TypeScript directly (Node type stripping); only the browser
client is bundled with Vite. The building view is a Svelte component.

Without a bundler there is no glob import, so `scripts/gen-features.ts`
writes the index of the feature folders, `src/features/index.gen.ts`, which
is not checked in. The scripts of `package.json` (`start`, `cli`, `build`,
`typecheck`, `test`, `test:coverage`, `test:mutation`, `lint:dead`,
`lint:deps`, `check`), the E2E server start and the Docker build write it
first. After a fresh clone or a new feature folder, run
`node scripts/gen-features.ts` once to bring an editor up to date.

## Layout

| Folder         | Content                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `src/core`     | The rules of the game, used by server and browser                              |
| `src/features` | One folder per catalog entry and per mission (`missions/`); index generated    |
| `src/server`   | HTTP server, SQLite store, game actions, accounts, mail, CLI                   |
| `src/client`   | Browser client: `logic/` (tested), `views/` (HTML templates), `main.ts` (glue) |
| `src/test`     | Test fixtures and the frozen version 1 (`legacy/`) for the equivalence tests   |
| `e2e`          | Playwright suite against the real server                                       |
| `docker`       | Caddyfile, init and smoke scripts, the `nova` command                          |
| `scripts`      | Release script; `planet-textures.ts` writes `src/client/static/planets/`       |
| `docs/design`  | Design draft of interface v2 with the full icon set (not used by the game)     |
| `okf`          | Decisions and their history (OKF bundle)                                       |

## Checks

The same checks run in the CI. Every push to `main` and `hotfix/**` runs all
of them; a pull request runs what its changes need: a change of
documentation only (`okf/`, `docs/`, `changes/`, `website/`, Markdown at the
top level) skips the code checks, and the Docker image, Trivy and the
Compose stack run only when one of `Dockerfile`, `.dockerignore`,
`compose*.yaml`, `docker/`, `package.json`, `pnpm-lock.yaml`,
`.node-version`, `src/server/db/`, the server start (`main.ts`, `server.ts`,
`config.ts`, `cli.ts`, `maintenance.ts` in `src/server/`) or
`.github/workflows/ci.yml` changes – game code alone does not build the
image – and always in a release pull request and in a pull request into
`hotfix/**`. The mutation tests run in a pull request only when it changes a
file Stryker mutates (the `mutate` globs of `stryker.config.json`), a test
file (`src/**/*.test.ts`, `src/test/`, `src/server/test-helpers.ts`), the
mutation configuration (`stryker.config.json`, `mutation-standard.json`,
`vitest.config.ts`, `scripts/mutation-*.ts`, `tsconfig.json`) or the
versions of `@stryker-mutator/*`, `vitest` or `typescript` in
`pnpm-lock.yaml`; `node scripts/mutation-changes.ts $(git merge-base origin/main HEAD)` tells
whether a branch does. The gate job "CI Gate" must be green before a pull request goes to
review.

```bash
pnpm lint:dead       # knip: unused files, exports, dependencies
pnpm lint:dupes      # jscpd: copied code
pnpm lint:deps       # dependency-cruiser: import rules
pnpm lint            # ESLint incl. complexity ≤ 10, cognitive ≤ 10, depth ≤ 4, functions ≤ 50 lines
pnpm format:check    # Prettier
pnpm typecheck       # svelte-check (TypeScript and Svelte)
pnpm test:coverage   # Vitest; blocks below 90 % lines / 85 % branches
pnpm test:mutation   # Stryker; blocks below a mutation score of 80 %
node scripts/mutation-gate.ts   # after Stryker: no file below its floor (--update raises the floors)
pnpm build && pnpm test:e2e   # Playwright, desktop and phone
docker compose up -d --build && docker/smoke.sh   # the stack (after docker/init-env.sh --demo)
node .github/scripts/migrations-gate.mjs origin/main   # released migrations unchanged
node scripts/changelog.ts check origin/main             # a German changelog fragment for game changes
```

A schema change is a new migration at the end of `src/server/db/schema.ts`;
a released migration is never moved, removed or changed. Update the schema
snapshot with `pnpm test src/server/db/schema.test.ts -u` and review
its diff.

A migration that changes existing tables or data needs its own test
`src/server/db/upgrades/migration-<n>.test.ts`; the property-based upgrade
test tells which ones. Reproduce a nightly failure with
`MIGRATION_SEED=<seed> pnpm test src/server/db/migrations.property.test.ts`.

Write the test first. Tests check behavior, not markup; no test is skipped or
disabled to make the CI green. Details: `okf/ops/testing.md`.

## Changelog fragments

A pull request that players can notice adds `changes/<name>.md` in German (see
`changes/README.md`); the release pull request turns the fragments into
`CHANGELOG.md`. Pull requests without a visible change carry the label
`kein-changelog`.
