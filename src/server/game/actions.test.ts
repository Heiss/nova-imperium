import { describe, expect, it } from 'vitest';
import { RES } from '../../shared/catalog.ts';
import { lvlCost, prod, researchTime } from '../../shared/economy.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import type { AuditEntry } from '../audit.ts';
import * as A from './actions.ts';

function setup(planet = {}, user = {}) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna', user);
  addPlanet(ctx, u.id, planet);
  const p = () => ctx.store.planetOfUser(u.id)!;
  const me = () => ctx.store.user(u.id)!;
  return { ctx, u, p, me };
}

describe('buildings', () => {
  it('start, pay and finish', () => {
    const { ctx, u, p } = setup({ res: { m: 1000, c: 1000, d: 0 } });
    expect(A.build(ctx, u, { key: 'metal' })).toBeNull();
    expect(p().res).toEqual({ m: 940, c: 985, d: 0 });
    expect(p().bq).toEqual({
      key: 'metal',
      lvl: 1,
      start: ctx.now(),
      end: ctx.now() + 21600,
      cost: [60, 15, 0],
    });
    ctx.clock.t += 21600;
    expect(A.mine(ctx, u).b.metal).toBe(1);
  });
  it('build on another own planet given by „at“ (issue #64)', () => {
    const { ctx, u, p } = setup({ res: { m: 1000, c: 1000, d: 0 } });
    const colony = addPlanet(ctx, u.id, { s: 2, res: { m: 0, c: 0, d: 0 } });
    expect(
      A.build(ctx, u, { key: 'metal', planet: colony.id, at: p().id }),
    ).toBeNull();
    expect(p().bq?.key).toBe('metal');
    expect(ctx.store.planet(colony.id)!.bq).toBeNull();
    const other = addUser(ctx, 'Bert');
    const foreign = addPlanet(ctx, other.id, { s: 3 });
    expect(() => A.build(ctx, u, { key: 'metal', at: foreign.id })).toThrow(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
  });
  it('persists a solar upgrade with a fractional calculated duration', () => {
    const { ctx, u, p } = setup({ b: { robot: 1, solar: 1 } });
    ctx.store.saveUniverse({ ...ctx.store.universe(), speed: 7 });
    expect(A.build(ctx, u, { key: 'solar' })).toBeNull();
    const due = p().bq!.end;
    expect(Number.isInteger(due)).toBe(true);
    ctx.clock.t = due - 1;
    expect(A.mine(ctx, u).b.solar).toBe(1);
    ctx.clock.t = due;
    expect(A.mine(ctx, u).b.solar).toBe(2);
  });
  it('are refused when busy, missing requirements or resources', () => {
    const { ctx, u } = setup({ res: { m: 10, c: 10, d: 0 }, b: { robot: 2 } });
    expect(() => A.build(ctx, u, { key: 'nope' })).toThrow(
      'Unbekanntes Gebäude.',
    );
    expect(() => A.build(ctx, u, { key: 'metal' })).toThrow(
      'Nicht genug Rohstoffe.',
    );
    const { ctx: c2, u: u2 } = setup();
    expect(() => A.build(c2, u2, { key: 'yard' })).toThrow(
      'Voraussetzungen fehlen.',
    );
    A.build(c2, u2, { key: 'metal' });
    expect(() => A.build(c2, u2, { key: 'crystal' })).toThrow(
      'Es wird bereits gebaut.',
    );
  });
  it('wait for the shipyard and the lab', () => {
    const { ctx, u } = setup({
      b: { robot: 2, yard: 1, lab: 1 },
      sq: [{ key: 'rl', n: 9, unit: 1e9 }],
      sqT: 1_000_000,
    });
    expect(() => A.build(ctx, u, { key: 'yard' })).toThrow(
      'Die Werft arbeitet gerade.',
    );
    A.research(ctx, u, { key: 'energy' });
    expect(() => A.build(ctx, u, { key: 'lab' })).toThrow(
      'Das Labor forscht gerade.',
    );
  });
  it('start the Nanitenfabrik only with an idle shipyard (#48)', () => {
    const res = { m: 2e6, c: 2e6, d: 2e6 };
    const research = { research: { computer: 10 } };
    const busy = setup(
      {
        res,
        b: { robot: 10, yard: 1 },
        sq: [{ key: 'rl', n: 9, unit: 1e9 }],
        sqT: 1_000_000,
      },
      research,
    );
    expect(() => A.build(busy.ctx, busy.u, { key: 'nanite' })).toThrow(
      'Die Werft arbeitet gerade.',
    );
    const idle = setup({ res, b: { robot: 10, yard: 1 } }, research);
    expect(A.build(idle.ctx, idle.u, { key: 'nanite' })).toBeNull();
    expect(idle.p().bq).toMatchObject({
      key: 'nanite',
      lvl: 1,
      cost: [1000000, 500000, 100000],
    });
    expect(() => A.order(idle.ctx, idle.u, { key: 'rl', n: 1 })).toThrow(
      'Die Nanitenfabrik wird ausgebaut.',
    );
  });
  it('name planet, level and due time in the audit event', () => {
    const { ctx, u, p } = setup({
      res: { m: 9000, c: 9000, d: 9000 },
      b: { lab: 1 },
    });
    const built: AuditEntry = { category: 'game', action: 'build' };
    A.build(ctx, u, { key: 'metal' }, built);
    expect(built.detail).toEqual({
      planet: p().id,
      key: 'metal',
      level: 1,
      due: p().bq!.end,
    });
    A.cancelBuild(ctx, u, {});
    const researched: AuditEntry = { category: 'game', action: 'research' };
    A.research(ctx, u, { key: 'energy' }, researched);
    expect(researched.detail).toEqual({
      planet: p().id,
      key: 'energy',
      level: 1,
      due: ctx.store.user(u.id)!.rq!.end,
    });
  });
  it('can be cancelled with a full refund', () => {
    const { ctx, u, p } = setup({ res: { m: 1000, c: 1000, d: 0 } });
    expect(A.cancelBuild(ctx, u, {})).toBeNull();
    A.build(ctx, u, { key: 'metal' });
    A.cancelBuild(ctx, u, {});
    expect(p().res).toEqual({ m: 1000, c: 1000, d: 0 });
    expect(p().bq).toBeNull();
  });
  it('need a planet', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Nobody');
    expect(() => A.mine(ctx, u)).toThrow('Du hast keinen Planeten.');
  });
});

