---
type: Architecture
title: Data exchange and realtime
description: How server and browser exchange data today, the move to Server-Sent Events decided on 2026-11-25, the requirements on the reverse proxies, and what was rejected.
tags: [architecture, server, client, realtime, proxy]
status: draft
generated: { by: claude-code/web, at: 2026-11-25T09:30:00Z }
---

# Today (as built)

* The browser polls `GET /api/state` every 4 s while the tab is visible,
  when the tab comes back and 1.5 s after a countdown ran out
  (`src/client/clock.ts`). The answer is the full state of the player
  (`src/core/state.ts`), including parts of the whole universe such as
  `galaxy` and `players`.
* Every game action is `POST /api/action`; its answer carries the new
  state, a message and optional data (`src/client/logic/act.ts`).
* The browser renders only when the state changed (`apply`,
  `src/client/sync.ts`). Since #361 the views with typed fields are kept
  over a render that is not fresh (`keptMount`, `src/client/views/kept.ts`).
* Notices outside the page are Web Push only.

# Decisions (owner, 2026-11-25)

* **[E]** The requirement behind all of it: the game runs on weak hardware
  shared with other services, such as an Intel Celeron J4104, with about
  20 players today and more where others run it
  ([Overview](/overview.md)).
* Measured on 2026-11-25 (a synthetic universe of 9 planets and 4 moons
  per player, no reports, fleets or chat; SQLite in memory; a Xeon of
  2.1 GHz, not the J4104): the state of one player is 31 KB of JSON for 20
  players (4.7 KB with gzip) and 59 KB for 40 (7.7 KB); `galaxy` is over
  80 % of it. Building it takes 46 to 51 ms for 20 players and 99 ms for 40,
  three quarters of it in `pointsMap` and `categoryScores`, which compute
  the points and highscore categories of every player on every call. The
  bytes are harmless; the time of the server is the cost.
* **[E]** First, and on its own: the points and highscore categories are
  kept between calls and computed again only when they can have changed
  (owner, 2026-11-25).
* **[E]** The problems to solve, in this order: the load of the full state
  every 4 s per tab, the redraw of the client, and the delay of up to 4 s
  for the guild chat, private messages and attacks.
* **[E]** Stage 3: Server-Sent Events (`EventSource`, no library) tell the
  browser that something changed, the browser fetches with an ETag, the
  poll of 4 s becomes a slow fallback, and the client updates its state in
  place instead of mounting views anew.
* **[E]** The data travel as parts of the state (O26, owner, 2026-11-25):
  the state is cut into parts (for example planet, fleets, map, players,
  messages), each with its own version and ETag. The first load fetches
  everything without an ETag; after that an event names the parts that
  changed and the browser fetches only those, with `If-None-Match`. Not
  chosen: JSON Patch deltas of the full state (they keep the full build on
  the server and leave a gap to repair after a lost connection) and
  GraphQL per component (a schema layer and a new surface for DoS for
  little gain over parts cut along the views). **[V]** The answer of an
  action carries the parts it changed. Until the parts are built, step 4
  of the request flow in [System architecture](/architecture/system.md)
  (the answer carries the new state of the player) describes the game.
* **[E]** ETags where they help, not everywhere (owner, 2026-11-25): for
  reading the parts (`If-None-Match`, 304). A game action is a command the
  server checks against the current state in its transaction, so it
  carries no `If-Match`: a change elsewhere, such as the highscore or a
  fleet that lands, must not refuse a click on „bauen“ with 412.
