// What the journal of the round costs (#235): the rows and bytes of 1000
// actions and of 1000 arrivals of 20 players, the time with and without the
// journal, and the proof that the game ends in the same state either way (the
// characterization of the places, fleets and reports the journal must not
// change). The time is measured, not asserted tightly: a loaded machine moves it.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { journaled } from './journal.ts';

const PLAYERS = 20;
const MINUTE = 60000;

/** 20 players with a planet each; `withJournal` false closes the round and takes the plain repositories. */
function world(withJournal: boolean): TestCtx {
  const ctx = testCtx(1_000_000_000);
  for (let i = 1; i <= PLAYERS; i++) {
    addUser(ctx, `P${i}`);
    addPlanet(ctx, `u_P${i}`, {
      g: 1,
      s: i,
      p: 5,
      b: { metal: 5, crystal: 3, solar: 5 },
      res: { m: 2000, c: 1000, d: 500 },
    });
  }
  if (!withJournal) {
    ctx.db.exec("UPDATE rounds SET status = 'closed'");
    // Without the notes of the journal: the plain repositories of the store.
    ctx.planets = ctx.store.repos.planets;
    ctx.reports = ctx.store.repos.reports;
  }
  return ctx;
}

/** 1000 actions: each of the 20 players sets a share, a minute after the last one. */
function actions(ctx: TestCtx, n = 1000): void {
  for (let i = 0; i < n; i++) {
    ctx.clock.t += MINUTE;
    const who = (i % PLAYERS) + 1;
    runAction(ctx, `u_P${who}`, {
      type: 'pct',
      planet: `p1_${who}_5`,
      key: 'metal',
      v: i % 2 ? 100 : 90,
    });
  }
}

/** 1000 transports of one player to the next, all due: written, not yet processed. */
function launch(ctx: TestCtx, n = 1000): void {
  for (let i = 0; i < n; i++) {
    const from = (i % PLAYERS) + 1;
    const to = ((i + 1) % PLAYERS) + 1;
    const f: Fleet = {
      id: `f${i}`,
      owner: `u_P${from}`,
      from: `p1_${from}_5`,
      fromC: { g: 1, s: from, p: 5 },
      to: `p1_${to}_5`,
      toC: { g: 1, s: to, p: 5 },
      mission: 'transport',
      ships: { sc: 1 },
      cargo: { m: 10, c: 5, d: 1 },
      dep: ctx.now() - 2 * MINUTE,
      arr: ctx.now() - MINUTE + i,
      ret: ctx.now() + MINUTE,
      state: 'out',
      recalled: false,
      fuel: 0,
    };
    ctx.fleets.save(f);
  }
}

/** 1000 arrivals, all processed by one tick. */
function arrivals(ctx: TestCtx, n = 1000): number {
  launch(ctx, n);
  return tick(ctx);
}

const time = (fn: () => void): number => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

const dump = (ctx: TestCtx): string =>
  JSON.stringify({
    planets: ctx.planets.all(),
    fleets: ctx.fleets.all(),
    reports: Array.from({ length: PLAYERS }, (_, i) =>
      ctx.reports.ofPlayer(`u_P${i + 1}`),
    ),
    users: ctx.players.all(),
  });

const rows = (ctx: TestCtx, kind: string): { n: number; bytes: number } =>
  ctx.db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(payload)), 0) AS bytes
       FROM round_events WHERE kind = ?`,
    )
    .get(kind) as { n: number; bytes: number };

describe('the journal changes nothing in the game', () => {
  it('ends a run of actions and arrivals in the same state with and without it', () => {
    const on = world(true);
    const off = world(false);
    for (const ctx of [on, off]) {
      actions(ctx, 60);
      arrivals(ctx, 60);
      actions(ctx, 30);
    }
    expect(dump(on)).toBe(dump(off));
    expect(on.rounds.countEvents(1)).toBeGreaterThan(100);
    // The round is closed in the second: it took no event.
    expect(off.rounds.countEvents(1)).toBe(0);
    expect(journaled).toBeTypeOf('function');
  });
});

/** Appends what a measurement found to the file the report is written from, when asked for. */
const report = (name: string, result: object): void => {
  const out = process.env.JOURNAL_COST_OUT;
  if (out)
    writeFileSync(`${out}.${name}.json`, JSON.stringify(result, null, 1));
};

describe('the volume and the cost of the journal', () => {
  it('measures 1000 actions', () => {
    const on = world(true);
    const off = world(false);
    const msOn = time(() => actions(on));
    const msOff = time(() => actions(off));
    const a = rows(on, 'journal.action');
    expect(a.n).toBe(1000);
    expect(rows(on, 'participant.joined').n).toBe(PLAYERS);
    report('actions', {
      ...a,
      bytesPerRow: Math.round(a.bytes / a.n),
      msWith: Math.round(msOn),
      msWithout: Math.round(msOff),
    });
    // A few hundred bytes a row; the journal does not multiply the time.
    expect(a.bytes / a.n).toBeLessThan(400);
    expect(msOn).toBeLessThan(msOff * 10 + 2000);
  }, 30_000);

  it('measures 1000 arrivals', () => {
    const on = world(true);
    const off = world(false);
    launch(on);
    launch(off);
    let done = 0;
    const msOn = time(() => (done += tick(on)));
    const msOff = time(() => (done += tick(off)));
    expect(done).toBe(2000);
    const r = rows(on, 'journal.arrival');
    expect(r.n).toBe(1000);
    report('arrivals', {
      ...r,
      bytesPerRow: Math.round(r.bytes / r.n),
      msWith: Math.round(msOn),
      msWithout: Math.round(msOff),
    });
    expect(r.bytes / r.n).toBeLessThan(1500);
    expect(msOn).toBeLessThan(msOff * 10 + 4000);
    // A measurement of 2000 arrivals on a loaded machine: its own limit.
  }, 30_000);
});
