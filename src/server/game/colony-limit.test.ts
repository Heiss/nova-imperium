// The limit of planets on the server (#237; owner, 2026-11-17, D1 to D6): a
// Landnahme reserves a slot at its launch and is checked again at its
// arrival, with the research the player has then; a moon does not count, and
// the limit comes into the round as four settings of one group.
import { describe, expect, it } from 'vitest';
import { colonyRules } from '../../core/colony-limit.ts';
import type { Fleet } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { research as startResearch } from './actions.ts';
import { tick } from './arrival.ts';
import { flyingColonies, limitOf, ownedPlanets } from './colony-limit.ts';
import { universe } from './context.ts';
import { runAction } from './dispatch.ts';
import { recall, send } from './fleet-actions.ts';
import { addMoon } from './moons.ts';
import { roundRules } from './round.ts';

/** The owner's example: 6 planets, 2 more per level, level 4 at most. */
const EXAMPLE = {
  roundColonyBase: 6,
  roundColonyResearch: 1,
  roundColonyPerLevel: 2,
  roundColonyMaxLevel: 4,
};

/** Sets the stored round values. */
const setRound = (ctx: TestCtx, values: Record<string, number>): void =>
  ctx.admin.putSettings(Object.entries(values));

/** Anna with her home planet, an ark and room for fuel; `colonies` more planets and a position to settle. */
function world(colonies: number, ships = { colony: 3, sc: 1 }) {
  const ctx = testCtx();
  // Computertechnik 5 gives six fleet slots.
  const anna = addUser(ctx, 'Anna', { research: { computer: 5 } });
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 5,
    ships,
    res: { m: 50000, c: 40000, d: 30000 },
  });
  for (let i = 0; i < colonies; i++)
    addPlanet(ctx, anna.id, { g: 2, s: 1 + i, p: 7 });
  return { ctx, anna };
}

const land = (over = {}) => ({
  mission: 'colonize',
  ships: { colony: 1 },
  to: { g: 1, s: 4, p: 8 },
  pct: 10,
  cargo: {},
  ...over,
});

