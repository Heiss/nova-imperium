---
type: Architecture
title: '8. Store: a repository per aggregate'
description: 'One repository per aggregate instead of a single store, the transaction of runAction as the unit of work, and the thin Store facade.'
---

# 8. Store: a repository per aggregate

* **[E]** One repository per aggregate (planet, fleet, player, guild, …)
  instead of the single `Store` class. The SQLite transaction of
  `runAction` is the unit of work. `Ctx` carries the repositories.
* **[E]** The aggregates are cut by game object (owner, 2026-11-13, #117):
  players and accounts; planets with buildings, ships, defense and queues;
  fleets; reports; guilds; invitations and admin data. The exact cut follows
  the code in the pull request.
* **[E]** Tests use SQLite in memory, no hand-written fakes.
* **[E]** Decisions after the first build attempt (owner, 2026-11-13, #117):
  * Scope: the methods of `Store` plus the aggregates of the cut that lived
    outside it, guilds (`guilds.ts`) and admin data (audit, moderation,
    settings). Achievements, push, passkeys, account security, error log,
    news and diagnostics stay raw SQL through `ctx.db`; follow-up issues
    move them.
  * `Store` becomes a thin facade: it composes the repositories and keeps
    every former method name, plus `db` and `tx`. It is used only by tests,
    `e2e/seed.ts`, `cli.ts` and `server.ts`; the store, migration and
    E2E-seed tests stay unchanged.
  * **[E]** Changed for #481, not built yet (owner, 2026-11-28): the
    wrappers of the former method names move to `src/test`; the core of
    `Store` (`repos`, `db`, `tx`) stays in production for `server.ts`,
    `cli.ts` and `game/context.ts`.
  * `Ctx` has flat fields: `players`, `planets`, `fleets`, `reports`,
    `guilds`, `invitations`, `admin`, plus `tx(fn)` and `db` for the SQL
    not moved yet.
  * Short method names per aggregate, for example `planets.get(id)`,
    `planets.home(uid)`, `planets.ofOwner(uid)`, `planets.all()`,
    `planets.save(p)`, `fleets.due(now)`.
  * The cut: players and accounts take users, user research, sessions,
    passkeys, passkey challenges and account tokens; admin data takes
    settings (universe), audit events, suspensions, player activity and
    error events; planets also take `usedSize`.
  * Tests: `ctx.store.x` is rewritten mechanically to the repositories, no
    assertion changed; the existing extra transactions stay, through
    `ctx.tx`; SQL that moves into a repository loses its own transaction to
    the caller; one test file per repository against SQLite in memory.
  * Every statement moves verbatim: the same text and parameter order, no
    rewrite, no optimisation, no new index. One exception, same text and
    parameter: `DELETE FROM guild_members WHERE user_id = ?` stood three
    times in `guilds.ts` and is now the one method `guilds.removeMember`.
* **[E]** Built with #117: `src/server/db/repos/` holds one file per
  aggregate, each a typed interface (`Players`, `Planets`, `Fleets`,
  `Reports`, `Guilds`, `Invitations`, `Admin`) and its better-sqlite3 class;
  `repositories(db)` in `index.ts` builds them on one connection, `rows.ts`
  maps rows. `createCtx(store)` spreads `store.repos` into `Ctx` with
  `db` and `tx`. No repository calls `transaction`: the `runAction`
  transaction stays the unit of work, and the other existing transactions
  (audit, activity, account security, news, push, achievements, account
  deletion, arrivals, registration) stay where they were. The game logic of
  guilds, round, audit and moderation stays in its file; only the SQL
  moved. Players and admin data hold sessions, audit and moderation SQL, so
  they are security files of the mutation standard (90 %); so are the
  invitations, whose tokens decide who may register (owner, 2026-11-13).
  Still raw
  through `ctx.db`: `achievements.ts`, `push-store.ts`, `web-push.ts`,
  `passkeys.ts`, `account-security.ts`, `error-log.ts`, `error-export.ts`,
  `news.ts`, `diagnostics.ts`, `delete-account.ts`, `game/admin.ts` (new
  round), the `UPDATE users` of `auth.ts` and the health check of
  `http/app.ts`.