describe('research', () => {
  it('needs a lab and runs one at a time', () => {
    const { ctx, u, p, me } = setup();
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Forschungslabor',
    );
    const { ctx: c2, u: u2, p: p2, me: me2 } = setup({ b: { lab: 1 } });
    expect(() => A.research(c2, u2, { key: 'nope' })).toThrow(
      'Unbekannte Forschung.',
    );
    expect(() => A.research(c2, u2, { key: 'laser' })).toThrow(
      'Voraussetzungen fehlen.',
    );
    A.research(c2, u2, { key: 'energy' });
    expect(me2().rq).toMatchObject({
      key: 'energy',
      lvl: 1,
      cost: [0, 800, 400],
    });
    expect(p2().res).toEqual({ m: 100000, c: 99200, d: 99600 });
    expect(() => A.research(c2, me2(), { key: 'computer' })).toThrow(
      'Es wird bereits geforscht.',
    );
    void p;
    void me;
  });
  it('waits while the lab is upgraded and finishes in time', () => {
    const { ctx, u, me } = setup({
      b: { lab: 1 },
      bq: { key: 'lab', lvl: 2, start: 0, end: 2e6, cost: [0, 0, 0] },
    });
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Das Labor wird ausgebaut.',
    );
    ctx.clock.t = 2e6;
    A.research(ctx, me(), { key: 'energy' });
    const end = me().rq!.end;
    // (0 + 800) / (1000 * (1 + lab 2)) hours at speed 5
    expect(end - ctx.now()).toBe(192000);
    ctx.clock.t = end;
    expect(A.researchOf(ctx, me()).research.energy).toBe(1);
  });
  it('can be cancelled', () => {
    const { ctx, u, p, me } = setup({ b: { lab: 1 } });
    expect(A.cancelResearch(ctx, u, {})).toBeNull();
    A.research(ctx, u, { key: 'energy' });
    A.cancelResearch(ctx, me(), {});
    expect(me().rq).toBeNull();
    expect(p().res).toEqual({ m: 100000, c: 100000, d: 100000 });
  });
  it('is refused without resources', () => {
    const { ctx, u } = setup({ b: { lab: 1 }, res: { m: 0, c: 0, d: 0 } });
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Nicht genug Rohstoffe.',
    );
  });
});

