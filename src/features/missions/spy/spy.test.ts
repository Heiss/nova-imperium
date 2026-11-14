// Auspex-Erkundung (#116): only Spähschädel; a report for the attacker, a
// warning for the defender, and the probes may be shot down.
import { describe, expect, it } from 'vitest';
import type { Fleet, Levels } from '../../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { counterChance, onArrive, spyScore } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

const fleet = (ships: Levels) => ({ owner: 'a', from: 'p1', ships });

function setup(probes: number, defShips: Levels, attSpy = 0, defSpy = 0) {
  const ctx = testCtx(1_000_000, 7);
  addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const t = addPlanet(ctx, 'u_Bert', {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    ships: defShips,
    def: { rl: 4 },
    b: { metal: 3 },
    res: { m: 10.7, c: 20.2, d: 30.9 },
  });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: t.id,
    toC: { g: 1, s: 2, p: 6 },
    mission: 'spy',
    ships: { probe: probes },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  const att = { name: 'Anna', research: { spy: attSpy }, rq: null };
  const def = { name: 'Bert', research: { spy: defSpy }, rq: null };
  return { ctx, f, at: { t, att, def } };
}

describe('spy', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 30,
      target: 'foreign',
      cargo: false,
      returns: true,
      visible: false,
      silent: true,
    });
  });

  it('flies only with Spähschädel', () => {
    expect(canSend(fleet({ probe: 3 }))).toBeUndefined();
    expect(canSend(fleet({ probe: 3, sc: 1 }))).toBe('probesOnly');
    expect(canSend(fleet({ lc: 1 }))).toBe('probesOnly');
  });

  it('scores probes and technology, and the counter chance', () => {
    expect(spyScore(3, 2)).toBe(7);
    expect(spyScore(3, -2)).toBe(-1);
    expect(counterChance(0, 0)).toBe(0);
    expect(counterChance(16, 0)).toBe(8);
    expect(counterChance(16, -10)).toBe(100);
  });

  it('reports what the score shows and flies back when not seen', () => {
    const { ctx, f, at } = setup(5, {});
    onArrive(ctx, f, at);
    const [report] = ctx.reports.ofPlayer('u_Anna');
    expect(report).toMatchObject({
      time: f.arr,
      type: 'spy',
      title: 'Auspex-Bericht von Beta [1:2:6]',
      defName: 'Bert',
      res: { m: 10, c: 20, d: 30 },
      counter: 0,
      lost: false,
      ships: {},
      def: { rl: 4 },
      b: { metal: 3 },
    });
    expect(report).not.toHaveProperty('r');
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      {
        title: 'Auspex-Aktivität',
        text: 'Eine fremde Flotte von Anna [1:1:5] wurde in der Nähe deines Planeten Beta [1:2:6] gesichtet. Chance auf Auspex-Abwehr: 0 %.',
      },
    ]);
    expect(ctx.fleets.get('f1')?.state).toBe('back');
  });

  it('is shot down at a sure counter chance', () => {
    const { ctx, f, at } = setup(1, { lc: 100 }, 0, 5);
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      counter: 100,
      lost: true,
    });
    expect(ctx.reports.ofPlayer('u_Bert')[0]!.text).toMatch(
      / Die Spähschädel wurden abgeschossen!$/,
    );
    expect(ctx.fleets.get('f1')).toBeNull();
  });
});
