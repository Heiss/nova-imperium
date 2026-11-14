import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { settle } from '../../core/settle.ts';
import type { Fleet } from '../../core/types.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../test-helpers.ts';
import {
  arrive,
  comeHome,
  counterChance,
  plunder,
  rebuild,
  spyScore,
  tick,
} from './arrival.ts';

function setup(target = {}) {
  const ctx = testCtx();
  const a = addUser(ctx, 'Anna');
  const b = addUser(ctx, 'Bert');
  addPlanet(ctx, a.id, { g: 1, s: 1, p: 5, name: 'Alpha' });
  addPlanet(ctx, b.id, {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    res: { m: 9000, c: 6000, d: 3000 },
    ...target,
  });
  return { ctx, a, b };
}

const fleet = (
  ctx: ReturnType<typeof testCtx>,
  over: Partial<Fleet> = {},
): Fleet => {
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'p1_2_6',
    toC: { g: 1, s: 2, p: 6 },
    mission: 'attack',
    ships: { lf: 1 },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now(),
    arr: ctx.now(),
    ret: ctx.now() + 100,
    state: 'out',
    recalled: false,
    fuel: 0,
    ...over,
  };
  ctx.fleets.save(f);
  return f;
};

const titles = (ctx: ReturnType<typeof testCtx>, uid: string) =>
  ctx.reports.ofPlayer(uid).map((r) => r.title);

describe('helpers', () => {
  it('compute the spy score and the counter chance', () => {
    expect(spyScore(1, 0)).toBe(1);
    expect(spyScore(1, 2)).toBe(5);
    expect(spyScore(4, -1)).toBe(3);
    expect(counterChance(0, 0)).toBe(0);
    expect(counterChance(4, 0)).toBe(4);
    expect(counterChance(4, 1)).toBe(2);
    expect(counterChance(10000, -3)).toBe(100);
  });
  it('rebuild 70 % of the defense', () => {
    expect(rebuild(0, () => 0)).toBe(0);
    expect(rebuild(-3, () => 0)).toBe(0);
    expect(rebuild(10, () => 0.69)).toBe(10);
    expect(rebuild(10, () => 0.7)).toBe(0);
    expect(rebuild(49, () => 0)).toBe(49);
    expect(rebuild(50, () => 0)).toBe(35);
    expect(rebuild(101, () => 0)).toBe(71);
  });
  it('plunder up to half of each resource within the free cargo', () => {
    expect(plunder({ m: 9000, c: 6000, d: 3000 }, 100000)).toEqual({
      m: 4500,
      c: 3000,
      d: 1500,
    });
    // A third for metal, half of the rest for crystal, the rest for deuterium.
    expect(plunder({ m: 9000, c: 6000, d: 3000 }, 3000)).toEqual({
      m: 1000,
      c: 1000,
      d: 1000,
    });
    expect(plunder({ m: 9000, c: 6000, d: 600 }, 3000)).toEqual({
      m: 1350,
      c: 1350,
      d: 300,
    });
    expect(plunder({ m: 0, c: 6000, d: 0 }, 1000)).toEqual({
      m: 0,
      c: 1000,
      d: 0,
    });
    expect(plunder({ m: 9000, c: 0, d: 0 }, 1000)).toEqual({
      m: 1000,
      c: 0,
      d: 0,
    });
    expect(plunder({ m: 9000, c: 9000, d: 9000 }, -50)).toEqual({
      m: 0,
      c: 0,
      d: 0,
    });
  });
});

