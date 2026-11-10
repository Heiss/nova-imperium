# Explanation texts – mockup

Mockup for issue #63, Interface v2 (#62, `src/client/static/style.css`).
Sample data; all texts are proposals **[V]**.

- `always.html` / `always.png` – mode „Immer anzeigen“
- `icon.html` / `icon.png` – mode „(?)-Symbol“, the probe opened

The HTML files are generated from the real render helpers
(`costHTML`, `needs`, `artURI`) and the real formulas of `src/shared/economy.ts`.
The additional CSS (`.ex`, `button.exq`) is inline in each file and only a proposal.

The HTML files reference `/style.css`, `/fonts/` and `/icons/` absolutely: open them through a server whose root is
`src/client/static/` with the mockup files beside it, or look at the PNGs.
