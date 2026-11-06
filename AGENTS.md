# Nova Imperium

Classic space strategy browser game for a group of friends: Node.js server
with SQLite, browser client, Docker Compose behind Caddy.

The decisions are an OKF bundle in `okf/`. Load only the concepts the task
needs.

- Entry point: `okf/index.md`
- Overview and legend (E = decision, V = proposal, U = unverified):
  `okf/overview.md`
- Open points: `okf/open-points.md`
- Rules of development (tests, gates, language): `okf/ops/`

Rules: do not invent anything, ask the owner about open points and offer 3 to
5 options per decision. Development is in English, the game interface is
German. A pull request goes to review only with a green CI Gate.