describe('arrival', () => {
  it('turns back without a fitting target', () => {
    const { ctx } = setup();
    arrive(ctx, fleet(ctx, { to: 'p9_9_9' }));
    expect(ctx.fleets.get('f1')?.state).toBe('back');
    expect(titles(ctx, 'u_Anna')).toEqual(['Flotte kehrt um']);
    arrive(ctx, fleet(ctx, { id: 'f2', to: 'p1_1_5' }));
    expect(ctx.fleets.get('f2')?.state).toBe('back');
  });
  it('pushes a turned back fleet as an own fleet (#192)', () => {
    const { ctx } = setup();
    subscribePush(ctx, 'u_Anna');
    arrive(ctx, fleet(ctx, { to: 'p9_9_9' }));
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
    ]);
  });
  it('delivers a transport and empties the cargo', () => {
    const { ctx } = setup();
    arrive(
      ctx,
      fleet(ctx, {
        mission: 'transport',
        ships: { sc: 1 },
        cargo: { m: 100, c: 200, d: 300 },
      }),
    );
    expect(ctx.planets.get('p1_2_6')!.res).toMatchObject({
      m: 9100,
      c: 6200,
      d: 3300,
    });
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      cargo: { m: 0, c: 0, d: 0 },
    });
    expect(titles(ctx, 'u_Anna')).toEqual(['Transport erreicht [1:2:6]']);
    expect(titles(ctx, 'u_Bert')).toEqual(['Lieferung von Anna']);
  });
  it('settles a target and a home planet with the research of their owners (#47)', () => {
    const reactor = {
      b: { deut: 9, fusion: 6, metal: 12 },
      res: { m: 0, c: 0, d: 50000 },
    };
    const { ctx } = setup(reactor);
    ctx.players.save({
      ...ctx.players.get('u_Bert')!,
      research: { energy: 9 },
    });
    const home = { ...ctx.planets.get('p1_1_5')!, ...reactor };
    ctx.planets.save(home);
    ctx.players.save({
      ...ctx.players.get('u_Anna')!,
      research: { energy: 7 },
    });
    const target = ctx.planets.get('p1_2_6')!;
    const u = ctx.admin.universe();
    ctx.clock.t += 3600000;
    arrive(
      ctx,
      fleet(ctx, { mission: 'transport', ships: { sc: 1 }, arr: ctx.now() }),
    );
    const bert = { research: { energy: 9 }, rq: null };
    expect(ctx.planets.get('p1_2_6')!.res).toEqual(
      settle(target, ctx.now(), u, bert).res,
    );
    ctx.clock.t += 3600000;
    comeHome(ctx, { ...ctx.fleets.get('f1')!, ret: ctx.now() });
    const anna = { research: { energy: 7 }, rq: null };
    expect(ctx.planets.get('p1_1_5')!.res).toEqual(
      settle(home, ctx.now(), u, anna).res,
    );
  });
  it('a transport to an own planet sends one report', () => {
    const { ctx } = setup();
    addPlanet(ctx, 'u_Anna', { g: 1, s: 3, p: 3, created: 5e6 });
    arrive(
      ctx,
      fleet(ctx, {
        mission: 'transport',
        to: 'p1_3_3',
        toC: { g: 1, s: 3, p: 3 },
      }),
    );
    expect(titles(ctx, 'u_Anna')).toEqual(['Transport erreicht [1:3:3]']);
  });
  it('a deploy stays with ships and cargo, also above the storage limit (#129)', () => {
    const { ctx } = setup();
    addPlanet(ctx, 'u_Anna', {
      g: 1,
      s: 3,
      p: 3,
      name: 'Gamma',
      created: 5e6,
      ships: { lf: 4 },
      res: { m: 9e6, c: 8e6, d: 7e6 },
    });
    arrive(
      ctx,
      fleet(ctx, {
        mission: 'deploy',
        to: 'p1_3_3',
        toC: { g: 1, s: 3, p: 3 },
        ships: { lf: 1, bs: 2 },
        cargo: { m: 100, c: 200, d: 300 },
        fuel: 41,
      }),
    );
    const t = ctx.planets.get('p1_3_3')!;
    expect(t.ships).toEqual({ lf: 5, bs: 2 });
    expect(t.res).toEqual({ m: 9e6 + 100, c: 8e6 + 200, d: 7e6 + 300 + 20 });
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(titles(ctx, 'u_Anna')).toEqual(['Verlegung erreicht [1:3:3]']);
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.text).toBe(
      'Deine Flotte bleibt auf Gamma [1:3:3] und liefert Adamant 100 · Psikristall 200 · Promethium 320, davon 20 übriger Treibstoff.',
    );
  });
  it('a deploy turns back with its cargo when the target is not own or gone (#129)', () => {
    const { ctx } = setup();
    const lost = { mission: 'deploy' as const, cargo: { m: 1, c: 2, d: 3 } };
    arrive(ctx, fleet(ctx, { ...lost, fuel: 9 }));
    arrive(ctx, fleet(ctx, { ...lost, id: 'f2', to: 'p9_9_9' }));
    for (const id of ['f1', 'f2'])
      expect(ctx.fleets.get(id)).toMatchObject({
        state: 'back',
        ships: { lf: 1 },
        cargo: { m: 1, c: 2, d: 3 },
      });
    expect(ctx.planets.get('p1_2_6')).toMatchObject({
      ships: {},
      res: { m: 9000, c: 6000, d: 3000 },
    });
    expect(titles(ctx, 'u_Anna')).toEqual([
      'Flotte kehrt um',
      'Flotte kehrt um',
    ]);
    expect(titles(ctx, 'u_Bert')).toEqual([]);
    comeHome(ctx, ctx.fleets.get('f1')!);
    expect(ctx.planets.get('p1_1_5')).toMatchObject({
      ships: { lf: 1 },
      res: { m: 100001, c: 100002, d: 100003 },
    });
  });
  it('spies: more probes show more', () => {
    const { ctx } = setup({ ships: {}, def: { rl: 2 }, b: { metal: 3 } });
    ctx.players.save({
      ...ctx.players.get('u_Bert')!,
      research: { spy: 1, energy: 2 },
    });
    arrive(ctx, fleet(ctx, { mission: 'spy', ships: { probe: 1 } }));
    let rep = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(rep).toMatchObject({
      type: 'spy',
      title: 'Auspex-Bericht von Beta [1:2:6]',
      defName: 'Bert',
      res: { m: 9000, c: 6000, d: 3000 },
      counter: 0,
      lost: false,
    });
    expect(rep.ships).toBeUndefined();
    expect(titles(ctx, 'u_Bert')).toEqual(['Auspex-Aktivität']);
    expect(ctx.fleets.get('f1')?.state).toBe('back');
    arrive(ctx, fleet(ctx, { id: 'f2', mission: 'spy', ships: { probe: 8 } }));
    rep = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(rep).toMatchObject({
      ships: {},
      def: { rl: 2 },
      b: { metal: 3 },
      r: { spy: 1, energy: 2 },
    });
  });
  it('spy probes can be shot down', () => {
    const { ctx } = setup({ ships: { lf: 10000 } });
    arrive(ctx, fleet(ctx, { mission: 'spy', ships: { probe: 1 } }));
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      counter: 100,
      lost: true,
    });
    expect(ctx.reports.ofPlayer('u_Bert')[0]!.text).toContain(
      'Die Spähschädel wurden abgeschossen!',
    );
    expect(ctx.fleets.get('f1')).toBeNull();
  });
  it('an attack that wins takes loot and the defense is partly rebuilt', () => {
    const { ctx } = setup({ def: { rl: 1 } });
    arrive(ctx, fleet(ctx, { ships: { bs: 30 } }));
    const t = ctx.planets.get('p1_2_6')!;
    const f = ctx.fleets.get('f1')!;
    expect(f.state).toBe('back');
    expect(f.ships).toEqual({ bs: 30 });
    expect(f.cargo).toEqual({ m: 4500, c: 3000, d: 1500 });
    expect(t.res).toMatchObject({ m: 4500, c: 3000, d: 1500 });
    const rep = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(rep).toMatchObject({
      type: 'battle',
      winner: 'att',
      title: 'Kampfbericht [1:2:6] – gewonnen',
      attTech: { weapons: 0, shield: 0, armor: 0 },
    });
    expect(t.def).toEqual(rep.rebuilt);
    expect(titles(ctx, 'u_Bert')).toEqual([
      'Feindkontakt! Beta [1:2:6] wird von Anna angegriffen',
    ]);
  });
  it('Solarsatelliten defend and are destroyed like ships (#46)', () => {
    const { ctx } = setup({ ships: { sat: 5 } });
    arrive(ctx, fleet(ctx, { ships: { bs: 10 } }));
    const t = ctx.planets.get('p1_2_6')!;
    expect(t.ships.sat ?? 0).toBe(0);
    const rep = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(rep).toMatchObject({ type: 'battle', winner: 'att' });
    expect(rep.defBefore).toMatchObject({ sat: 5 });
  });
  it('a lost attack removes the fleet and keeps the defenders', () => {
    const { ctx } = setup({ def: { gauss: 20 }, ships: { cr: 2 } });
    arrive(ctx, fleet(ctx, { ships: { lf: 1 } }));
    expect(ctx.fleets.get('f1')).toBeNull();
    const t = ctx.planets.get('p1_2_6')!;
    expect(t.def).toEqual({ gauss: 20 });
    expect(t.ships).toEqual({ cr: 2 });
    expect(t.res).toMatchObject({ m: 9000, c: 6000, d: 3000 });
    expect(titles(ctx, 'u_Anna')).toEqual(['Kampfbericht [1:2:6] – verloren']);
  });
});

