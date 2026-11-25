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
  fleet that lands, must not refuse a click on „bauen“ with 412. Whether
  documents that several people edit, and actions that depend on a value
  the player saw, get a check of their own is O31.
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