* **[E]** Checks against a stale view (O31, owner, 2026-11-25):
  * Forms that several people edit send `basedOn`, the ETag of the part
    they were read from, and the fields that were changed. This holds for
    the universe settings, the guild profile (tag, name, description) and
    each rank (its name and its rights); one save is one entry of the
    [Guild log](/features/guild-log.md).
  * A save holds all or nothing: values that belong together, such as
    higher costs and lower prices, are never taken in part.
  * Any change of the part by someone else since `basedOn` refuses the
    whole save, also when it touched other fields, because a value can
    depend on another one (two admins, one raising costs while the other
    lowers prices on the old costs). The refusal names what changed, who
    and when. The safest choice first; if its UX turns out bad, a finer one
    is looked for later (owner, 2026-11-25).
  * A change by someone else that arrives while the form is open shows
    as a line such as „Anna hat Marktgebühr 5 → 3 geändert [Übernehmen]“.
    Only „Übernehmen“ moves `basedOn` on; the client never moves it by
    itself, or the check would be worthless.
  * Every editable field keeps a stamp of its last change: the version of
    the part, who and when. It is one row per field, overwritten, so it
    does not grow with the changes; it gives the „who, what, when“ of the
    line and the refusal.
  * The stamp is written in the repository method of its field, one place
    per field, with a guard test; a change by the server itself carries the
    actor „System“ [V].
  * Not chosen: sending the original values (a comparison of values that
    the normalisation of the server breaks: the profile is trimmed, the tag
    upper-cased, tag and name compared with `COLLATE NOCASE`; and no „who“
    for guilds) and a log of every change (storage that grows; the audit
    log holds before and after only for the universe settings, and the
    journal of #235 keeps texts only as their length).
  * The marketplace: the action carries the price the player saw, and the
    server refuses any worse price, with the new one (exact, no tolerance).
    Prices fall only by trades and climb back with time
    (`src/core/market.ts`), so only a trade of someone else on the same
    pair in between refuses it [U: read from the formula, a falling price
    taken as worse for the player].
  * The „alles“ buttons of the fleet form send the intent; the server
    computes the amounts from the current state.
  * Commands and intents (build, move, delete or assign a rank, …) carry no
    version.
* **[E]** HTTP/2 between the browser and the outermost proxy is a
  requirement: over HTTP/1.1 a browser opens at most 6 connections per
  host [U], which several tabs with a stream each would use up.
* **[E]** No proxy buffers the response of the event route. The app sends
  `X-Accel-Buffering: no` on it, which nginx honours [U].
* **[E]** The long connections are protected: a stream opens only with a
  valid session (401 otherwise, so nothing stays open), there is a maximum
  of streams per account and in total, a heartbeat, and the server closes
  dead connections (owner, 2026-11-25):
  * At most 5 streams per account (O27).
  * The total is an environment variable, 100 by default. It must allow at
    least 2 streams per account; when it does not, the admin panel says so
    at the invitations, that the server holds more accounts than it
    carries, with the request to raise the number. **[V]** Name
    `NOVA_EVENT_STREAMS`; it counts the accounts and the open invitations.
  * The heartbeat is an environment variable, 30 s by default. **[V]** Name
    `NOVA_EVENT_HEARTBEAT`. It must stay below the shortest idle timeout of
    the proxies in front; the operator texts say so.
  * After an error the browser connects again at the interval the server
    sends in `retry:`, not at the browser's own. The interval is an
    environment variable, by default the heartbeat. **[V]** Name
    `NOVA_EVENT_RETRY`.
  * The page shows when it has no connection. **[V]** Two states: the
    events are cut but requests still pass (the slow poll takes over), and
    the server cannot be reached at all. While the server cannot be
    reached, clicks are not sent and not kept for later: the buttons wait
    and the drafts of the forms stay (O27). Sent later, a command would act
    on a state the player no longer sees, and without a key per action a
    request whose answer was lost would run twice.
  * Several tabs (O28): a hidden tab closes its stream and opens it again
    when shown; above the limit of an account the oldest stream is closed,
    not the new one refused.
  * The operator texts give limits per address measured in the E2E run
    (requests per page load and per minute of play) times a margin (O27).
* **[E]** Volumetric attacks are the operator's concern (protection in
  front of the proxy); the game and its proxies do not try to absorb them.
* **[E]** The operator documentation in `docs/operations.md` comes with the
  pull request of the events: texts for nginx, Apache and Caddy on HTTP/2,
  the event route (no buffering, timeouts, heartbeat), hardening against
  DoS (limits per address, timeouts, body size), and a full Apache
  example. The CI runs a focused E2E spec through nginx, Apache and Caddy,
  images pinned by digest (O29): HTTP/2, an event arrives at once, the
  stream outlives the idle timeout, 401 without a session, the limits. This
  also checks U2.
* **[E]** Cobalt27 (`@cobalt27/*`, GraphQL APIs generated from TypeScript)
  is rejected: nothing is gained over the standards. The research of
  2026-11-24 also found version 0.5.27, a Bun runtime and the license
  SSPL-1.0.
* **[E]** Where each piece goes ([v3](/ops/v3.md), O30, owner,
  2026-11-25): the cached points and highscore to `main`, as a refactor;
  the events, parts, ETags and updates in place to the v3 branch with a
  switch of the admin (off: the poll only); the expected price of the
  marketplace and the intent of the „alles“ buttons to `main`, since they
  fix silent errors; the forms with `basedOn` and „Übernehmen“ (O31) and
  the [Guild log](/features/guild-log.md) to v3.

# Not pursued [V]

From the research of 2026-11-24; the owner chose stage 3 with SSE.

* WebSocket (`ws`, Socket.IO): only the direction server to browser is
  needed, since the actions stay `POST`; it would add a library, and
  `connect-src 'self'` does not cover `wss:` in every browser [U].
* Sync engines (Zero, Electric, PowerSync, Convex, InstantDB, Triplit,
  LiveStore, RxDB): none keeps better-sqlite3 as the source of truth; most
  need Postgres or move the rules into their own backend [U].
* CRDTs (Yjs, Automerge): they merge changes without a central authority,
  while the game checks every action on the server.
