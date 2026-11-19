---
type: log-entry
date: 2026-11-18T10:00
kind: Code
issues: [202, 222, 283, 242, 230, 53, 214]
---

#202 (part of #222) brought up to date with main for its pull request. Its two values per round, „Rückbau-Erstattung (%)“ and „Rückbau-Dauer (% der Bauzeit)“, are now two entries of the registry of #283 in `src/core/demolition.ts` (`DEMOLITION_REFUND_SETTING`, order 180, and `DEMOLITION_TIME_SETTING`, order 190, both `live` for X1: a field of the dialog „Neue Runde“ and a row of the universe settings); the hand-wired fields of the dialog, the client's own reset choice, the setting checks of the demolition and its part of `roundRules()` are gone, and `RoundRules` carries `demolitionRefund` and `demolitionTime`. Labels, ranges, defaults and the range wording of the refusal are unchanged. [E] The two entries are one group `demolition` with the legend „Rückbau“ (owner, 2026-11-18), so the request still sends one object, both values are sent together and a wrong value refuses both, as before; the dialog shows them in one fieldset. The mark of a finished order moved from `src/client/main.ts` into `src/client/logic/demolition.ts`, so the size ratchet of #242 sinks to 1,840 lines. The rule „not on a moon“ is the kind of the place, so it holds for the Warp-Tor of #230 and every other building of a moon (#53); tests go over all of them. The check stays the pure `demolitionErrors` with codes worded by the server (#214).