describe('research on any own planet with a lab (#49)', () => {
  const rich = { m: 1e6, c: 1e6, d: 1e6 };
  function twoPlanets(home = {}, colony = {}, user = {}) {
    const s = setup({ res: rich, ...home }, user);
    const col = addPlanet(s.ctx, s.u.id, { s: 2, res: rich, ...colony });
    const c = () => s.ctx.store.planet(col.id)!;
    return { ...s, col, c };
  }
  const time = (ctx: TestCtx, key: string, lab: number) =>
    researchTime(lvlCost(RES[key]!, 1), { b: { lab } }, ctx.store.universe());
  const labUpgrade = (end: number) => ({
    key: 'lab',
    lvl: 7,
    start: 0,
    end,
    cost: [0, 0, 0] as const,
  });

  it('starts on a colony with its own lab and pays there', () => {
    const { ctx, u, p, c, col, me } = twoPlanets({}, { b: { lab: 1 } });
    expect(A.research(ctx, u, { key: 'energy', planet: col.id })).toBeNull();
    expect(me().rq).toMatchObject({ key: 'energy', lvl: 1, planet: col.id });
    expect(c().res).toEqual({ m: 1e6, c: 1e6 - 800, d: 1e6 - 400 });
    expect(p().res).toEqual(rich);
    ctx.clock.t = me().rq!.end;
    expect(A.researchOf(ctx, me()).research.energy).toBe(1);
  });

  it('needs a lab on the planet where it starts', () => {
    const { ctx, u, col } = twoPlanets({ b: { lab: 5 } });
    expect(() => A.research(ctx, u, { key: 'energy', planet: col.id })).toThrow(
      'Du brauchst ein Forschungslabor.',
    );
  });

  it('checks the lab requirement against the starting planet', () => {
    const { ctx, u, col, me } = twoPlanets(
      { b: { lab: 7 } },
      { b: { lab: 1 } },
      { research: { hyper: 3 } },
    );
    expect(() => A.research(ctx, u, { key: 'hdrive', planet: col.id })).toThrow(
      'Voraussetzungen fehlen.',
    );
    A.research(ctx, me(), { key: 'hdrive' });
    expect(me().rq).toMatchObject({ key: 'hdrive' });
  });

  it('runs one research at a time over all planets', () => {
    const { ctx, u, col, me } = twoPlanets(
      { b: { lab: 1 } },
      { b: { lab: 1 } },
    );
    A.research(ctx, u, { key: 'energy' });
    expect(() =>
      A.research(ctx, me(), { key: 'computer', planet: col.id }),
    ).toThrow('Es wird bereits geforscht.');
  });

  it('refunds the planet where it started, from any planet', () => {
    const { ctx, u, p, c, col, me } = twoPlanets({}, { b: { lab: 1 } });
    A.research(ctx, u, { key: 'energy', planet: col.id });
    A.cancelResearch(ctx, me(), { planet: p().id });
    expect(me().rq).toBeNull();
    expect(c().res).toEqual(rich);
    expect(p().res).toEqual(rich);
  });

  it('refunds research started before #49 on the home planet', () => {
    const { ctx, u, p, me } = twoPlanets({ b: { lab: 1 } }, { b: { lab: 1 } });
    A.research(ctx, u, { key: 'energy' });
    const { planet, ...old } = me().rq!;
    expect(planet).toBe(p().id);
    ctx.store.saveUser({ ...me(), rq: old });
    ctx.store.savePlanet({ ...p(), res: { m: 0, c: 0, d: 0 } });
    A.cancelResearch(ctx, me(), {});
    expect(p().res).toEqual({ m: 0, c: 800, d: 400 });
  });

  it('keeps the lab lock: no start beside an upgrade, no upgrade beside research', () => {
    const { ctx, u, col, me } = twoPlanets(
      { b: { lab: 1 } },
      { b: { lab: 1 }, bq: labUpgrade(9e9) },
    );
    expect(() => A.research(ctx, u, { key: 'energy', planet: col.id })).toThrow(
      'Das Labor wird ausgebaut.',
    );
    A.research(ctx, u, { key: 'energy' });
    ctx.store.savePlanet({ ...ctx.store.planet(col.id)!, bq: null });
    expect(() => A.build(ctx, me(), { key: 'lab', planet: col.id })).toThrow(
      'Das Labor forscht gerade.',
    );
  });

  it('links labs with IFN: labs 10 and 6 research Schildtechnik like lab 16', () => {
    const user = { research: { ifn: 1, energy: 3, hyper: 3 } };
    const shield = twoPlanets({ b: { lab: 10 } }, { b: { lab: 6 } }, user);
    A.research(shield.ctx, shield.u, { key: 'shield' });
    const rq = shield.me().rq!;
    expect(rq.end - rq.start).toBe(time(shield.ctx, 'shield', 16));
    expect(time(shield.ctx, 'shield', 16)).toBeLessThan(
      time(shield.ctx, 'shield', 10),
    );
    // Hyperraumantrieb needs lab 7: the lab 6 stays out.
    const hdrive = twoPlanets({ b: { lab: 10 } }, { b: { lab: 6 } }, user);
    A.research(hdrive.ctx, hdrive.u, { key: 'hdrive' });
    const hq = hdrive.me().rq!;
    expect(hq.end - hq.start).toBe(time(hdrive.ctx, 'hdrive', 10));
  });

  it('links no lab without IFN and none that is being upgraded', () => {
    const alone = twoPlanets({ b: { lab: 10 } }, { b: { lab: 6 } });
    A.research(alone.ctx, alone.u, { key: 'energy' });
    const a = alone.me().rq!;
    expect(a.end - a.start).toBe(time(alone.ctx, 'energy', 10));
    const busy = twoPlanets(
      { b: { lab: 10 } },
      { b: { lab: 6 }, bq: labUpgrade(9e9) },
      { research: { ifn: 1 } },
    );
    A.research(busy.ctx, busy.u, { key: 'energy' });
    const b = busy.me().rq!;
    expect(b.end - b.start).toBe(time(busy.ctx, 'energy', 10));
  });

  it('counts a lab whose upgrade has finished at its new level', () => {
    const s = twoPlanets(
      { b: { lab: 10 } },
      { b: { lab: 6 }, bq: labUpgrade(1) },
      { research: { ifn: 1 } },
    );
    A.research(s.ctx, s.u, { key: 'energy' });
    const q = s.me().rq!;
    expect(q.end - q.start).toBe(time(s.ctx, 'energy', 17));
  });
});

