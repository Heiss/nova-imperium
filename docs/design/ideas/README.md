# Idea studies – races and siege

Design studies for two ideas of the owner (2026-11-13), not decided. Everything
is a proposal **[V]**: names, texts, ratings and numbers are examples, not game
values. Interface v2 (`src/client/static/style.css`) plus `mock.css`.

Races (#154):

- `races-choose.html` / `.png` – choosing a race
- `races-curve.html` / `.png` – target picture of the balance over a round
- `races-report.html` / `.png` – battle report with swarm losses and reassembly
- `races-more.html` / `.png` – two more races (deception, nomads) and all five at a glance

Ground troops and siege (#155):

- `siege-status.html` / `.png` – the besieged planet, attacker and defender view
- `siege-board.html` / `.png` – the hex battlefield with planned moves
- `siege-phone.html` / `.png` – the same on a phone (390 px)
- `siege-tiles.html` / `.png` – catalog of field types (positions, one-side fields, control points, hazards)
- `siege-abilities.html` / `.png` – abilities, command points, control points, orbital strike

The HTML files reference `/style.css`, `/fonts/` and `/icons/` absolutely:
serve them from a root that holds `src/client/static/` with this folder beside
it, or look at the PNGs.
