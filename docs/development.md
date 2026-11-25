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
writes the index of the feature folders, `src/features/index.gen.ts`, and
the index of the server parts of the missions,
`src/features/index.server.gen.ts`, which only `src/server` imports; neither
is checked in. The scripts of `package.json` (`start`, `cli`, `build`,
`typecheck`, `test`, `test:coverage`, `test:mutation`, `lint:dead`,
`lint:deps`, `check`), the E2E server start and the Docker build write them
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
image – and always in a pull request into `hotfix/**`, on a push to `main`
or `hotfix/**` (unless proven, #342) and in the nightly run. A release
pull request (head `release/*`) runs no expensive job: it changes only
`VERSION`, `CHANGELOG.md` and `changes/` and relies on the results of its
base; the release image is scanned in `release.yml` before `latest` and
`stable` move (#387). The mutation tests run in a pull request only when it changes a
file Stryker mutates (the `mutate` globs of `stryker.config.json`), a test
file (`src/**/*.test.ts`, `src/test/`, `src/server/test-helpers.ts`), the
mutation configuration (`stryker.config.json`, `mutation-standard.json`,
`mutation-floors.txt`, `vitest.config.ts`, `scripts/mutation-*.ts`, `tsconfig.json`) or the
versions of `@stryker-mutator/*`, `vitest` or `typescript` in
`pnpm-lock.yaml`; `node scripts/mutation-changes.ts $(git merge-base origin/main HEAD)` tells
whether a branch does. A pull request that is no release pull request and
goes into no hotfix branch then mutates only the files it changes and the
sources of the test files it changes and the files whose floor in
`mutation-floors.txt` it adds, changes or removes, in one job; more
than 12 such files, a change of the mutation configuration
(`mutation-standard.json` included) or the test tool chain,
a push to `main` or `hotfix/**` (unless proven) and the nightly run of
`mutation.yml` mutate everything in 6 shards; a release pull request mutates
nothing (#387). `node scripts/mutation-partial.ts
plan $(git merge-base origin/main HEAD)` prints `true` (everything) or the
list of files. The gate job "CI Gate" must be green before a pull request goes to
review.

```bash
pnpm lint:dead       # knip: unused files, exports, dependencies
pnpm lint:dupes      # jscpd: copied code
pnpm lint:deps       # dependency-cruiser: import rules
pnpm lint            # ESLint incl. complexity ≤ 10, cognitive ≤ 10, depth ≤ 4, functions ≤ 50 lines
pnpm lint:redos      # ReDoS lint: no regular expression of polynomial time (tests: exponential), cached; own CI job
pnpm format:check    # Prettier
pnpm typecheck       # svelte-check (TypeScript and Svelte)
pnpm test:coverage   # Vitest; blocks below 90 % lines / 85 % branches
pnpm test:mutation   # Stryker; blocks below a mutation score of 80 %
node scripts/mutation-gate.ts   # after Stryker: no file below its floor
node scripts/mutation-floors.ts reports/ci/mutation.json   # the floors from the merged report of a complete CI run (gh run download <run-id> -n mutation-report; --log <gate.log> reads the log of its gate step instead)
pnpm lint:size       # src/client/main.ts has no more lines than on its base (merge base with origin/main)
pnpm build && pnpm test:e2e   # Playwright, desktop and phone
docker compose up -d --build && docker/smoke.sh   # the stack (after docker/init-env.sh --demo)
pnpm check:migrations   # no migration of origin/main changed (part of pnpm check)
node scripts/changelog.ts check origin/main             # a German changelog fragment for game changes
node scripts/okf-log.ts check                           # every entry of the update log in okf/log/ well-formed
```

How to add a migration:

1. `pnpm new-migration <issue> <short-name> --create` prints the ID (the
   current UTC minute and the name, for example
   `20261116T1405-fleet-cargo`) and creates
   `src/server/db/migrations/<issue>/migrations.ts`. Without `--create` it
   only prints the ID; a second migration of the same issue goes into the
   list of that file.
2. Write the SQL into the file. The folder is read when the server starts;
   the migrations run in the order of their IDs, whatever folder they are
   in, so neither the place nor another pull request matters.
3. Fill in its upgrade test `src/server/db/upgrades/<id>.test.ts`, which
   `--create` writes too: it imports the migration file, runs the migration
   on data of the version before and fails with a TODO until you write the
   data and check what the migration does to it. Every migration of an
   issue needs this test (owner, 2026-11-16); `pnpm check` fails without it
   or when it does not import its migration file statically.

A migration on `main` is never removed or changed and keeps its ID;
`pnpm check` compares with your local `origin/main` and fails on such a
change. A new ID must sort after the newest migration of the last release;
the script refuses it otherwise. A hotfix brings no migration; schema
changes go through `main` and a normal release.
Update the schema
snapshot with `pnpm test src/server/db/schema.test.ts -u` and review
its diff.

Every new migration has its own test
`src/server/db/upgrades/<id>.test.ts` (the migrations before the IDs have
`migration-<n>.test.ts` where they change existing tables or data);
`migrationsThrough(id)` of `src/test/migrations.ts` gives the migrations up
to it. The property-based upgrade test runs every migration on generated
data. Reproduce a nightly failure with
`MIGRATION_SEED=<seed> pnpm test src/server/db/migrations.property.test.ts`.

Write the test first. Tests check behavior, not markup; no test is skipped or
disabled to make the CI green. Details: `okf/ops/testing.md`.

## Changelog fragments

A pull request that players can notice adds `changes/<name>.md` in German (see
`changes/README.md`); the release pull request turns the fragments into
`CHANGELOG.md`. Pull requests without a visible change carry the label
`kein-changelog`.
