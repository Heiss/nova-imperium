# Phone study – less load on 390 px

Study for issue #189 (a lighter phone view). Everything is a proposal **[V]**;
numbers are examples.

- `mobile-before.png` – the game today on a 390 px phone (`main`, a fresh
  account): Übersicht, Gebäude, Rohstoffe, Sternenkarte
- `mobile-home.html` / `.png` – Übersicht as „what is running, what needs me“
- `mobile-build.html` / `.png` – one „Bauen“ tab with Gebäude, Forschung,
  Werft, Abwehr; compact rows, details on tap, filter „Baubar“
- `mobile-map.html` / `.png` – Sternenkarte as rows with planet pictures,
  actions in a bottom sheet
- `mobile-after.png` – the three proposals side by side

Interface v2 (`src/client/static/style.css`) plus `mobile.css`. The HTML
files reference `/style.css`, `/icons/` and `/planets/` absolutely: serve them
from a root that holds `src/client/static/` with this folder beside it, or look
at the PNGs.
