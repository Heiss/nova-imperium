# Update log

## 2026-11-10
* **Update**: Requirements list with indirect requirements, startable ones in `--ready` with „Jetzt bauen“/„Jetzt forschen“ (issue #64, see [Requirements list](/features/requirements.md)).
* **Decision**: O4 – the assistant merges its pull requests after a green CI Gate.
* **Decision**: every pull request brings E2E tests for its acceptance criteria (see [Test strategy](/ops/testing.md)).
* **Update**: Interface v2 with the Nova Imperium icon set, phone tab bar with „Mehr“ sheet, animated planets per type with a switch „Animationen“ (issue #61, see [Interface](/features/interface.md)).
* **Update**: Planet type by slot and system parity, look only (issue #52).
* **Update**: The server backs up the database before migrations (`nova.sqlite.v<version>.bak`, newest three kept; see [SQLite](/data/sqlite.md)).

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
