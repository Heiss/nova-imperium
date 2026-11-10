# Requirements list – mockup

Mockup for issue #64, Interface v2 (#62, `src/client/static/style.css`).
Sample data; the layout and texts are proposals **[V]**.

- `before.html` / `before.png` – today: only direct requirements, one red line (real `needs()`)
- `after.html` / `after.png` – all unmet requirements including indirect ones, flat and
  deduplicated; a requirement whose next level has its own requirements met and is affordable
  is highlighted with `--orange` and gets a button „Jetzt bauen“ / „Jetzt forschen“ that starts it
  (existing actions `build` / `research`); while the queue is busy the button is disabled with
  the reason (sample: Computertechnik 2 is being researched)

The HTML files are generated from the real catalog, `reqMissing`, `lvlCost` and render helpers.
The additional CSS (`.reqs`) is inline in `after.html` and only a proposal.

The HTML files reference `/style.css`, `/fonts/` and `/icons/` absolutely: open them through a server whose root is
`src/client/static/` with the mockup files beside it, or look at the PNGs.