describe('Gravitonforschung (#49)', () => {
  it('starts only with 300,000 energy production on the starting planet', () => {
    const { ctx, u, p, me } = setup({ b: { lab: 12, solar: 58 } });
    const short = Math.ceil(300000 - prod(p(), ctx.store.universe()).eProd);
    expect(() => A.research(ctx, u, { key: 'graviton' })).toThrow(
      `Zu wenig Energie: Gravitonforschung braucht eine Energieproduktion von 300.000, es fehlen ${short.toLocaleString('de-DE')}.`,
    );
    expect(me().rq).toBeNull();
    ctx.store.savePlanet({ ...p(), b: { lab: 12, solar: 59 } });
    expect(A.research(ctx, me(), { key: 'graviton' })).toBeNull();
    const rq = me().rq!;
    expect(rq).toMatchObject({ key: 'graviton', lvl: 1, cost: [0, 0, 0] });
    // The minimum research time, and neither resources nor energy are used.
    expect(rq.end - rq.start).toBe(1000);
    expect(p().res).toEqual({ m: 100000, c: 100000, d: 100000 });
    expect(prod(p(), ctx.store.universe()).eProd).toBeGreaterThan(300000);
  });

  it('needs three times the energy for the next level', () => {
    const { ctx, u } = setup(
      { b: { lab: 12, solar: 59 } },
      { research: { graviton: 1 } },
    );
    expect(() => A.research(ctx, u, { key: 'graviton' })).toThrow(
      'braucht eine Energieproduktion von 900.000',
    );
  });

  it('checks the energy of the starting planet, not of the home planet', () => {
    const { ctx, u, me } = setup({ b: { lab: 12, solar: 59 } });
    const col = addPlanet(ctx, u.id, { s: 2, b: { lab: 12 } });
    expect(() =>
      A.research(ctx, u, { key: 'graviton', planet: col.id }),
    ).toThrow('Zu wenig Energie');
    A.research(ctx, me(), { key: 'graviton' });
    expect(me().rq).toMatchObject({ key: 'graviton' });
  });

  it('checks the requirements before the energy', () => {
    const { ctx, u } = setup({ b: { lab: 11 } });
    expect(() => A.research(ctx, u, { key: 'graviton' })).toThrow(
      'Voraussetzungen fehlen.',
    );
  });
});

