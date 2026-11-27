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
- Release loop for `/loop`: `.claude/loop.md` (`okf/ops/loop.md`)
- Update log: one new file per entry, `okf/log/<date>-<short-name>.md`
  (`okf/ops/website.md`)

Rules: do not invent anything. Take a recommendation that is consistent with
the owner's earlier decisions as [V]; ask with 3 to 5 options only when
unsure (`okf/ops/loop.md`). Development is in English, the game interface is
German. A pull request goes to review only with a green CI Gate.
Every feature outside the core gets an on/off switch per round
(`okf/ops/feature-switches.md`).
