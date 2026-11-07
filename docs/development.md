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

## Layout

| Folder       | Content                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `src/shared` | The rules of the game, used by server and browser                              |
| `src/server` | HTTP server, SQLite store, game actions, accounts, mail, CLI                   |
| `src/client` | Browser client: `logic/` (tested), `views/` (HTML templates), `main.ts` (glue) |
| `src/test`   | Test fixtures and the frozen version 1 (`legacy/`) for the equivalence tests   |
| `e2e`        | Playwright suite against the real server                                       |
| `docker`     | Caddyfile, init and smoke scripts, the `nova` command                          |
| `okf`        | Decisions and their history (OKF bundle)                                       |

## Checks

The same checks run in the CI on every pull request; the gate job "CI Gate"
must be green before a pull request goes to review.

```bash
pnpm lint            # ESLint incl. complexity ≤ 10, cognitive ≤ 10, depth ≤ 4, functions ≤ 50 lines
pnpm format:check    # Prettier
pnpm typecheck       # tsc
pnpm test:coverage   # Vitest; blocks below 90 % lines / 85 % branches
pnpm test:mutation   # Stryker; blocks below a mutation score of 80 %
pnpm build && pnpm test:e2e   # Playwright, desktop and phone
docker compose up -d --build && docker/smoke.sh   # the stack (after docker/init-env.sh --demo)
```

Write the test first. Tests check behavior, not markup; no test is skipped or
disabled to make the CI green. Details: `okf/ops/testing.md`.