describe('shipyard', () => {
  it('orders as many units as can be paid', () => {
    const { ctx, u, p } = setup({
      b: { yard: 1 },
      res: { m: 5000, c: 0, d: 0 },
    });
    expect(A.order(ctx, u, { key: 'rl', n: 9 })).toBe(
      '2× Raketenwerfer in Auftrag gegeben.',
    );
    expect(p().sq).toEqual([{ key: 'rl', n: 2, unit: 288000 }]);
    expect(p().sqT).toBe(ctx.now());
    expect(p().res.m).toBe(1000);
  });
  it('keeps the start time when the list is not empty', () => {
    const { ctx, u, p } = setup({
      b: { yard: 1 },
      sq: [{ key: 'rl', n: 1, unit: 1e9 }],
      sqT: 5,
    });
    A.order(ctx, u, { key: 'rl', n: 1 });
    expect(p().sqT).toBe(5);
    expect(p().sq).toHaveLength(2);
  });
  it('refuses wrong orders', () => {
    const { ctx, u } = setup();
    expect(() => A.order(ctx, u, { key: 'x' })).toThrow('Unbekannte Einheit.');
    expect(() => A.order(ctx, u, { key: 'rl', n: 1 })).toThrow(
      'Raumschiffwerft',
    );
    const s = setup({
      b: { yard: 1 },
      bq: { key: 'yard', lvl: 2, start: 0, end: 9e9, cost: [0, 0, 0] },
    });
    expect(() => A.order(s.ctx, s.u, { key: 'rl', n: 1 })).toThrow(
      'Die Werft wird ausgebaut.',
    );
    const t = setup({ b: { yard: 1 } });
    expect(() => A.order(t.ctx, t.u, { key: 'gauss', n: 1 })).toThrow(
      'Voraussetzungen fehlen.',
    );
    expect(() => A.order(t.ctx, t.u, { key: 'rl', n: 0 })).toThrow(
      'Nicht genug Rohstoffe.',
    );
    const full = Array.from({ length: 20 }, () => ({
      key: 'rl',
      n: 1,
      unit: 1e9,
    }));
    const v = setup({ b: { yard: 1 }, sq: full, sqT: 1 });
    expect(() => A.order(v.ctx, v.u, { key: 'rl', n: 1 })).toThrow(
      'Die Bauliste der Werft ist voll.',
    );
  });
});

describe('shield domes (#50)', () => {
  const ONCE = 'Diese Schildkuppel gibt es nur einmal pro Planet.';
  const domeSetup = (planet = {}) =>
    setup(
      { b: { yard: 6 }, res: { m: 1e6, c: 1e6, d: 1e6 }, ...planet },
      { research: { shield: 6 } },
    );
  it('orders one dome of each kind', () => {
    const { ctx, u, p } = domeSetup();
    expect(A.order(ctx, u, { key: 'ssd', n: 1 })).toBe(
      '1× Kleine Schildkuppel in Auftrag gegeben.',
    );
    expect(A.order(ctx, u, { key: 'lsd', n: 1 })).toBe(
      '1× Große Schildkuppel in Auftrag gegeben.',
    );
    expect(p().sq.map((q) => [q.key, q.n])).toEqual([
      ['ssd', 1],
      ['lsd', 1],
    ]);
    expect(p().res).toEqual({ m: 940000, c: 940000, d: 1e6 });
  });
  it('refuses a second dome that is already queued', () => {
    const { ctx, u, p } = domeSetup();
    A.order(ctx, u, { key: 'ssd', n: 1 });
    expect(() => A.order(ctx, u, { key: 'ssd', n: 1 })).toThrow(ONCE);
    expect(p().sq).toHaveLength(1);
    expect(p().res.m).toBe(990000);
  });
  it('refuses a dome the planet already has', () => {
    const { ctx, u, p } = domeSetup({ def: { lsd: 1 } });
    expect(() => A.order(ctx, u, { key: 'lsd', n: 1 })).toThrow(ONCE);
    expect(p().sq).toEqual([]);
    expect(p().res.m).toBe(1e6);
  });
  it('refuses an order of two domes at once, even if only one can be paid', () => {
    const { ctx, u, p } = domeSetup();
    expect(() => A.order(ctx, u, { key: 'ssd', n: 2 })).toThrow(ONCE);
    const poor = domeSetup({ res: { m: 15000, c: 15000, d: 0 } });
    expect(() => A.order(poor.ctx, poor.u, { key: 'ssd', n: 2 })).toThrow(ONCE);
    expect(p().sq).toEqual([]);
    expect(poor.p().sq).toEqual([]);
  });
  it('checks the requirements before the limit and the resources after it', () => {
    const { ctx, u } = setup({ b: { yard: 1 }, def: { ssd: 1 } });
    expect(() => A.order(ctx, u, { key: 'ssd', n: 1 })).toThrow(
      'Voraussetzungen fehlen.',
    );
    const poor = domeSetup({ res: { m: 0, c: 0, d: 0 } });
    expect(() => A.order(poor.ctx, poor.u, { key: 'ssd', n: 1 })).toThrow(
      'Nicht genug Rohstoffe.',
    );
  });
  it('leaves the other new defense unlimited', () => {
    const { ctx, u, p } = setup(
      { b: { yard: 8 }, res: { m: 1e6, c: 1e6, d: 1e6 }, def: { ionc: 3 } },
      { research: { ion: 4, plasma: 7 } },
    );
    expect(A.order(ctx, u, { key: 'ionc', n: 5 })).toBe(
      '5× Ionengeschütz in Auftrag gegeben.',
    );
    expect(A.order(ctx, u, { key: 'pt', n: 2 })).toBe(
      '2× Plasmawerfer in Auftrag gegeben.',
    );
    expect(p().sq.map((q) => [q.key, q.n])).toEqual([
      ['ionc', 5],
      ['pt', 2],
    ]);
  });
});

