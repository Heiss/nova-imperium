---
type: Specification
title: Admin
description: Admin roles, moderation, diagnostic reads, audit events and universe settings.
tags: [admin, audit, activity, moderation, settings, universe]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** Admins are made with the operator command on the server
  (`docker compose exec app nova admin <name>`), never through the web. The
  rule of version 1 (the first registered player becomes admin) is gone.
* **[E]** The universe values are set in the admin panel, not in `.env`.
* **[E]** Changes apply live. The size of the universe (galaxies, systems,
  positions) only grows: it never shrinks below a coordinate where a planet
  lies.
* **[E]** The admin starts a new round as in version 1: every player keeps the
  account and gets a fresh planet; research, fleets and reports are cleared.

# Diagnostics and moderation

* **[E]** The admin panel provides a chronological event log of account actions,
  game actions, battles and admin operations. Filters cover the actor or
  affected player, time range, action, outcome, request ID and planet or fleet
  reference. The request ID links an unexpected API failure to the server log.
* **[E]** The player record combines the timeline, daily activity and actions
  with the player's stored building, research, shipyard and fleet orders.
  Orders expose scheduled times and due status. A due record can reflect lazy
  settlement of game state. Event details link to related order references.
* **[E]** The audit log records administrative reads of invitations, player
  records, activity statistics, orders and the audit log itself. Entries
  identify the admin, the dataset, any target or filter scope, the time and
  the outcome. Operator commands are attributed to the server operator.
* **[E]** Admin writes include invitation changes, universe settings, round
  resets and moderation. Settings and operator role changes record before and
  after values. Moderation records the affected player, reason, previous and
  resulting suspension state and number of sessions revoked.
* **[E]** An admin can end a player's sessions, suspend an account for 1 to 720
  hours or indefinitely, and lift a suspension. Session revocation also
  invalidates pending email login codes. Accounts with admin rights are managed
  by the server operator. Suspensions block sign-in and API access.
* **[E]** Activity is estimated from interactions in the visible client. Only
  intervals between samples at most five minutes apart count. Automatic
  refreshes and idle tabs add no samples. The summary covers today and the
  six preceding UTC days, with a separate most-recent interaction timestamp.
* **[E]** Five rejected password checks on an account within an hour or 30 game
  action requests within a minute surface a review signal for the admin.
* **[E]** Audit events and activity data start after the update and are kept for
  30 days. Audit entries omit passwords, session and invitation tokens,
  email login codes and raw request bodies. See [SQLite storage](/data/sqlite.md).

# Settings and ranges (proposals)

| Setting | Default (version 1) | Range |
|---|---|---|
| Speed | 5 | 1 to 100 |
| Galaxies | 2 | 1 to 9, grow only |
| Systems per galaxy | 50 | 1 to 499, grow only |
| Positions per system | 15 | 12 to 20, grow only (a new planet is placed on 4 to 12) |
| Base storage per resource | 100,000 | 10,000 to 10,000,000 |
| Reports per player | 60 | 10 to 500 |
| Start metal / crystal / deuterium | 500 / 500 / 0 | 0 to 10,000,000 |

* **[V]** The ranges above are proposals; the source is
  `src/shared/universe.ts`.
* **[V]** Before new values are saved, every planet is settled to now with
  the old values, so the time before the change keeps the old speed. Running
  buildings, research, shipyard units and flights keep their end time.
* **[V]** All values are checked together and every error is shown at once;
  nothing is saved if one value is wrong.
* **[V]** Operator commands besides `admin`: `unadmin`, `admins`, `invite`.