describe('coming home', () => {
  it('lands ships and cargo and reports', () => {
    const { ctx } = setup();
    comeHome(
      ctx,
      fleet(ctx, {
        state: 'back',
        ships: { lf: 2 },
        cargo: { m: 1, c: 2, d: 3 },
      }),
    );
    const p = ctx.planets.get('p1_1_5')!;
    expect(p.ships.lf).toBe(2);
    expect(p.res).toMatchObject({ m: 100001, c: 100002, d: 100003 });
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      title: 'Rückkehr zu Alpha [1:1:5]',
      text: 'Deine Flotte ist zurück und bringt Adamant 1 · Psikristall 2 · Promethium 3 mit.',
    });
  });
  it('pushes the return as an own fleet that opens the fleet view, with or without a report (#192)', () => {
    const { ctx } = setup();
    subscribePush(ctx, 'u_Anna');
    comeHome(ctx, fleet(ctx, { state: 'back' }));
    comeHome(
      ctx,
      fleet(ctx, {
        id: 'f2',
        mission: 'spy',
        state: 'back',
        ships: { probe: 1 },
      }),
    );
    expect(ctx.reports.ofPlayer('u_Anna')).toHaveLength(1);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'fleet', topic: 'fleet' },
      { user: 'u_Anna', kind: 'fleet', topic: 'fleet' },
    ]);
  });
  it('a spy fleet comes home quietly unless recalled; an empty fleet reports without cargo', () => {
    const { ctx } = setup();
    comeHome(
      ctx,
      fleet(ctx, { mission: 'spy', state: 'back', ships: { probe: 1 } }),
    );
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    comeHome(
      ctx,
      fleet(ctx, {
        id: 'f2',
        mission: 'spy',
        state: 'back',
        ships: { probe: 1 },
        recalled: true,
      }),
    );
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.text).toBe(
      'Deine Flotte ist zurück.',
    );
  });
  it('is lost when the home planet is gone', () => {
    const { ctx } = setup();
    comeHome(ctx, fleet(ctx, { state: 'back', from: 'p9_9_9' }));
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
  });
});

