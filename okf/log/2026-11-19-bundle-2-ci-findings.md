---
type: log-entry
date: 2026-11-19T13:00
kind: Decision and code
issues: [316, 227, 313, 190, 223, 189, 78, 285, 175]
---

The first full CI run of the second Classic bundle (#316) found three things, and main moved on (the buddy list of #227, the CI scripts of #313), so the branch merged main again. The conflicts were the registry of the repositories (`surveys` of #190 and `friends` of #227 both stay), its test, and the floors of `mutation-standard.json` (every floor of both sides, the higher one where both changed; none below main's). `size-ratchet.json` equals the real length of `src/client/main.ts` after the merge, 1804 lines (main's limit was 1822). The buddy list and the vacation mode (#223) now have tests of their own: a player in vacation mode can send, accept, refuse, withdraw or end no friend request (the four friend actions are not on the allow list, so they are refused like every other action and change no link), the lock screen holds nothing of the view „Freunde“, others can still ask him and he sees the request after the end, and a friend in vacation mode shows offline after the threshold, because his account records no activity.

CodeQL (high, „Incomplete multi-character sanitization“) flagged the test helper `plain()` of `src/client/logic/survey.test.ts` (#190), which took tags out with a regular expression. It now reads the text of the HTML with the Svelte parser (`svelte/compiler`, as `src/test/naming.test.ts` and `src/test/catalog-keys.test.ts` read markup; the unit tests have no DOM), joins the cells of a row by „: “ and closes each row with „ | “ as before; no expectation changed. No other test of the bundle strips tags with a regular expression.

The E2E tests of `e2e/phone-overflow.spec.ts` (#189) report „highscore: 373 px > 360 px“ on the CI run and pass on every local run of the same specs, also with fallback fonts only, with 110 players and with huge points. The cause is not found; the check now names the three elements that reach furthest, so the next CI log shows it. **[U]** Whether the row of the five category buttons of the highscore (#78) is the cause.

The E2E test of the Lexicanum (#285) found two links to the Spähschädel in the article of the Auspex-Lehre: the introduction links the Auspex-Erkundung and the Spähschädel, and the new paragraph of the Auspex-Abwehr (#175) linked both again. No other article links an entry twice, so **[V]** the paragraph names both as plain words; only the link changed, the words shown are the same (before: „bei jeder [[mission-spy]] … Mehr [[probe]] und mehr Schiffe“, after: „bei jeder Auspex-Erkundung … Mehr Spähschädel und mehr Schiffe“).
