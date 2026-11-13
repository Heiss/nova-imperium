---
type: Architecture
title: System architecture
description: Components, request flow and the clock of the game server.
tags: [architecture, server, client]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Components

| Part | Folder | Role |
|---|---|---|
| Rules | `src/core` | Catalog, costs, times, production, settling a planet to a point in time, flights, battle. Pure functions, used by server and browser. The universe settings are a parameter. |
| Store | `src/server/db` | SQLite through better-sqlite3: schema, migrations, mapping of the game objects to tables. |
| Game | `src/server/game` | Actions of the players, fleet arrivals, points, the state a player sees, admin actions. Clock, chance and ids are injected. |
| Accounts | `src/server/auth.ts` | Invitations, registration, login, sessions. |
| HTTP | `src/server/http` | JSON API under `/api`, the client files, `/healthz`, security headers, rate limit. |
| Mail | `src/server/mail.ts` | Invitation mails through nodemailer. |
| Operator command | `src/server/commands.ts` | `nova admin|unadmin|admins|invite`. |
| Client | `src/client` | `logic/` (tested functions), `views/` (HTML templates), `main.ts` (events, server calls, clock). Bundled by esbuild into `dist/public`. |

**[E]** A game rule that the server checks and the browser shows lives once,
in `src/core`, and both sides call it (owner, 2026-11-11): the shipyard
lock (`yard.ts`), the lab lock (`lab.ts`), noob protection (`protection.ts`)
and the fleet slots (`fleetSlots` in `flight.ts`). Messages stay with the
caller; the rule does not.

**[E]** The patterns for new rules, entries and views, and the migration to
them, are in [Design patterns](/architecture/patterns.md) (owner,
2026-11-12).

# Request flow

1. **[E]** Caddy receives the request from the operator's proxy, sets the
   security headers and `X-Real-IP`, forwards to `app:8080`.
2. **[V]** The server refuses cross-site posts (JSON only, `Origin` must be
   `NOVA_PUBLIC_URL`), reads the session cookie, runs the handler.
3. **[E]** An action runs in one SQLite transaction: first all fleets that are
   due (in time order), then the action. All or nothing.
4. The answer carries the new state of the player.

# The clock

* **[E]** Like version 1, a timer lands due fleets every second, also while
  nobody is online. Each fleet event is its own transaction; a broken fleet is
  logged and removed instead of stopping the clock.
* Planets are not updated by the clock: production and finished queues are
  computed when a planet is read (`settle`), as in version 1.
* **[V]** Expired sessions and rate-limit entries are removed once an hour.

# Dependencies (runtime)

* **[E]** `better-sqlite3`: SQLite. Synchronous, so a transaction is one
  function call. It brings prebuilt binaries for linux amd64 and arm64; the
  image has no compiler, and pnpm does not run its install script (the binary
  is loaded from `prebuilds/`).
* **[E]** `nodemailer`: SMTP for the invitations.
* Development only: TypeScript, Vitest, Stryker, ESLint (with sonarjs),
  Prettier, Playwright with axe, esbuild.