const refusal = (run: () => unknown): string => {
  try {
    run();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
};

describe('counting planets', () => {
  it('counts the ordinary planets with the home planet, and no moon', () => {
    const { ctx, anna } = world(2);
    expect(ownedPlanets(ctx, anna.id)).toBe(3);
    addMoon(ctx, ctx.planets.home(anna.id)!, 1, ctx.now());
    expect(ctx.planets.ofOwner(anna.id)).toHaveLength(4);
    expect(ownedPlanets(ctx, anna.id)).toBe(3);
    expect(ownedPlanets(ctx, 'u_nobody')).toBe(0);
  });

  it('counts the colonization fleets on their way out, not the recalled and the returning', () => {
    const { ctx, anna } = world(0);
    send(ctx, anna, land());
    send(ctx, anna, land({ to: { g: 1, s: 5, p: 8 } }));
    expect(flyingColonies(ctx, anna.id)).toBe(2);
    const [first, second] = ctx.fleets.all() as [Fleet, Fleet];
    recall(ctx, anna, { id: first.id });
    expect(flyingColonies(ctx, anna.id)).toBe(1);
    ctx.fleets.save({ ...second, state: 'back' });
    expect(flyingColonies(ctx, anna.id)).toBe(0);
    // A fleet of another mission is no reservation.
    addPlanet(ctx, anna.id, { g: 2, s: 1, p: 7 });
    send(
      ctx,
      anna,
      land({
        mission: 'transport',
        ships: { sc: 1 },
        to: { g: 2, s: 1, p: 7 },
      }),
    );
    expect(flyingColonies(ctx, anna.id)).toBe(0);
  });

  it('reads the limit from the round and the research of the player', () => {
    const { ctx } = world(0);
    expect(limitOf(ctx, {})).toBeNull();
    setRound(ctx, EXAMPLE);
    expect(limitOf(ctx, {})).toBe(6);
    expect(limitOf(ctx, { colonial: 3 })).toBe(12);
    expect(colonyRules(universe(ctx))).toEqual({
      base: 6,
      research: true,
      perLevel: 2,
      maxLevel: 4,
    });
  });
});

describe('the launch of a Landnahme', () => {
  it('is not limited in a round without a limit (the default, as before)', () => {
    const { ctx, anna } = world(12);
    expect(send(ctx, anna, land())).toBe('Flotte unterwegs nach [1:4:8].');
  });

  it('is refused at the limit with the count and the way out, and takes nothing', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, EXAMPLE);
    expect(refusal(() => send(ctx, anna, land()))).toBe(
      'Planetengrenze erreicht (6/6). Erforsche Kolonialverwaltung oder gib eine Kolonie auf.',
    );
    expect(ctx.fleets.all()).toEqual([]);
    expect(ctx.planets.home(anna.id)!.ships.colony).toBe(3);
  });

  it('leaves out the research from the words when the round does not have it', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, { ...EXAMPLE, roundColonyResearch: 0 });
    expect(refusal(() => send(ctx, anna, land()))).toBe(
      'Planetengrenze erreicht (6/6). Gib eine Kolonie auf.',
    );
  });

  it('is allowed below the limit, and a moon does not use a place', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    addMoon(ctx, ctx.planets.home(anna.id)!, 1, ctx.now());
    expect(send(ctx, anna, land())).toBe('Flotte unterwegs nach [1:4:8].');
  });

  it('reserves a slot: the second fleet at five planets of six is refused with the reservation counted', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    send(ctx, anna, land());
    expect(
      refusal(() => send(ctx, anna, land({ to: { g: 1, s: 5, p: 8 } }))),
    ).toBe(
      'Planetengrenze erreicht (6/6). Erforsche Kolonialverwaltung oder gib eine Kolonie auf.',
    );
    expect(ctx.fleets.all()).toHaveLength(1);
  });

  it('gives the slot back when the fleet is recalled', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    send(ctx, anna, land());
    recall(ctx, anna, { id: ctx.fleets.all()[0]!.id });
    expect(send(ctx, anna, land({ to: { g: 1, s: 5, p: 8 } }))).toBe(
      'Flotte unterwegs nach [1:5:8].',
    );
  });

  it('counts the research level of the player: level 1 raises the limit to 8', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, EXAMPLE);
    expect(refusal(() => send(ctx, anna, land()))).not.toBe('');
    anna.research = { computer: 5, colonial: 1 };
    ctx.players.save(anna);
    expect(send(ctx, anna, land())).toBe('Flotte unterwegs nach [1:4:8].');
  });

  it('is refused while a player is over the limit after the admin lowered it (D1), and removes no planet', () => {
    const { ctx, anna } = world(7);
    setRound(ctx, { ...EXAMPLE, roundColonyBase: 6, roundColonyResearch: 0 });
    expect(refusal(() => send(ctx, anna, land()))).toBe(
      'Planetengrenze erreicht (8/6). Gib eine Kolonie auf.',
    );
    expect(ownedPlanets(ctx, anna.id)).toBe(8);
  });

  it('asks the other checks first: a taken target and a missing ark keep their words', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, EXAMPLE);
    expect(
      refusal(() => send(ctx, anna, land({ to: { g: 2, s: 1, p: 7 } }))),
    ).toBe('Diese Position ist bereits besetzt.');
    expect(refusal(() => send(ctx, anna, land({ ships: { sc: 1 } })))).toBe(
      'Du brauchst eine Kolonistenarche.',
    );
  });

  it('does not ask the limit of another mission', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, EXAMPLE);
    expect(
      send(
        ctx,
        anna,
        land({
          mission: 'transport',
          ships: { sc: 1 },
          to: { g: 2, s: 1, p: 7 },
        }),
      ),
    ).toBe('Flotte unterwegs nach [2:1:7].');
  });
});

