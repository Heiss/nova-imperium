// The recognition of incoming fleets (#228, okf/features/espionage-defense.md):
// what a player sees of a foreign fleet follows the player's settled
// Auspex-Lehre and the thresholds of the round (classic 2 / 4 / 8, D1), for
// every foreign fleet (D2); the admin sets them in „Neue Runde“ and changes
// them in the universe settings during the round (X1). Hidden parts never
// leave the server.
import { describe, expect, it } from 'vitest';
import {
  RECOGNITION_DEFAULT,
  type Recognition,
  recognitionOf,
} from '../../core/fleet-recognition.ts';
import type { Fleet } from '../../core/types.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { attackEvent } from './guild-events.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

const SHIPS = { lf: 5, sc: 2, hf: 0 };

const fleet = (over: Partial<Fleet>): Fleet => ({
  id: 'f1',
  owner: 'u_Vex',
  from: 'p1_9_9',
  fromC: { g: 1, s: 9, p: 9 },
  to: 'p1_1_5',
  toC: { g: 1, s: 1, p: 5 },
  mission: 'attack',
  ships: SHIPS,
  cargo: { m: 7, c: 0, d: 0 },
  dep: 0,
  arr: 9e12,
  ret: 9e12,
  state: 'out',
  recalled: false,
  fuel: 0,
  ...over,
});

/** Anna (admin) on 1:1:5 with the given Auspex-Lehre, attacked by Vex. */
function world(spy = 0, over: Partial<Fleet> = {}): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { admin: true, research: { spy } });
  addUser(ctx, 'Vex', { research: { spy: 20 } });
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  addPlanet(ctx, 'u_Vex', { g: 1, s: 9, p: 9 });
  ctx.fleets.save(fleet(over));
  return ctx;
}

type Seen = Record<string, unknown>;
const seenBy = (ctx: TestCtx, uid = 'u_Anna'): Seen[] =>
  (stateFor(ctx, ctx.players.get(uid)!) as { fleets: Seen[] }).fleets;

/** What the API answers about the fleets: the state as JSON. */
const answer = (ctx: TestCtx): string =>
  JSON.stringify(
    (stateFor(ctx, ctx.players.get('u_Anna')!) as { fleets: unknown }).fleets,
  );

const BASE = {
  id: 'f1',
  owner: 'u_Vex',
  fromC: { g: 1, s: 9, p: 9 },
  toC: { g: 1, s: 1, p: 5 },
  to: 'p1_1_5',
  mission: 'attack',
  state: 'out',
  arr: 9e12,
};

describe('a foreign fleet seen by the defender (#228)', () => {
  it('shows below, at and above 2, 4 and 8 only the permitted fields', () => {
    const cases: [number, Seen][] = [
      [0, {}],
      [1, {}],
      [2, { total: 7 }],
      [3, { total: 7 }],
      [4, { total: 7, types: ['lf', 'sc'] }],
      [7, { total: 7, types: ['lf', 'sc'] }],
      [8, { total: 7, types: ['lf', 'sc'], ships: { lf: 5, sc: 2 } }],
      [9, { total: 7, types: ['lf', 'sc'], ships: { lf: 5, sc: 2 } }],
    ];
    for (const [spy, parts] of cases)
      expect(seenBy(world(spy)), `level ${spy}`).toEqual([
        { ...BASE, ...parts },
      ]);
  });

  it('keeps hidden details out of the answer of the API', () => {
    const json = (spy: number) => answer(world(spy));
    // Below 2 nothing about the ships, not even an empty list.
    for (const key of ['"ships"', '"total"', '"types"', '"lf"', '"sc"'])
      expect(json(1), key).not.toContain(key);
    expect(json(3)).not.toMatch(/"types"|"lf"|"ships"/);
    expect(json(7)).not.toMatch(/"ships"|"lf":5/);
    // Never the cargo, the start planet or the return of a foreign fleet.
    for (const key of ['"cargo"', '"from"', '"ret"', '"fuel"'])
      expect(json(9), key).not.toContain(key);
  });

  it('reads the settled research: a level finished now counts', () => {
    const ctx = world(1);
    const anna = ctx.players.get('u_Anna')!;
    anna.rq = {
      key: 'spy',
      lvl: 2,
      start: 0,
      end: ctx.now(),
      cost: [0, 0, 0],
    };
    ctx.players.save(anna);
    expect(seenBy(ctx)[0]).toMatchObject({ total: 7 });
    anna.rq = { ...anna.rq, end: ctx.now() + 1 };
    ctx.players.save(anna);
    expect(seenBy(ctx)[0]).not.toHaveProperty('total');
  });

  it('applies to every foreign fleet, not only to attacks (D2)', () => {
    for (const mission of ['transport', 'spy', 'deploy'] as const) {
      expect(seenBy(world(0, { mission }))[0], mission).toEqual({
        ...BASE,
        mission,
      });
      expect(seenBy(world(8, { mission }))[0], mission).toMatchObject({
        total: 7,
        ships: { lf: 5, sc: 2 },
      });
    }
  });

  it('treats each fleet of a group attack the same way', () => {
    const ctx = world(4);
    addUser(ctx, 'Kain', { research: { spy: 20 } });
    ctx.fleets.save(fleet({ id: 'f2', owner: 'u_Kain', ships: { bs: 3 } }));
    expect(seenBy(ctx).map((f) => [f.id, f.total, f.types, f.ships])).toEqual([
      ['f1', 7, ['lf', 'sc'], undefined],
      ['f2', 3, ['bs'], undefined],
    ]);
  });

  it('shows own fleets in full, whatever the own level', () => {
    const ctx = world(20);
    const own = ctx.fleets.get('f1')!;
    expect(seenBy(ctx, 'u_Vex')).toEqual([own]);
    ctx.players.save({ ...ctx.players.get('u_Vex')!, research: {} });
    expect(seenBy(ctx, 'u_Vex')).toEqual([own]);
  });

  it('gives the guild of the defender no ships with the attack event', () => {
    const ctx = world(0);
    runAction(ctx, 'u_Anna', { type: 'createGuild', name: 'Wacht', tag: 'WA' });
    attackEvent(ctx, ctx.fleets.get('f1')!, 'u_Anna');
    const rows = JSON.stringify(
      ctx.db.prepare('SELECT * FROM guild_chat').all(),
    );
    expect(rows).toContain('[1:1:5]');
    expect(rows).not.toMatch(/"lf"|Abfangjäger|Frachtläufer|ships/);
  });
});

