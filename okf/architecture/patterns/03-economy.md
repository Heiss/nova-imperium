---
type: Architecture
title: '3. Economy: piecewise linear with generic events'
description: 'Settling of a planet as piecewise linear segments that end at generic events, with no entry named in the core.'
---

# 3. Economy: piecewise linear with generic events

* **[E]** `settle` moves time forward in segments. Inside a segment all
  rates are constant; the rates come from the `produces` and `consumes`
  components, the energy factor `f` and the shares.
* **[E]** A segment ends at the next event: a queue finishes, or a stock
  reaches its storage limit or 0. With constant rates the time of a stock
  event is `distance / net rate`, so the events are generic.
* **[E]** The only own mathematics is the throttled consumer of
  Fusionskraftwerk (#47 D1, owner 2026-11-12): the share where use equals production, a fixed point through
  `f`. It is one function with its derivation and tests.
* **[E]** Property tests (fast-check): settling in two steps equals settling
  in one (`settle(settle(p, t1), t2) = settle(p, t2)`); a stock never goes
  below 0; without consumers the order of the floating point operations is
  the one of version 1, so the equivalence tests stay unchanged.
* **[E]** The browser computes no formula of its own. Today
  `src/client/views/economy.ts` repeats the production formulas instead of
  calling `prod()`; the resources page will build its rows from the
  components.
* **[E]** Built with #114 (ProducerTable): the resources page shows the
  rows of `producerRows()` (`src/core/economy.ts`), the sums of
  `production()` and the limits of `caps()`; the shipyard and the
  buildings read `pieceEnergy()` and `useAt()`. The browser repeats no
  production formula.
* **[E]** Built with #115: no rule of `src/core/settle.ts` names a key. A
  production segment ends at the end of the building, when the shipyard
  finishes a unit with production components (a key of `PRODUCERS`, today
  the Solarsatellit), when a research finishes that a rate of an entry on
  the planet reads, and, in `accrue()`, when a use empties a stock. The
  stocks that can run empty and their consumer come from the `consumes`
  components (`STOCK_USERS` in `src/core/economy.ts`); `throttle()` gives
  the consumer at an empty stock that would fall with its throttled share,
  `balancedShare()` takes that consumer and resource (no `pct.fusion`), and
  `production()` keeps that stock at 0. The server settles the planets
  whose production a finished research changes, now or once their building
  is finished (`feelsResearch()`, `settleResearchEnd()` in
  `src/server/game/actions.ts`), before a new research replaces it. The
  equivalence tests of version 1 are unchanged and green.
* **[E]** Choices of #115 within the decisions above, confirmed by the
  owner (2026-11-14): a research changes the production when a rate of an
  entry with level or number above 0 reads its level, found automatically
  (`readsResearch()`: the rates run once on research levels that note what
  is read, a JavaScript `Proxy`; no new field in a component). A stock
  that reaches its storage limit stops inside the segment (`addUp`,
  `min(stock + change, max(stock, limit))`) and splits nothing, because no
  rate depends on a full stock and a split would change the floating point
  order of version 1. The contract test of `consumes` allows one entry
  that uses a stock (m, c, d) until a second consumer comes; how several
  consumers share an empty stock, or two stocks run empty, is then decided
  with the owner. Settling in steps equals settling in one step within the
  tolerance of #47 (1e-6 + 1e-9 relative) in every case, not only the
  throttled one: version 1 already rounds the production of two segments
  differently from one, so it is not bit-identical even without a
  consumer. The comparison with the code before #115 stays bit for bit.
