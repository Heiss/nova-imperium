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
    they were read from, and only the fields that were changed. Every
    editable field keeps a stamp of its last change: the version of the
    part, who and when. It is one row per field, overwritten, so it does
    not grow with the changes. The server takes every field nobody else
    changed since `basedOn` and refuses only a field changed meanwhile,
    with its current value, who and when („von Anna um 14:03 auf 3
    geändert“). A field the editor did not touch takes the new value at
    once, with a line saying who changed it. This holds for the universe
    settings, the guild profile (tag, name, description), the name of a
    rank and each right of a rank; one save is one entry of the
    [Guild log](/features/guild-log.md).
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
  dead connections. The values are O27, several tabs O28.
* **[E]** Volumetric attacks are the operator's concern (protection in
  front of the proxy); the game and its proxies do not try to absorb them.
* **[E]** The operator documentation in `docs/operations.md` comes with the
  pull request of the events: texts for nginx, Apache and Caddy on HTTP/2,
  the event route (no buffering, timeouts, heartbeat), hardening against
  DoS (limits per address, timeouts, body size), and a full Apache
  example. The CI runs E2E tests through real proxies (O29), which also
  checks U2.
* **[E]** Cobalt27 (`@cobalt27/*`, GraphQL APIs generated from TypeScript)
  is rejected: nothing is gained over the standards. The research of
  2026-11-24 also found version 0.5.27, a Bun runtime and the license
  SSPL-1.0.
* Whether this goes to `main` or onto the v3 branch ([v3](/ops/v3.md)) is
  O30.

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
