# Update log

## 2026-11-12

* **Feature**: Ionentechnik, Plasmatechnik, Gravitonforschung and the Intergalaktisches Forschungsnetzwerk (#49): research starts and is paid on any own planet with a Forschungslabor, IFN adds the highest other labs that meet the lab requirement, Gravitonforschung needs 300,000 · 3^(level − 1) energy production; migration 10 stores the starting planet; the requirements list works on the shown planet (see [Research](/features/research-ion-plasma-graviton.md)).
* **Decision**: Milestone `next release` = #46, #47, #49, #50. #49 clarified: Ionentechnik, Plasmatechnik and Gravitonforschung with the classic values; Gravitonforschung checks 300,000 energy production (classic); IFN classic with research on any planet with a lab (decided again the same day); Expeditionstechnik moves to a new issue for expeditions (see [Research](/features/research-ion-plasma-graviton.md)).
* **Feature**: Security hotfix: Trivy scans `stable` every hour; a High or Critical hole with a fix becomes `hotfix/sec-<id>` from the release tag and releases itself when the CI Gate is green; the base image is pinned to its digest (see [Branching and release](/ops/branching-release.md)).
* **Feature**: Release loop: `.claude/loop.md` for a bare `/loop` - plan the release with the owner (infrastructure first), clarify, build, make the release pull request ready, stop (see [Release loop](/ops/loop.md)).
* **Update**: Release candidate images `<version>-rc.<N>` and `next` for every green release pull request; releases are also tagged `stable`, `latest` stays the newest release (see [Branching and release](/ops/branching-release.md)).

* **Update**: `CHANGELOG.md` holds the player-visible changes of the releases 26.11.0 to 26.11.18, filled in once from their pull requests (see [Changelog in the game](/features/changelog.md)).
* **Feature**: „Neuigkeiten“ in the game: the page from `CHANGELOG.md`, the dot on the menu item and one message per new version with the first three entries; `CHANGELOG.md` and `VERSION` are part of the image (see [Changelog in the game](/features/changelog.md)).
* **Update**: Releases only through the release pull request: every player-visible pull request brings a German fragment in `changes/`, the release pull request bundles them into `CHANGELOG.md` and `VERSION` and runs every check, its merge tags the release; hotfixes from `hotfix/*`; the Docker and Compose checks run on pull requests only when the image can change (see [Branching and release](/ops/branching-release.md), [Changelog in the game](/features/changelog.md)).

## 2026-11-11
* **Update**: Maintenance mode (issue #80): 503 „Wartung“ while a migration runs, after a refused migration (no exit, no restart loop) and with `nova maintenance on`; Caddy shows a maintenance page when the game does not answer; the client shows a banner (see [SQLite storage](/data/sqlite.md)).
* **Update**: Mutation standard per file: no file below its recorded floor, new files 80 %, new security files 90 %; security files aim for 90 %. Pushes to `main` run Stryker incrementally, the nightly run stays complete (see [Test strategy](/ops/testing.md)).
* **Update**: Workflow lint (actionlint, zizmor) in the CI Gate; all actions pinned to commit hashes, checkouts without persisted credentials (see [Test strategy](/ops/testing.md)).
* **Update**: Migrations fail closed: the backup is checked before a migration, without a good backup the server does not start; tested with real data per version, as a process and as a Docker upgrade from the last release (see [SQLite storage](/data/sqlite.md)).
* **Update**: CodeRabbit reviews pull requests (`.coderabbit.yaml`); security and „Critical“ findings block a merge under O4 (see [Branching and release](/ops/branching-release.md)).
* **Update**: knip, jscpd and dependency-cruiser block in CI; 27 unused exports and `@types/markdown-it` removed, one copied block in `src/server/http/app.ts` replaced by the types `Guard` and `Enter` (see [Test strategy](/ops/testing.md)).
* **Update**: Lab lock, noob protection and fleet slots live once in `src/shared` (`lab.ts`, `protection.ts`, `fleetSlots`), used by the server and the browser; no change of behaviour (see [System architecture](/architecture/system.md)).
* **Update**: Nanitenfabrik (issue #48): halves building and shipyard times per level, locks the shipyard like the Werft; the lock rules moved to `src/shared/yard.ts` (see [Nanitenfabrik](/features/nanite-factory.md)).
* **Update**: CodeQL runs for documentation-only pull requests too; without its result the ruleset of `main` blocked their merge (#65).

## 2026-11-10
* **Update**: Property-based upgrade tests of every migration on generated data (fast-check), nightly with a random seed; changing migrations need their own upgrade test (see [SQLite](/data/sqlite.md)).
* **Update**: Requirements list with indirect requirements, startable ones in `--ready` with „Jetzt bauen“/„Jetzt forschen“ (issue #64, see [Requirements list](/features/requirements.md)).
* **Decision**: O4 – the assistant merges its pull requests after a green CI Gate.
* **Decision**: every pull request brings E2E tests for its acceptance criteria (see [Test strategy](/ops/testing.md)).
* **Update**: Interface v2 with the Nova Imperium icon set, phone tab bar with „Mehr“ sheet, animated planets per type with a switch „Animationen“ (issue #61, see [Interface](/features/interface.md)).
* **Update**: Planet type by slot and system parity, look only (issue #52).
* **Update**: The server backs up the database before migrations (`nova.sqlite.v<version>.bak`, newest three kept; see [SQLite](/data/sqlite.md)).
* **Update**: CI job "Migrations append-only" in the CI Gate: released migrations must not be moved, removed or changed; schema snapshot test (`src/server/db/schema.snapshot.sql`). Modelled after Flyway, sqlx, Atlas and GitLab ([SQLite storage](/data/sqlite.md)). Owner enabled up-to-date branches for `main` (O9).

## 2026-11-06
* **Update**: Version 2 of the game published unchanged on the session branch (owner's request).
* **Update**: Rules of the muffelblog bundle adopted; four rounds of decisions with the owner (see [History](/history.md)).
* **Update**: Port to TypeScript: rules (`src/shared`), server (`src/server`), client (`src/client`); the rules, the catalog and all 32 pictures are tested against the frozen version 1 to the last digit.
* **Update**: SQLite with better-sqlite3, normalized schema, versioned migrations, one transaction per action and fleet event.
* **Update**: Registration only by invitation (mail through nodemailer or copied link, single use, 7 days, hashed tokens in the URL fragment); admins only by the operator command `nova`; admin panel with live universe settings (size grows only) and invitations.
* **Update**: Configuration through `.env`, secrets through files (`NAME_FILE`, Compose secrets), fail closed.
* **Update**: Docker image (Node 26, non-root, no compiler or package manager), `compose.yaml` with Caddy (strict CSP), `compose.demo.yaml` with Mailpit, `docker/init-env.sh`, `docker/smoke.sh`.
* **Update**: CI like muffelblog: lint with complexity gates, format, types, unit tests with coverage gate, Stryker (80 %), Playwright E2E with CSP and axe checks, image and Compose stack with smoke test and Trivy, gitleaks, `pnpm audit`, CodeQL; one gate job. Nightly mutation run, release workflow with CalVer and GHCR, Renovate.
* **Fix** (found while porting): opening an invitation link in a tab that is already open did nothing (only the hash changes); a cookie part with a leading space gave an empty name; a too large request closed the connection instead of answering 400.
* **Update**: Level at the introduction: 190 unit tests, 99.5 % lines and 95.4 % branches covered, mutation score 92.6 %, 11 E2E tests.
* **Docs**: README, getting started, configuration, operations, development; this bundle.
