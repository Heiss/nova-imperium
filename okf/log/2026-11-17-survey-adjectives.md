---
type: log-entry
date: 2026-11-17T17:00
kind: Decision and code
issues: [190, 51]
---

#190, the owner's „Geklärt“ of 2026-11-17 on the adjectives of the rough report (D5): the classic position bands, 1–3 „innere Bahn“ and „heiß“, 4–12 „mittlere Bahn“ and „gemäßigt“, 13–15 „äußere Bahn“ and „kalt“, and the size „klein“, „mittelgroß“ or „groß“ by thirds of the field range 96–252 (#51), marked „vermutlich“. The rough report now reads, for example, „Gemäßigter Planet in der mittleren Bahn, vermutlich mittelgroß.“ (`orbitOf` and `sizeOf` in `src/core/survey.ts`, worded in `src/client/logic/survey.ts`). [V] With more than 15 positions the bands are scaled proportionally (a fifth inner, three fifths middle, a fifth outer); the size is guessed from the average fields of the position; each third holds its lower end (see [Surveying free positions](/features/survey.md)).
