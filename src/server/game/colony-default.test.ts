// The default of the planet limit (#237; owner, 2026-11-19): a new round
// starts with the base limit 6 (and 2 more per level), a round that runs
// without a stored value stays unlimited. The registry keeps both: `def` for
// a new round, `unstored` for the running round that has none.
import { describe, expect, it } from 'vitest';
import { colonyRules, limitFor, planetLimit } from '../../core/colony-limit.ts';
import { freshValues } from '../../core/round.ts';
import { databaseAt, migrationsThrough } from '../../test/migrations.ts';
import { MIGRATIONS } from '../db/schema.ts';
import { migrate } from '../db/database.ts';
import { Store } from '../db/store.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { adminStateOf } from './admin-state.ts';
import { reset } from './admin.ts';
import { createCtx, universe } from './context.ts';
import { runAction } from './dispatch.ts';
import { roundRules } from './round.ts';

const NOW = 1763300000000;

/** A database of before the planet limit with a running round 2 and its players, upgraded to the newest schema. */
function upgraded() {
  const db = databaseAt(
    migrationsThrough('20261120T0900-round-archive').length,
  );
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at, admin) VALUES
      ('u_Ada', 'Ada', 's', 'h', ${NOW - 50 * 86_400_000}, 3, 0, 1);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Ada', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, ${NOW}, ${NOW - 50 * 86_400_000}, 'planet');
    INSERT INTO settings (key, value) VALUES ('round', 2);
  `);
  migrate(db, MIGRATIONS);
  return createCtx(new Store(db), { now: () => NOW });
}

const colonies = (ctx: ReturnType<typeof testCtx>, over = {}) => ({
  colonies: {
    colonyBase: 6,
    colonyResearch: 0,
    colonyPerLevel: 2,
    colonyMaxLevel: 4,
    ...over,
  },
});

describe('a running round without a stored value stays unlimited', () => {
  it('reads 0 in a database upgraded with a running round, in the rules and in the universe', () => {
    const ctx = upgraded();
    expect(ctx.admin.setting('roundColonyBase')).toBeUndefined();
    expect(roundRules(ctx).colonyBase).toBe(0);
    expect(universe(ctx).roundColonyBase).toBe(0);
    const rules = colonyRules(universe(ctx));
    expect(rules).toMatchObject({ base: 0, research: false });
    expect(planetLimit(rules, 0)).toBeNull();
    expect(limitFor(rules, {})).toBeNull();
  });

  it('keeps the other values at today`s game: research off, 2 per level, highest level 4', () => {
    expect(colonyRules(universe(upgraded()))).toEqual({
      base: 0,
      research: false,
      perLevel: 2,
      maxLevel: 4,
    });
  });

  it('stays unlimited while the admin changes nothing, and a stored value is read as stored', () => {
    const ctx = upgraded();
    ctx.admin.putSettings([['roundColonyBase', 8]]);
    expect(roundRules(ctx).colonyBase).toBe(8);
    expect(universe(ctx).roundColonyBase).toBe(8);
    // A stored 0 is the admin's choice: unlimited, and it is not replaced by the default.
    ctx.admin.putSettings([['roundColonyBase', 0]]);
    expect(roundRules(ctx).colonyBase).toBe(0);
    expect(freshValues((key) => ctx.admin.setting(key))).toEqual({});
  });
});

describe('a new round starts with 6 and 2 more per level', () => {
  const start = (ctx: ReturnType<typeof testCtx>, data = {}) =>
    runAction(ctx, 'u_Ada', { type: 'reset', ...data });

  function world() {
    const ctx = testCtx();
    const ada = addUser(ctx, 'Ada', { admin: true });
    addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
    return ctx;
  }

  it('gets 6 without the field, from a running round that has no stored value', () => {
    const ctx = world();
    expect(roundRules(ctx).colonyBase).toBe(0);
    start(ctx);
    expect(ctx.admin.setting('roundColonyBase')).toBe(6);
    expect(roundRules(ctx)).toMatchObject({
      number: 2,
      colonyBase: 6,
      colonyResearch: 0,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
    expect(planetLimit(colonyRules(universe(ctx)), 0)).toBe(6);
  });

  it('records the 6 in the entry of the audit log, before 0 and after 6', () => {
    const ctx = world();
    const event = { detail: undefined as unknown };
    reset(ctx, ctx.players.get('u_Ada')!, {}, event as never);
    const { before, after } = event.detail as Record<
      'before' | 'after',
      { colonyBase: number }
    >;
    expect([before.colonyBase, after.colonyBase]).toEqual([0, 6]);
  });

  it('takes what the admin sends, 0 for unlimited included', () => {
    const ctx = world();
    start(ctx, colonies(ctx, { colonyBase: 0 }));
    expect(roundRules(ctx).colonyBase).toBe(0);
    expect(planetLimit(colonyRules(universe(ctx)), 3)).toBeNull();
  });

  it('keeps the value of the round before once a round was started: 6 stays 6, a 9 stays 9', () => {
    const ctx = world();
    start(ctx);
    start(ctx);
    expect(roundRules(ctx).colonyBase).toBe(6);
    start(ctx, colonies(ctx, { colonyBase: 9 }));
    start(ctx);
    expect(roundRules(ctx).colonyBase).toBe(9);
    expect(roundRules(ctx).number).toBe(5);
  });

  it('does not take the default where the admin changed the running round live', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundColonyBase', 12]]);
    start(ctx);
    expect(roundRules(ctx).colonyBase).toBe(12);
  });

  it('still refuses the research without a base limit, with a base of 0 sent or a 0 kept', () => {
    const ctx = world();
    const wording =
      'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.';
    expect(() =>
      start(ctx, colonies(ctx, { colonyBase: 0, colonyResearch: 1 })),
    ).toThrow(wording);
    // Nothing was stored, the round still runs.
    expect(roundRules(ctx)).toMatchObject({ number: 1, colonyBase: 0 });
    // A running round with the explicit 0 and no base sent: the group is sent whole, 0 stays 0.
    ctx.admin.putSettings([['roundColonyBase', 0]]);
    expect(() =>
      start(ctx, colonies(ctx, { colonyBase: 0, colonyResearch: 1 })),
    ).toThrow(wording);
  });

  it('accepts the research on top of the default 6 and lists the limits 6, 8, 10, 12, 14', () => {
    const ctx = world();
    start(ctx, colonies(ctx, { colonyResearch: 1 }));
    const rules = colonyRules(universe(ctx));
    expect([0, 1, 2, 3, 4].map((level) => planetLimit(rules, level))).toEqual([
      6, 8, 10, 12, 14,
    ]);
  });
});

describe('what the admin gets for the dialog „Neue Runde“', () => {
  it('names the default of a new round where the running round has no value, and nothing once one is stored', () => {
    const ctx = testCtx();
    addUser(ctx, 'Ada', { admin: true });
    const ada = ctx.players.get('u_Ada')!;
    expect(adminStateOf(ctx, ada)!.fresh).toEqual({ colonyBase: 6 });
    ctx.admin.putSettings([['roundColonyBase', 0]]);
    expect(adminStateOf(ctx, ada)!.fresh).toEqual({});
  });

  it('is nothing for a player', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    expect(adminStateOf(ctx, anna)).toBeNull();
  });
});
