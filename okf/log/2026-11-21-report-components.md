---
type: log-entry
date: 2026-11-21T12:00
kind: Code
issues: [330, 118]
---

#330, #118. The bodies of the battle, espionage and survey reports are Svelte components (`BattleReport`, `SpyReport`, `SurveyReport`, `UnitTable`, dispatched by `ReportBody`), rendered without `{@html}`. `reportBody()` of `src/client/logic/report-body.ts` and `surveyReport()` of `src/client/logic/survey.ts` shape a stored report into values; the old HTML functions are deleted. No visible change: the frozen old HTML in `src/test/report-body-reference.test.ts` is compared with the components on generated reports of every kind and on hand-built cases, including the shapes of older versions. The owner limited #330 to the report bodies (D1, 2026-11-21); the other `{@html}` pieces wait for an issue of their own. No changelog fragment.