describe('the arrival of a Landnahme', () => {
  /** Sends a fleet and runs the clock to its arrival. */
  function arrive(ctx: TestCtx, anna: ReturnType<typeof addUser>) {
    send(ctx, anna, land({ ships: { colony: 2, sc: 1 }, cargo: { m: 500 } }));
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t = f.arr;
    tick(ctx);
    return f;
  }

  it('founds the colony below the limit', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    const f = arrive(ctx, anna);
    expect(ctx.planets.get('p1_4_8')).toMatchObject({ owner: anna.id });
    expect(ctx.fleets.get(f.id)).toMatchObject({ state: 'back' });
  });

  it('returns the whole fleet with its ark and cargo when the limit is reached by then, and reports it', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    send(ctx, anna, land({ ships: { colony: 2, sc: 1 }, cargo: { m: 500 } }));
    const f = ctx.fleets.all()[0]!;
    // Another planet is founded during the flight: the limit is reached.
    addPlanet(ctx, anna.id, { g: 3, s: 1, p: 7 });
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.planets.get('p1_4_8')).toBeNull();
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      ships: { colony: 2, sc: 1 },
      cargo: { m: 500, c: 0, d: 0 },
    });
    expect(ctx.reports.ofPlayer(anna.id)).toMatchObject([
      {
        title: 'Landnahme [1:4:8] gescheitert',
        text: 'Planetengrenze erreicht (6/6). Deine Flotte kehrt mit der Kolonistenarche zurück.',
      },
    ]);
  });

  it('lets a research finished during the flight open the place (D3)', () => {
    const { ctx, anna } = world(5);
    setRound(ctx, EXAMPLE);
    // Level 1 of the research ends before the arrival; at the launch it gave nothing.
    const now = ctx.now();
    anna.research = { computer: 5 };
    anna.rq = {
      key: 'colonial',
      lvl: 1,
      start: now,
      end: now + 1,
      cost: [0, 0, 0],
    };
    ctx.players.save(anna);
    expect(refusal(() => send(ctx, anna, land()))).not.toBe('');
    // A fleet already on its way: the arrival reads the research then.
    ctx.fleets.save({
      id: 'f1',
      owner: anna.id,
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_4_8',
      toC: { g: 1, s: 4, p: 8 },
      mission: 'colonize',
      ships: { colony: 1 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: now,
      arr: now + 10,
      ret: now + 20,
      state: 'out',
      recalled: false,
      fuel: 0,
    });
    ctx.clock.t = now + 10;
    tick(ctx);
    expect(ctx.planets.get('p1_4_8')).toMatchObject({ owner: anna.id });
  });

  it('does not count the arriving fleet as a reservation: the sixth planet is founded under a limit of six', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, EXAMPLE);
    arrive(ctx, anna);
    expect(ownedPlanets(ctx, anna.id)).toBe(6);
  });

  it('lets two simultaneous arrivals found only as many colonies as the limit allows', () => {
    const { ctx, anna } = world(3);
    // Both fleets launched while there was room for them (no limit yet).
    send(ctx, anna, land());
    send(ctx, anna, land({ to: { g: 1, s: 5, p: 8 } }));
    send(ctx, anna, land({ to: { g: 1, s: 6, p: 8 } }));
    const fleets = ctx.fleets.all();
    // The admin sets a limit of five during the flight (D1, live).
    setRound(ctx, { ...EXAMPLE, roundColonyResearch: 0, roundColonyBase: 5 });
    ctx.clock.t = Math.max(...fleets.map((f) => f.arr));
    tick(ctx);
    expect(ownedPlanets(ctx, anna.id)).toBe(5);
    // One ark founded the fifth planet; the other two come home with theirs.
    expect(ctx.fleets.all().filter((f) => f.state === 'back')).toHaveLength(2);
    expect(
      ctx.reports
        .ofPlayer(anna.id)
        .map((r) => r.title)
        .sort(),
    ).toEqual([
      'Kolonie gegründet [1:4:8]',
      'Landnahme [1:5:8] gescheitert',
      'Landnahme [1:6:8] gescheitert',
    ]);
  });

  it('is not limited without a limit', () => {
    const { ctx, anna } = world(12);
    arrive(ctx, anna);
    expect(ownedPlanets(ctx, anna.id)).toBe(14);
  });
});

