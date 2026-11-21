---
type: log-entry
date: 2026-11-17T16:45
kind: Decision and code
issues: [190]
---

#190, the owner's „Geklärt“ of 2026-11-17 on the build: the window of score 4 keeps its width (fields ± 20 %, temperature ± 10 °C) but is shifted at random, the true value always inside it; the server draws the shift once when it makes the report and stores the report with the ends of the windows (`nearShift` and `surveyFindings` in `src/core/survey.ts`). [V] One draw per window, and the shift itself is not stored, since with the window it would tell the true value. The German texts of the build are confirmed and marked [E]; the 30 days count from the first survey and lost probes fix no values, as built. The adjectives of D5 for the rough report („gemäßigter Planet in der mittleren Bahn, vermutlich groß“) wait for the owner's thresholds (see [Surveying free positions](/features/survey.md)).