describe('the thresholds per round (#228, D1, X1)', () => {
  const levels = (ctx: TestCtx): Recognition => recognitionOf(roundRules(ctx));
  /** The thresholds as the dialog „Neue Runde“ sends them: one object. */
  const sent = (total: unknown, types: unknown, counts: unknown) => ({
    recognitionTotal: total,
    recognitionTypes: types,
    recognitionCounts: counts,
  });

  it('are the classic 2 / 4 / 8 in an existing universe', () => {
    expect(levels(world())).toEqual(RECOGNITION_DEFAULT);
    expect(roundRules(world())).toMatchObject(sent(2, 4, 8));
  });

  it('are set in „Neue Runde“, kept without a choice and in the audit entry', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    const recognition = sent(1, 3, 5);
    runAction(ctx, 'u_Anna', { type: 'reset', recognition }, event);
    expect(levels(ctx)).toEqual({ total: 1, types: 3, counts: 5 });
    expect(event.detail).toMatchObject({
      before: sent(2, 4, 8),
      after: recognition,
    });
    expect(ctx.admin.universe()).toMatchObject({
      roundRecognitionTotal: 1,
      roundRecognitionTypes: 3,
      roundRecognitionCounts: 5,
    });
    runAction(ctx, 'u_Anna', { type: 'reset', recognition: sent(1, 6, 5) });
    expect(levels(ctx)).toEqual({ total: 1, types: 6, counts: 5 });
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(levels(ctx)).toEqual({ total: 1, types: 6, counts: 5 });
    expect(roundRules(ctx).number).toBe(4);
  });

  it('refuse a new round with a threshold that is no level from 0 to 100', () => {
    const ctx = world();
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'reset',
        recognition: sent(-1, 4, 101),
      }),
    ).toThrow(
      'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre: ganze Zahl von 0 bis 100. Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre: ganze Zahl von 0 bis 100.',
    );
    expect(() =>
      runAction(ctx, 'u_Anna', { type: 'reset', recognition: sent(2, 2.5, 8) }),
    ).toThrow(
      'Fremde Flotten: Schiffstypen ab Auspex-Lehre: ganze Zahl von 0 bis 100.',
    );
    // A group is sent whole (#214): a threshold left out is refused.
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'reset',
        recognition: { recognitionTypes: 6 },
      }),
    ).toThrow(
      'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre: ganze Zahl von 0 bis 100. Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre: ganze Zahl von 0 bis 100.',
    );
    expect(roundRules(ctx)).toMatchObject({ number: 1, ...sent(2, 4, 8) });
  });

  it('change live in the universe settings during the round', () => {
    const ctx = world(3);
    expect(seenBy(ctx)[0]).toEqual({ ...BASE, total: 7 });
    runAction(ctx, 'u_Anna', {
      type: 'settings',
      settings: {
        ...DEFAULT_UNIVERSE,
        roundRecognitionTotal: 4,
        roundRecognitionTypes: 3,
        roundRecognitionCounts: 3,
      },
    });
    expect(levels(ctx)).toEqual({ total: 4, types: 3, counts: 3 });
    expect(roundRules(ctx).number).toBe(1);
    expect(seenBy(ctx)[0]).toEqual({
      ...BASE,
      types: ['lf', 'sc'],
      ships: { lf: 5, sc: 2 },
    });
  });
});