describe('tick', () => {
  it('processes due fleets: out and back', () => {
    const { ctx } = setup();
    fleet(ctx, {
      mission: 'transport',
      arr: ctx.now() + 10,
      ret: ctx.now() + 20,
    });
    expect(tick(ctx)).toBe(0);
    ctx.clock.t += 10;
    expect(tick(ctx)).toBe(1);
    expect(ctx.fleets.get('f1')?.state).toBe('back');
    ctx.clock.t += 10;
    expect(tick(ctx)).toBe(1);
    expect(ctx.fleets.get('f1')).toBeNull();
  });
  it('logs and removes a fleet that fails', () => {
    const { ctx } = setup();
    fleet(ctx);
    const logged: string[] = [];
    const broken = {
      ...ctx,
      planets: Object.create(ctx.planets, {
        get: {
          value: () => {
            throw new Error('x');
          },
        },
      }),
    };
    expect(tick(broken, (m) => logged.push(m))).toBe(1);
    expect(logged).toEqual(['Fleet f1 failed and was removed']);
    expect(ctx.fleets.get('f1')).toBeNull();
  });
  it('leaves a fleet queued when the database writer is busy', () => {
    const { ctx } = setup();
    fleet(ctx);
    const tx = () => {
      throw new Database.SqliteError('database is locked', 'SQLITE_BUSY');
    };
    tick({ ...ctx, tx });
    expect(ctx.fleets.get('f1')?.state).toBe('out');
    tick(ctx);
    expect(ctx.fleets.get('f1')?.state).toBe('back');
  });
  it('skips a fleet that disappeared meanwhile', () => {
    const { ctx } = setup();
    fleet(ctx);
    const fleets = Object.create(ctx.fleets, { get: { value: () => null } });
    expect(tick({ ...ctx, fleets })).toBe(1);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
  });
});