describe('the research Kolonialverwaltung in the actions', () => {
  const ready = { spy: 4, impulse: 3 };

  it('is refused in a round without it, and started in a round with it', () => {
    const { ctx, anna } = world(0);
    anna.research = { ...ready };
    ctx.players.save(anna);
    ctx.planets.save({ ...ctx.planets.home(anna.id)!, b: { lab: 3 } });
    expect(
      refusal(() =>
        startResearch(ctx, anna, { key: 'colonial', planet: 'p1_1_5' }),
      ),
    ).toBe('Diese Forschung gibt es in dieser Runde nicht.');
    setRound(ctx, EXAMPLE);
    startResearch(ctx, anna, { key: 'colonial', planet: 'p1_1_5' });
    expect(ctx.players.get(anna.id)!.rq).toMatchObject({
      key: 'colonial',
      lvl: 1,
    });
  });

  it('cannot start a level past the highest level', () => {
    const { ctx, anna } = world(0);
    anna.research = { ...ready, colonial: 4 };
    ctx.players.save(anna);
    ctx.planets.save({ ...ctx.planets.home(anna.id)!, b: { lab: 3 } });
    setRound(ctx, EXAMPLE);
    expect(
      refusal(() =>
        startResearch(ctx, anna, { key: 'colonial', planet: 'p1_1_5' }),
      ),
    ).toBe('Die höchste Stufe dieser Forschung ist erreicht.');
  });
});

describe('the settings in the round', () => {
  function admin() {
    const ctx = testCtx();
    const boss = addUser(ctx, 'Admin', { admin: true });
    addPlanet(ctx, boss.id);
    return { ctx, boss };
  }
  const colonies = (over: Record<string, number> = {}) => ({
    colonyBase: 6,
    colonyResearch: 1,
    colonyPerLevel: 2,
    colonyMaxLevel: 4,
    ...over,
  });

  it('start without a limit and without the research in an existing universe', () => {
    const { ctx } = admin();
    expect(roundRules(ctx)).toMatchObject({
      colonyBase: 0,
      colonyResearch: 0,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
  });

  it('are set in „Neue Runde“ as one group, written into the audit entry and kept by a round without them', () => {
    const { ctx, boss } = admin();
    const event = {} as AuditEntry;
    runAction(ctx, boss.id, { type: 'reset', colonies: colonies() }, event);
    expect(roundRules(ctx)).toMatchObject(colonies());
    expect(universe(ctx)).toMatchObject({
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 4,
    });
    expect(event.detail).toMatchObject({
      before: { colonyBase: 0, colonyResearch: 0 },
      after: colonies(),
    });
    runAction(ctx, boss.id, { type: 'reset' });
    expect(roundRules(ctx)).toMatchObject(colonies());
  });

  it('refuse the research with a base of 0, with the owner`s words, and keep the round', () => {
    const { ctx, boss } = admin();
    expect(
      refusal(() =>
        runAction(ctx, boss.id, {
          type: 'reset',
          colonies: colonies({ colonyBase: 0 }),
        }),
      ),
    ).toBe('Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.');
    expect(roundRules(ctx)).toMatchObject({ number: 1, colonyResearch: 0 });
  });

  it('take a base of 0 without the research as no limit, and refuse values out of their range', () => {
    const { ctx, boss } = admin();
    runAction(ctx, boss.id, {
      type: 'reset',
      colonies: colonies({ colonyBase: 0, colonyResearch: 0 }),
    });
    expect(limitOf(ctx, {})).toBeNull();
    expect(
      refusal(() =>
        runAction(ctx, boss.id, {
          type: 'reset',
          colonies: colonies({ colonyBase: 21 }),
        }),
      ),
    ).toBe(
      'Maximale Planeten ohne Forschung (0 = unbegrenzt, der Heimatplanet zählt mit): ganze Zahl von 0 bis 20.',
    );
    expect(
      refusal(() =>
        runAction(ctx, boss.id, {
          type: 'reset',
          colonies: colonies({ colonyPerLevel: 0 }),
        }),
      ),
    ).toBe('Zusätzliche Planeten je Forschungsstufe: ganze Zahl von 1 bis 20.');
  });

  it('change live in the admin panel with the same rule (X1, D1), and remove no planet', () => {
    const { ctx, boss } = admin();
    const settings = { ...universe(ctx), ...EXAMPLE };
    runAction(ctx, boss.id, { type: 'settings', settings });
    expect(roundRules(ctx)).toMatchObject(colonies());
    expect(
      refusal(() =>
        runAction(ctx, boss.id, {
          type: 'settings',
          settings: { ...settings, roundColonyBase: 0 },
        }),
      ),
    ).toBe('Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.');
    expect(roundRules(ctx)).toMatchObject({ colonyBase: 6 });
    // Lowering never deletes a planet.
    expect(ctx.planets.ofOwner(boss.id)).toHaveLength(1);
  });
});
