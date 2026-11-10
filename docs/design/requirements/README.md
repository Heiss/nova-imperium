# Requirements list – mockup

Mockup for issue #64, current design (`src/client/static/style.css`).
Sample data; the layout and texts are proposals **[V]**.

- `before.html` / `before.png` – today: only direct requirements, one red line (real `needs()`)
- `after.html` / `after.png` – all unmet requirements including indirect ones, flat and
  deduplicated; a requirement whose next level has its own requirements met and is affordable
  is highlighted with `--orange` and „jetzt möglich“

The HTML files are generated from the real catalog, `reqMissing`, `lvlCost` and render helpers.
The additional CSS (`.reqs`) is inline in `after.html` and only a proposal.
