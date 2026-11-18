---
type: feature
title: Activity indicators
description: Public markers of activity per planet and of inactivity per account in the Sternenkarte, the events that set them (classic v0.76d with v0.77b) and their classic thresholds, which the admin sets per round in „Neue Runde“ and changes live in the universe settings (issue #229).
---

# Activity indicators

Issue #229, part of the Classic features (#222): public markers in the
Sternenkarte, apart from the private play time of
[Own activity and play time](/features/own-activity.md). The owner's
answers of 2026-11-16 to D1 to D3 and Q1 and of 2026-11-17 (event list,
X1, display). Sources on owiki.de: „Stern“ („Aktivität“ redirects there,
https://owiki.de/index.php?title=Stern&oldid=78225), „Changelog vor
Redesign“ (https://owiki.de/index.php?title=Changelog_vor_Redesign&oldid=78869),
„Galaxiemenü“ (https://owiki.de/index.php?title=Galaxiemen%C3%BC&oldid=77826)
and „Inaktivität“
(https://owiki.de/index.php?title=Inaktivit%C3%A4t&oldid=78925).

# Decisions

* **[E]** Level (owner, 2026-11-16, D1): activity per planet, inactivity
  per account.
* **[E]** Long inactive accounts (owner, 2026-11-16, D3): only the marker,
  no deletion. Classic deleted an account after 35 days; that is not taken
  over.
* **[E]** Thresholds (owner, 2026-11-16, Q1): the classic values are the
  default, and the admin can change them per round (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
  Values: a star for 15 minutes after an activity, then the minutes
  counting up to 59, nothing after an hour (owiki „Stern“ and
  „Galaxiemenü“: a star for 14 minutes and less, the time from 15 to 59
  minutes); inactive „i“ after 7 days and „I“ after 28 days (owiki
  „Inaktivität“; classic showed „(iI)“, the Redesign „(I)“).
* **[E]** X1 (owner, 2026-11-17): the thresholds are set in the dialog
  „Neue Runde“ and stay editable in the universe settings of the admin
  panel during the round; both write the same stored settings.

# What sets activity

* **[E]** One rule for the Sternenkarte and the Auspex-Bericht of
  [Espionage defense](/features/espionage-defense.md) (owner, 2026-11-16,
  D2, #175 Q3): `src/core/activity.ts`.
* **[E]** The rule (owner, 2026-11-17): the last pre-1.0 version, v0.77b.
  owiki holds no event list of v0.77b: the changelog of v0.77b says only
  „Aktivitätsanzeige gefixt“, and „Stern“ gives the changes of v0.76d and
  v0.77b in its section „Geschichtliches“. So the rule is v0.76d with the
  change of v0.77b:
  * A login sets activity only on the [main planet](/features/main-planet.md)
    (v0.77b: „Beim Login bekam nur noch der Hauptplanet einen Stern.“).
  * Any manual action in the account sets activity on all planets and
    moons (v0.76d).
  * Fleets (own or foreign), spying and finished buildings set no activity
    (v0.76d). The Commander event of the current owiki list falls away, as
    there is no premium.
* **[V]** A login is every new session: registration, the password, the
  login code or a passkey. Opening the game with a session that is still
  valid is no login.
* **[V]** A manual action is every game action the player sends
  (`POST /api/action`, a refused one too) and every interaction sample of
  the visible client (`POST /api/activity`, the samples of the admin's
  activity estimate, which automatic refreshes and idle tabs never send).
  Reading the state and the admin reads are not.
* **[V]** Both events also set the account's last activity, which decides
  its inactivity. An account without any recorded activity counts from its
  creation.

# Display

* **[E]** German words, not the classic signs (owner, 2026-11-17): within
  the minutes the planet shows „Aktivität vor x Minuten“ after its name;
  the player shows „Inaktiv“ after 7 days and „Lange inaktiv“ after 28
  days after the name and the rank, in brackets like the noob protection
  „(n)“. A moon shows its own activity in its row.
* **[V]** Within the first 15 minutes (the star of classic) the planet
  shows „Aktivität vor weniger als 15 Minuten“ with the round's threshold,
  without the exact minutes; one minute reads „1 Minute“.
* **[V]** The server sends only the marker (`recent` or the whole minutes,
  `inactive` or `long`), never a time, and a planet or player without a
  marker gets none.
* **[V]** The Sternenkarte is a Svelte component (#118): `galaxyPage()` in
  `src/client/logic/galaxy.ts` gives each place the words of its activity
  and of its owner's inactivity (`src/client/logic/activity.ts`), and
  `Galaxy.svelte` shows them dim and in brackets. A free position keeps
  its note, „–“ or the lock of a given-up colony (#224).
* **[V]** A planet's activity goes with the planet: a new round, a
  destroyed or given-up place starts without one. The account's last
  activity stays across rounds.
* **[V]** Vacation mode (#223) is not built yet; once it is, it needs its
  own marker apart from these.

# Settings

| Setting (label) | Stored key | Default | Range [V] | Order |
|---|---|---|---|---|
| „Aktivität ohne Minutenangabe (Minuten)“ | `roundActivityRecent` | 15 | 1 to 60 | 60 |
| „Aktivität mit Minutenangabe bis (Minuten)“ | `roundActivityMinutes` | 59 | 1 to 1,440 | 70 |
| „Inaktiv ab (Tage)“ | `roundInactiveDays` | 7 | 1 to 365 | 80 |
| „Lange inaktiv ab (Tage)“ | `roundLongInactiveDays` | 28 | 1 to 365 | 90 |

* **[V]** Each threshold is one entry of the
  [registry of the round settings](/features/admin.md#the-registry-of-the-round-settings-283)
  (#283), defined in `src/core/activity.ts` and `live`: a number field of
  the dialog „Neue Runde“ after the lock of a given-up position, and one
  of the last rows of the universe settings, under the same stored key
  (X1). `RoundRules` holds them as `activityRecent`, `activityMinutes`,
  `inactiveDays` and `longInactiveDays`; `activityLimits()` reads the
  thresholds of the rule from them.
* **[V]** The four entries are one group `activity` without a legend: the
  request „reset“ sends them as one object, without it the new round keeps
  the current thresholds, and an object that leaves one out is refused for
  it, as the reward options are.

* **[V]** The values are checked one by one, not against each other: a
  minute limit below the first threshold shows no minutes, a long-inactive
  threshold below the inactive one shows „Lange inaktiv“ first.
* **[V]** A refused value in „Neue Runde“ gets the message of the universe
  settings („<label>: ganze Zahl von <min> bis <max>.“), every wrong value
  at once.
