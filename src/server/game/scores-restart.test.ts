// The highscore pass over a restart of the server (#491, owner, 2026-11-28):
// the newest pass is stored in the database, so a new server context on the
// same database shows the same highscore and the same „Stand“ and makes the
// next pass at its scheduled time; live passes are stored too, a new round
// stores its own, and a pass of another round or revision is not taken.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/database.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { reset } from './admin.ts';
import { stateFor } from './state.ts';
import {
  SCORES_REVISION,
  scoreBeat,
  scorePass,
  storedScores,
} from './scores.ts';

/** A moment of 2026-11-25 in UTC; the slots are UTC (149e). */
const at = (h: number, m: number, s = 0): number =>
  Date.UTC(2026, 10, 25, h, m, s);

let dirs: string[] = [];
const opened: Db[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

/** A database in a file, so that a second connection is a restart. */
function file(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'nova-scores-'));
  dirs.push(dir);
  return path.join(dir, 'game.db');
}

/** A server context on the database in `db`, at `t`: a start of the server. */
function boot(db: string, t: number): TestCtx {
  const conn = openDatabase(db);
  opened.push(conn);
  return testCtx(t, 42, conn);
}

/** Anna with a mine, the round with `perDay` passes. */
function world(db: string, perDay: number): TestCtx {
  const ctx = boot(db, at(6, 0));
  ctx.admin.putSettings([['roundHighscorePasses', perDay]]);
  addUser(ctx, 'Anna');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, b: { metal: 10 } });
  return ctx;
}

/** More points for Anna: the next pass differs from the stored one. */
const grow = (ctx: TestCtx): void => {
  const p = ctx.planets.home('u_Anna')!;
  ctx.planets.save({ ...p, b: { ...p.b, metal: 20 } });
};

describe('the stored pass over a restart (#491)', () => {
  it('shows the same highscore and „Stand“ after a restart, and the next pass at its scheduled time', () => {
    const db = file();
    const before = world(db, 3);
    const first = storedScores(before);
    expect(first.at).toBe(at(6, 0));
    grow(before);
    // The server starts again at 06:30, before the slot of 07:05.
    const after = boot(db, at(6, 30));
    expect(storedScores(after)).toEqual(first);
    // „Stand“ and the points of the state are those of the pass before.
    const shown = stateFor(after, after.players.get('u_Anna')!) as {
      scoresAt: number;
      players: Record<string, { points: number }>;
    };
    expect(shown.scoresAt).toBe(first.at);
    expect(shown.players.u_Anna!.points).toBe(first.total.u_Anna);
    // The clock makes the next pass at its time, with the new points.
    after.clock.t = at(7, 5, 1);
    scoreBeat(after);
    const next = storedScores(after);
    expect(next.at).toBe(at(7, 5, 1));
    expect(next.total.u_Anna).toBeGreaterThan(first.total.u_Anna!);
    // And the next restart shows that one.
    expect(storedScores(boot(db, at(7, 30)))).toEqual(next);
  });

  it('makes a pass at the first reader when none is stored, and stores it', () => {
    const db = file();
    const ctx = world(db, 3);
    expect(ctx.scorePasses.get()).toBeNull();
    const pass = storedScores(ctx);
    const { at: when, ...scores } = pass;
    expect(ctx.scorePasses.get()).toEqual({
      round: expect.any(String),
      at: when,
      pass: scores,
    });
  });

  it('stores the live pass too, at most every 10 s', () => {
    const db = file();
    const before = world(db, 0);
    const first = storedScores(before);
    grow(before);
    const after = boot(db, at(6, 0, 5));
    expect(storedScores(after)).toEqual(first);
    after.clock.t = at(6, 0, 10);
    const next = storedScores(after);
    expect(next.at).toBe(at(6, 0, 10));
    expect(storedScores(boot(db, at(6, 0, 12)))).toEqual(next);
  });

  it('takes no stored pass of another revision, nor one past its time', () => {
    const db = file();
    const before = world(db, 3);
    const first = storedScores(before);
    // A writer outside the server raised the revision.
    before.admin.putSettings([[SCORES_REVISION, 1]]);
    const after = boot(db, at(6, 30));
    expect(storedScores(after).at).toBe(at(6, 30));
    expect(storedScores(after)).not.toEqual(first);
    // A restart after the slot makes the pass of now, not the old one.
    const late = world(file(), 3);
    const old = storedScores(late);
    const restarted = boot(late.store.db.name, at(8, 0));
    expect(storedScores(restarted).at).toBe(at(8, 0));
    expect(old.at).toBe(at(6, 0));
  });

  it('keeps the pass of a new round over a restart, and a new round empties the old one first', () => {
    const db = file();
    const ctx = world(db, 3);
    const boss = addUser(ctx, 'Boss', { admin: true });
    storedScores(ctx);
    ctx.clock.t = at(7, 10);
    reset(ctx, boss, {});
    const after = boot(db, at(7, 30));
    expect(storedScores(after).at).toBe(at(7, 10));
    expect(storedScores(after).total).toEqual(scorePass(after).total);
  });
});
