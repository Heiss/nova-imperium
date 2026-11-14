# Level overview – mockup

Mockup for issue #187: a second icon „▤“ next to the „?“ of the explanation
texts (#63) unfolds a table with the next levels of a building or research.
Interface v2 (`src/client/static/style.css`); the extra CSS is inline in the
HTML file and only a proposal.

- `levels.html` / `levels.png` – desktop: Adamant-Tiefbohrung and
  Waffensegnung at level 3 with their tables, and the option in „Hilfe &
  Optionen“
- `levels-phone.png` – phone (390 px): the table scrolls sideways

The numbers come from the formulas of `src/core/economy.ts` (`lvlCost`,
`buildTime`, `researchTime`, `prod`) for an example planet: Sonnenkathedrale
16, Servitorenschmiede 2, Scholarium 3, speed ×5. Texts are proposals **[V]**.

The HTML file references `/style.css` and `/icons/` absolutely: serve it from a
root that holds `src/client/static/` with this folder beside it, or look at the
PNGs.
