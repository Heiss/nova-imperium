---
type: feature
title: Error log and problem reports
description: Server errors, browser errors and problem reports of players in SQLite, the admin tab „Fehler“ and the download for analysis (issue #126).
---

# Error log and problem reports

Issue #126, milestone `next release` (owner, 2026-11-12). Unexpected server
errors so far only reach the console (Docker logs), browser errors are not
recorded. The owner wants to collect problems of the new release and hand
them to Claude for analysis.

* **[E]** In this release (owner, 2026-11-12).
* **[E]** Server errors: unexpected exceptions (HTTP 500, settling,
  arrivals, background jobs) are stored with time, request ID, action,
  player, message and stack. Expected refusals (`GameError`) are not errors.
* **[E]** Browser errors of signed-in players: JavaScript errors, unhandled
  rejections and failed API calls, with version, page and browser. At most
  20 per minute and 200 per day and player; equal errors are merged with a
  counter. Nothing is recorded on the login page (owner, 2026-11-12).
* **[E]** Problem reports: a form in „Hilfe & Optionen“ (text up to 1,000
  characters), and every error message in the game offers „Problem melden“,
  prefilled with page, version and the last request ID. At most 5 reports
  per player and hour (owner, 2026-11-12).
* **[E]** Admin: a new tab „Fehler“ lists server errors, browser errors and
  problem reports, newest first, with the paging of the event log, and a
  download button (owner, 2026-11-12).
* **[E]** Download: one ZIP built with the library `fflate`, one JSON Lines
  file per kind (errors, problem reports, audit log), time range selectable,
  default 7 days. The download is recorded in the audit log as an admin read
  (owner, 2026-11-12).
* **[E]** Kept 30 days like the audit log. The download contains player
  names; never passwords, session or invitation tokens, email login codes,
  email addresses or raw request bodies (owner, 2026-11-12).
* **[V]** Storage: one table `error_events` (kind `server`, `client`,
  `report`) with an append-only migration and an upgrade test; the client
  endpoint and its limits count as security files (mutation 90 %).
* **[V]** German labels: tab „Fehler“, button „Herunterladen“, form
  „Problem melden“ with „Was ist passiert?“ and „Absenden“, answer
  „Danke, die Meldung ist angekommen.“
