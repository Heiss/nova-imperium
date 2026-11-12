---
type: feature
title: Changelog in the game
description: „Neuigkeiten“ for players from CHANGELOG.md, the update message after a release and the hint on unread news.
---

# Changelog in the game

Issue #81. Decisions of the owner on 2026-11-12. The texts come from the
release flow ([Branching and release](/ops/branching-release.md)): one German
fragment per pull request, bundled into `CHANGELOG.md` by the release pull
request and baked into the image with it.

* **[E]** Source: `CHANGELOG.md` of the released commit, German, for players;
  a section per version („## Version 26.11.19 – 12.11.2026“) with „Neu“,
  „Geändert“, „Behoben“.
* **[E]** Claude writes the texts in German and checks that they match the
  pull request; the release pull request checks them again.
* **[E]** Players see the version number with the date („Version 26.11.19 –
  12.11.2026“).
* **[E]** After an update, every player gets one message per rolled-out
  version: a hint plus the first three entries of the versions since the
  one that ran before, with a link to „Neuigkeiten“; an update without
  entries sends none. The server knows the version that ran before, so a jump
  from an older release shows everything in between.
* **[E]** A dot on the menu item „Neuigkeiten“ until it is opened, stored per
  device in the browser (no migration).
* **[V]** Order of the entries and „first three“: new before changed before
  fixed, within a kind by file name (`scripts/changelog.ts`).
* **[E]** The image contains `CHANGELOG.md` and `VERSION` of the released
  commit; there is no build argument (owner, 2026-11-12). Without `VERSION`
  (development) the server sends no update message.
* **[E]** The first start with this feature (no version stored yet) sends
  the players the entries of the running version only; a new world has no
  players to tell (owner, 2026-11-12, replacing „only remember“ of the same
  day).
* **[V]** The server keeps the highest version that ever ran in the
  `settings` table (key `version`, YY·100000 + M·1000 + MICRO). After a
  rollback and the way forward again, the message is not sent twice.
* **[V]** The server reads `CHANGELOG.md` once at the start and serves the
  sections as data (`GET /api/news`, logged-in players); the browser renders
  them escaped, no Markdown in the browser. Chosen by Claude, the owner had
  no preference (2026-11-12).
* **[V]** The menu item „Neuigkeiten“ stands right before „Hilfe & Optionen“;
  on a phone it is under „Mehr“. The dot is the menu badge with the text
  „Neu in Version …“; opening the page stores the newest version in the
  browser (`nova.news.seen`). Chosen by Claude, the owner had no preference.
* **[V]** The update message is a normal message („Neu in Version …“) with
  the hint, the first three entries, the number of further ones and a link
  to „Neuigkeiten“; it also goes out as push notification like every
  message.

Built in `src/server/news.ts`, `src/client/logic/news.ts`, the view `news`
and the Dockerfile.
