---
type: log-entry
date: 2026-11-18T11:00
kind: Decision and code
issues: [229, 295, 283]
---

#229, the owner's answers of 2026-11-18 on pull request #295, built: within the first threshold (15 minutes by default) the Sternenkarte shows only „Aktiv“ instead of the [V] „Aktivität vor weniger als 15 Minuten“, after it „Aktivität vor x Minuten“ as before; „Inaktiv“ and „Lange inaktiv“ stay. In the dialog „Neue Runde“ the four thresholds stand in one fieldset with the legend „Aktivität“, the legend of their group in the registry of the round settings (#283), like the rewards; the field labels are unchanged and the a11y E2E checks the dialog with the group (see [Activity indicators](/features/activity-indicators.md), [Admin](/features/admin.md)).
