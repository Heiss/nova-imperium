---
type: Specification
title: Admin
description: Who is admin, what the admin panel does, and how universe settings change live.
tags: [admin, settings, universe]
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
