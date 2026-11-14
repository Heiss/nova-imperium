---
type: feature
title: Push settings per kind
description: Players switch each kind of Web Push on and off in „Hilfe & Optionen“, per account for all devices (issue #192); the guild chat (#169) uses two of the kinds.
---

# Push settings per kind

Issue #192, label `ready` (owner, 2026-11-14). Before it, Web Push was only
on or off per device. Built before the guild chat (#169), which uses its
switches; both go into the next release.

# Decisions

* **[E]** Every push kind of today can be switched on and off on its own.
  The guild chat adds two kinds: guild events and guild chat messages
  (owner, 2026-11-14).
* **[E]** Defaults: every kind is on, guild chat messages included
  (owner, 2026-11-14). Existing players keep every push they got before.
* **[E]** The switches belong to the account and apply to all of its
  devices; turning push on or off per device stays as it is (owner,
  2026-11-14).
* **[E]** The pull request proposes the kinds, taken from the code, with
  their German names; the owner confirms the list before the merge (owner,
  2026-11-14).
* **[E]** The list of kinds with these German names, from every place that
  sends a push today (`queuePush` and `addReport` on `main` before #192;
  proposed in the pull request, confirmed by the owner, 2026-11-14):

  | Kind (code) | Name in the options | Sent by |
  | --- | --- | --- |
  | `buildings` | Gebäude fertig | a building order is finished (`build`, a new device) |
  | `research` | Forschung abgeschlossen | the research is finished (`research`, a new device) |
  | `shipyard` | Auftrag der Schiffsschmiede abgeschlossen | the shipyard queue is finished (`order`, a new device) |
  | `fleet` | Eigene Flotten: Ankunft, Bericht und Rückkehr | an own fleet: the report at the target (Sturmangriff, Auspex, Versorgungsflug, Landnahme, Verlegung, Bergung), „Flotte kehrt um“, the return home with or without a report |
  | `attacked` | Sturmangriff auf deine Planeten | „Feindkontakt!“, the defender's battle report |
  | `spied` | Auspex-Aktivität bei deinen Planeten | the defender's „Auspex-Aktivität“ |
  | `delivery` | Lieferung eines anderen Spielers | „Lieferung von …“, a transport of another player |
  | `announcement` | Servernachrichten | a server announcement of the admin |
  | `news` | Neue Version | the update message of a new version |
  | `guild-events` | Gildenereignisse | nothing yet; the guild chat (#169) |
  | `guild-chat` | Nachrichten im Gilden-Chat | nothing yet; the guild chat (#169) |

  Before #192 the four report kinds were one kind „messages“; the split
  follows the examples of the issue (an attack, news, a server
  announcement). The view a push opens stays as before (`fleet` for the
  return, „Nachrichten“ for every report).
* **[E]** A change saves at once on each click („Gespeichert.“), like the
  production share; no button „Speichern“ (owner, 2026-11-14).
* **[E]** The box is hidden on a server without Web Push (owner,
  2026-11-14). The browser learns it from `GET /api/account/policy`
  (`webPush`) when the page loads. The device box
  „Browser-Benachrichtigungen“ stays as it is.
* **[V]** The box „Benachrichtigungen“ sits in „Hilfe & Optionen“ above the
  device box, with one checkbox per kind in a group „Welche Meldungen per
  Push kommen“.

# Code, storage and tests

* The kinds: `PUSH_TOPICS` in `src/core/push.ts`; the names in
  `src/client/logic/push-options.ts`, which renders the checkboxes and
  reads them back.
* Storage: table `push_off` (player, kind), one row per kind that is off,
  so a new kind is on for everyone; and `push_jobs.topic`, the kind of each
  queued push. Migration 17 adds both (see [SQLite storage](/data/sqlite.md)).
  Account deletion removes the rows by the foreign key; a new round keeps
  them.
* The action `pushOptions` (`src/server/push-options.ts`) takes `off`, a
  list of known kinds, and replaces the stored list; anything else is
  refused („Ungültig.“). The state carries `me.pushOff`.
* Filter: `queuePush` stores the kind with each push; delivery
  (`web-push.ts`) drops a due push whose kind its player switched off, on
  every device. A push that is not due yet stays queued, so switching a kind
  on again before a building is finished still brings its push. A push
  without a kind (queued before the upgrade) is delivered as before.
* Tests: `src/core/push.test.ts`, `src/client/logic/push-options.test.ts`,
  `src/server/push-options.test.ts`, the filter for every kind on and off
  in `src/server/web-push.test.ts`, the kind of every sending place in the
  tests of the missions, `arrival.test.ts`, `web-push.test.ts` and
  `news.test.ts`, `src/server/db/upgrades/migration-17.test.ts`; E2E in
  `e2e/game.spec.ts` („push kinds (#192)“: hidden on the server without
  Web Push; off and on by mouse and keyboard after a reload, and on a
  phone) and `e2e/a11y.spec.ts` (the options with a kind on and off). The
  servers under test run without Web Push, which needs an HTTPS address, so
  the tests that show the box answer the policy as a server with Web Push
  would (`withWebPush` in `e2e/helpers.ts`: the real reply with `webPush:
  true`); saving goes to the real server.
