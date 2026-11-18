---
type: log-entry
date: 2026-11-17T09:40
kind: Decision and code
issues: [229, 222, 221, 175, 214, 223]
---

#229 built (part of #222) with the owner's answers of 2026-11-16 and 2026-11-17: owiki holds no event list of v0.77b („Changelog vor Redesign“ oldid=78869 says only „Aktivitätsanzeige gefixt“), so the rule is v0.76d with the change of v0.77b („Stern“ oldid=78225): a login sets activity only on the main planet (#221), any manual action in the account on all planets and moons, fleets, spying and finished buildings none. The rule is the pure module `src/core/activity.ts`, which #175 reuses for the Auspex-Bericht. The Sternenkarte shows „Aktivität vor x Minuten“ after a planet's name, „Inaktiv“ after 7 days and „Lange inaktiv“ after 28 days after the player; [V] within the first 15 minutes „Aktivität vor weniger als 15 Minuten“ without the exact minutes. The four thresholds are round values with the classic defaults, set in the dialog „Neue Runde“ and editable live in the universe settings (X1), checked as in #214. [V] A login is every new session, a manual action every game action and every interaction sample; the server sends only the markers. Migration `20261117T0923-activity-times` adds `planets.active_at` and `users.active_at`, the latter from the newest activity sample. Vacation mode (#223) is not built yet (see [Activity indicators](/features/activity-indicators.md)).
