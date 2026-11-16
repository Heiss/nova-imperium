# Idea studies

Design studies for ideas of the owner, not decided. Everything is a proposal
**[V]**: names, texts, ratings and numbers are examples, not game values.
Interface v2 (`src/client/static/style.css`) plus `mock.css`.

The empire overview (#TBD):

- `empire-overview-levels.html` / `.png` – the view on each research level side by side: names and links, then resources, then build queues, then (proposal) combined build processes
- `empire-overview-full.html` / `.png` – the full view on the highest level for a player with 12 worlds, desktop, with the new menu entry
- `empire-overview-phone.html` / `.png` – the same on a phone (390 px)
- `empire-overview-research.html` / `.png` – the research entry: levels, four variants for „only with many colonies“, three readings of „combine build processes“ and the relation to the research network (`ifn`)
- `empire-overview-issue.md` – the issue text

The HTML files reference `/style.css`, `/fonts/`, `/icons/` and `/planets/` absolutely:
serve them from a root that holds `src/client/static/` with this folder beside
it, or look at the PNGs.