describe('planet settings', () => {
  it('set the production share in steps of 10', () => {
    const { ctx, u, p } = setup();
    A.pct(ctx, u, { key: 'metal', v: 44 });
    expect(p().pct.metal).toBe(40);
    A.pct(ctx, u, { key: 'solar', v: 999 });
    expect(p().pct.solar).toBe(100);
    expect(() => A.pct(ctx, u, { key: 'lab', v: 10 })).toThrow('Ungültig.');
    A.pct(ctx, u, { key: 'sat', v: 30 });
    expect(p().pct.sat).toBe(30);
  });
  it('rename the planet', () => {
    const { ctx, u, p } = setup();
    A.rename(ctx, u, { name: '  Neu\u0007Welt  ' });
    expect(p().name).toBe('NeuWelt');
    expect(() => A.rename(ctx, u, { name: '   ' })).toThrow(
      'Bitte einen Namen',
    );
  });
  it('save the number of probes', () => {
    const { ctx, u, me } = setup();
    expect(A.options(ctx, u, { probes: 0 })).toBe('Gespeichert.');
    expect(me().probes).toBe(1);
    A.options(ctx, u, { probes: 5 });
    expect(me().probes).toBe(5);
  });
  it('save the display option of the explanation texts (issue #63)', () => {
    const { ctx, u, me } = setup();
    expect(me().explain).toBe('icon');
    for (const explain of ['always', 'hidden', 'icon']) {
      expect(A.options(ctx, u, { probes: 2, explain })).toBe('Gespeichert.');
      expect(me()).toMatchObject({ probes: 2, explain });
    }
    A.options(ctx, u, { probes: 3, explain: 'hidden' });
    A.options(ctx, u, { probes: 4 });
    expect(me()).toMatchObject({ probes: 4, explain: 'hidden' });
  });
  it('refuse an unknown display option and change nothing', () => {
    const { ctx, u, me } = setup({}, { probes: 3, explain: 'always' });
    for (const explain of ['', 'never', 'ICON', null, 1, ['icon']])
      expect(() => A.options(ctx, { ...u }, { probes: 9, explain })).toThrow(
        'Ungültig.',
      );
    expect(me()).toMatchObject({ probes: 3, explain: 'always' });
  });
});

describe('reports', () => {
  it('are marked read, deleted one by one or all', () => {
    const { ctx, u, me } = setup();
    ctx.store.addReport(
      u.id,
      { id: 'r1', time: 50, type: 'info', title: 'a' },
      60,
    );
    ctx.store.addReport(
      u.id,
      { id: 'r2', time: 70, type: 'info', title: 'b' },
      60,
    );
    A.read(ctx, u, {});
    expect(me().readAt).toBe(70);
    A.delrep(ctx, u, { id: 'r1' });
    expect(ctx.store.reports(u.id).map((r) => r.id)).toEqual(['r2']);
    A.delall(ctx, u, {});
    expect(ctx.store.reports(u.id)).toEqual([]);
    A.read(ctx, me(), {});
    expect(me().readAt).toBe(0);
  });
});
