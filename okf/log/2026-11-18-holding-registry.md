---
type: log-entry
date: 2026-11-18T05:00
kind: Code
issues: [55, 222, 283, 240, 224, 280]
---

#55 (part of #222) merged with main and made ready for its pull request: its two values per round are entries of the registry of #283 in `src/core/holding.ts`, `ALLIES_SETTING` („Halten erlaubt für“, `roundAllies`, order 60, „Gilde“, „Freunde“ or „Gilde und Freunde“, default both) and `HELD_SPY_SETTING` („Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“, `roundHeldSpy`, order 70, 0 to 30, default 2), both `live` (X1: set in „Neue Runde“ and changed during the round in the universe settings), with the labels, ranges, defaults and refusals of before; they stand last in the dialog and among the refusals. The hand wiring is gone from `RoundRules`, `roundRules()`, `startRoundRules()`, `UNIVERSE_SPECS`, the dialog and `src/client/main.ts`. „alles“ of #240 leaves the fuel of the holding time on the planet, a locked position of #224 keeps its own refusal beside those of holding, and `src/client/main.ts` is one line shorter, so the limit of #280 drops to 1878. The changelog fragment names both settings.
