// The attack union on the server (#225, #466, okf/features/holding-acs.md):
// opening a union from an own Sturmangriff, inviting allies, joining with a
// fleet (who, under which limits, at the fixed arrival X with the speed that
// brings it there, #466), the switch of the round, the recall of the leader
// and of a participant, the one battle of all fleets at the common arrival with
// each owner's research, the loot split by free space, the reports and the
// debris, and the interactions: holding, vacation, noob protection, fleet
// slots, the defender's overview.
import { describe, expect, it } from 'vitest';
import { battleOf } from '../../core/battle.ts';
import { debrisOf } from '../../core/debris.ts';
import {
  capacity,
  countUnits,
  distance,
  fleetSpeed,
  flightMs,
  fuelFor,
} from '../../core/flight.ts';
import type { Fleet } from '../../core/types.ts';
import { seeded } from '../../test/fixtures.ts';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { recall, send } from './fleet-actions.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';
import { arriving, limitsOf, unionOf, unionsFor } from './union.ts';

const ANNA = { g: 1, s: 1, p: 5 };
const BERT = { g: 1, s: 2, p: 6 };
const CORA = { g: 1, s: 3, p: 7 };
const DIRK = { g: 1, s: 4, p: 8 };
const DIRK_ID = 'p1_4_8';

const user = (ctx: TestCtx, name: string) => ctx.players.get(`u_${name}`)!;

/**
 * Anna and Bert share a guild, Cora is a stranger, Dirk is the target. Dirk
 * has ships of his own so that nobody is below the noob protection.
 */
function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { research: { weapons: 3 } });
  addUser(ctx, 'Bert', { research: { weapons: 9, armor: 5 } });
  addUser(ctx, 'Cora');
  addUser(ctx, 'Dirk', { research: { shield: 1 } });
  addUser(ctx, 'Ada', { admin: true });
  addPlanet(ctx, 'u_Anna', {
    ...ANNA,
    name: 'Alpha',
    ships: { lf: 20, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Bert', {
    ...BERT,
    name: 'Beta',
    ships: { lf: 20, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Cora', {
    ...CORA,
    name: 'Gamma',
    ships: { lf: 20, bs: 10 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  addPlanet(ctx, 'u_Dirk', {
    ...DIRK,
    name: 'Delta',
    ships: { lf: 20, bs: 10 },
    res: { m: 10000, c: 6000, d: 2000 },
  });
  ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
  ctx.guilds.apply('u_Bert', 'g1');
  ctx.guilds.accept('u_Bert');
  return ctx;
}

const go = (planet: string, ships: Record<string, number>, over = {}) => ({
  planet,
  mission: 'attack',
  ships,
  to: DIRK,
  pct: 10,
  cargo: {},
  ...over,
});

/** Anna's Sturmangriff on Dirk, and the union it opens: returns the union's ID. */
function opened(ctx: TestCtx, ships: Record<string, number> = { bs: 4 }) {
  send(ctx, user(ctx, 'Anna'), go('p1_1_5', ships));
  const id = ctx.fleets.all()[0]!.id;
  runAction(ctx, 'u_Anna', { type: 'openUnion', id });
  return id;
}

/** Anna invites Bert, and Bert joins with `ships`. */
function joined(ctx: TestCtx, union: string, ships = { bs: 4 }): Fleet {
  runAction(ctx, 'u_Anna', { type: 'inviteUnion', id: union, name: 'Bert' });
  runAction(ctx, 'u_Bert', {
    type: 'send',
    ...go('p1_2_6', ships, { union }),
  });
  return ctx.fleets.all().find((f) => f.owner === 'u_Bert')!;
}

/** Sets the arrival and the return of a fleet: `save` keeps the times a fleet has. */
const retime = (ctx: TestCtx, id: string, arr: number, ret: number): void => {
  ctx.db
    .prepare('UPDATE fleets SET arr = ?, ret = ? WHERE id = ?')
    .run(arr, ret, id);
};

const refused = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return 'not refused';
};

describe('opening a union', () => {
  it('marks the own Sturmangriff on its way as the union and its leader', () => {
    const ctx = setup();
    const id = opened(ctx);
    expect(ctx.fleets.get(id)).toMatchObject({ union: id, owner: 'u_Anna' });
    expect(unionOf(ctx, id)?.fleets.map((f) => f.id)).toEqual([id]);
    expect(ctx.fleets.ofUnion(id)).toHaveLength(1);
  });
  it('refuses another mission, a fleet of somebody else, a fleet that is not out any more, and a second union', () => {
    const ctx = setup();
    send(
      ctx,
      user(ctx, 'Anna'),
      go('p1_1_5', { bs: 2 }, { mission: 'transport' }),
    );
    const transport = ctx.fleets.all()[0]!;
    const open = (id: string, uid = 'u_Anna') =>
      refused(() => runAction(ctx, uid, { type: 'openUnion', id }));
    expect(open(transport.id)).toBe(
      'Einen Angriffsverband eröffnet nur ein Sturmangriff.',
    );
    expect(open('nobody')).toBe('Diese Flotte gibt es nicht.');
    ctx.fleets.delete(transport.id);
    send(ctx, user(ctx, 'Anna'), go('p1_1_5', { bs: 2 }));
    const attack = ctx.fleets.all()[0]!;
    expect(open(attack.id, 'u_Bert')).toBe('Diese Flotte gibt es nicht.');
    expect(open(attack.id)).toBe('not refused');
    expect(open(attack.id)).toBe(
      'Diese Flotte gehört schon zu einem Angriffsverband.',
    );
    ctx.fleets.save({ ...attack, id: 'back', state: 'back' });
    expect(open('back')).toBe(
      'Diese Flotte ist nicht mehr auf dem Weg zum Ziel.',
    );
  });
  it('is refused for a player in vacation like every action', () => {
    const ctx = setup();
    const id = opened(ctx);
    ctx.players.save({ ...user(ctx, 'Anna'), vacation: ctx.now() });
    expect(
      refused(() => runAction(ctx, 'u_Anna', { type: 'openUnion', id })),
    ).toBe('Im Urlaubsmodus nicht möglich.');
  });
});

describe('inviting', () => {
  it('lets the leader invite an ally, who gets an info report', () => {
    const ctx = setup();
    const id = opened(ctx);
    expect(
      runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' }),
    ).toBe('Einladung an Bert gesendet.');
    expect(ctx.fleets.invited(id)).toEqual(['u_Bert']);
    expect(ctx.fleets.invitedTo('u_Bert')).toEqual([id]);
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      {
        type: 'info',
        title: 'Einladung zum Verbandsangriff [1:4:8]',
        text: 'Anna lädt dich zu einem Verbandsangriff auf [1:4:8] ein.',
      },
    ]);
    // Twice is the same invitation.
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    expect(ctx.fleets.invited(id)).toEqual(['u_Bert']);
  });
  it('refuses anyone who is no ally of the leader, with the words of the round', () => {
    const ctx = setup();
    const id = opened(ctx);
    const invite = (name: string, uid = 'u_Anna') =>
      refused(() => runAction(ctx, uid, { type: 'inviteUnion', id, name }));
    expect(invite('Cora')).toBe(
      'Zum Angriffsverband laden nur Gildenmitglieder und Freunde ein.',
    );
    ctx.admin.putSettings([['roundAllies', 1]]);
    expect(invite('Cora')).toBe(
      'Zum Angriffsverband laden nur Gildenmitglieder ein.',
    );
    ctx.admin.putSettings([['roundAllies', 2]]);
    expect(invite('Bert')).toBe('Zum Angriffsverband laden nur Freunde ein.');
    // A friend is invited under „Freunde“ although he is in no guild.
    ctx.friends.request('u_Anna', 'u_Cora');
    ctx.friends.accept('u_Anna', 'u_Cora');
    expect(invite('Cora')).toBe('not refused');
    expect(ctx.fleets.invited(ctx.fleets.all()[0]!.id)).toEqual(['u_Cora']);
  });
  it('refuses the others in the union, yourself, the defender, an unknown player and a union that is gone', () => {
    const ctx = setup();
    const id = opened(ctx);
    ctx.guilds.apply('u_Dirk', 'g1');
    ctx.guilds.accept('u_Dirk');
    const invite = (name: string, uid = 'u_Anna', union = id) =>
      refused(() =>
        runAction(ctx, uid, { type: 'inviteUnion', id: union, name }),
      );
    expect(invite('Bert', 'u_Bert')).toBe(
      'Nur der Anführer lädt zum Angriffsverband ein.',
    );
    expect(invite('Anna')).toBe('Das bist du selbst.');
    expect(invite('Dirk')).toBe(
      'Der Verteidiger kann nicht eingeladen werden.',
    );
    expect(invite('Nobody')).toBe('Spieler nicht gefunden.');
    expect(invite('Bert', 'u_Anna', 'gone')).toBe(
      'Diesen Angriffsverband gibt es nicht mehr.',
    );
  });
  it('counts the invited against the limit of players of the round', () => {
    const ctx = setup();
    ctx.admin.putSettings([['roundUnionPlayers', 2]]);
    ctx.guilds.apply('u_Cora', 'g1');
    ctx.guilds.accept('u_Cora');
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    expect(
      refused(() =>
        runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Cora' }),
      ),
    ).toBe('Am Angriffsverband können höchstens 2 Spieler teilnehmen.');
  });
});

describe('joining with a fleet', () => {
  it('arrives with the union: the fleet waits and keeps its own flight back', () => {
    const ctx = setup();
    const id = opened(ctx);
    const lead = ctx.fleets.get(id)!;
    const bert = joined(ctx, id);
    expect(bert).toMatchObject({
      mission: 'attack',
      union: id,
      to: DIRK_ID,
      state: 'out',
      arr: lead.arr,
    });
    // It flies as long as its own flight takes and fuels for it.
    expect(bert.ret).toBeGreaterThan(bert.arr);
    expect(bert.fuel).toBeGreaterThan(0);
    expect(ctx.planets.home('u_Bert')!.ships).toMatchObject({ bs: 6 });
    expect(ctx.fleets.get(id)!.arr).toBe(lead.arr);
    expect(ctx.fleets.ofUnion(id).map((f) => f.owner)).toEqual([
      'u_Anna',
      'u_Bert',
    ]);
  });
  it('is possible for the leader with another fleet too', () => {
    const ctx = setup();
    ctx.players.save({ ...user(ctx, 'Anna'), research: { computer: 2 } });
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', {
      type: 'send',
      ...go('p1_1_5', { lf: 3 }, { union: id }),
    });
    expect(ctx.fleets.ofUnion(id).map((f) => f.owner)).toEqual([
      'u_Anna',
      'u_Anna',
    ]);
  });
  it('needs an invitation, and the leader as an ally', () => {
    const ctx = setup();
    const id = opened(ctx);
    const join = (uid: string, planet: string) =>
      refused(() =>
        runAction(ctx, uid, {
          type: 'send',
          ...go(planet, { bs: 2 }, { union: id }),
        }),
      );
    expect(join('u_Bert', 'p1_2_6')).toBe(
      'Du bist nicht zu diesem Angriffsverband eingeladen.',
    );
    // Cora is no ally: refused before the invitation counts, also when invited by hand.
    ctx.fleets.invite(id, 'u_Cora');
    expect(join('u_Cora', 'p1_3_7')).toBe(
      'Dem Angriffsverband treten nur Gildenmitglieder und Freunde des Anführers bei.',
    );
    // An invited player who is no ally of the leader any more cannot join.
    ctx.fleets.invite(id, 'u_Bert');
    ctx.admin.putSettings([['roundAllies', 2]]);
    expect(join('u_Bert', 'p1_2_6')).toBe(
      'Dem Angriffsverband treten nur Freunde des Anführers bei.',
    );
    ctx.admin.putSettings([['roundAllies', 1]]);
    expect(join('u_Bert', 'p1_2_6')).toBe('not refused');
  });
  it('takes a Sturmangriff to the same target only, in a union that is alive', () => {
    const ctx = setup();
    const id = opened(ctx);
    ctx.fleets.invite(id, 'u_Bert');
    const join = (over: Record<string, unknown>, union: unknown = id) =>
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union, ...over }),
        }),
      );
    expect(join({ mission: 'transport' })).toBe(
      'Einem Angriffsverband schließt man sich mit einem Sturmangriff an.',
    );
    expect(join({ to: CORA })).toBe('Der Angriffsverband fliegt nach [1:4:8].');
    expect(join({}, 'gone')).toBe('Diesen Angriffsverband gibt es nicht mehr.');
    expect(join({})).toBe('not refused');
  });
  it('keeps the checks of every attack: ships, fuel and the fleet slots', () => {
    const ctx = setup();
    const id = opened(ctx);
    ctx.fleets.invite(id, 'u_Bert');
    // One slot, used by another mission of Bert's.
    send(
      ctx,
      user(ctx, 'Bert'),
      go('p1_2_6', { lf: 1 }, { mission: 'transport', to: CORA }),
    );
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Alle Flottenslots belegt.');
    // A fleet of the union takes the slot of its owner like any fleet.
    ctx.fleets.delete(
      ctx.fleets.all().find((f) => f.mission === 'transport')!.id,
    );
    runAction(ctx, 'u_Bert', {
      type: 'send',
      ...go('p1_2_6', { bs: 1 }, { union: id }),
    });
    expect(ctx.fleets.count('u_Bert')).toBe(1);
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Alle Flottenslots belegt.');
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', {}, { union: id }),
        }),
      ),
    ).toBe('Keine Schiffe ausgewählt.');
  });
  it('refuses the 17th fleet, and a 6th player, by the limits of the round', () => {
    const ctx = setup();
    ctx.admin.putSettings([['roundUnionFleets', 2]]);
    const id = opened(ctx);
    ctx.fleets.invite(id, 'u_Bert');
    expect(joined(ctx, id)).toMatchObject({ owner: 'u_Bert' });
    ctx.players.save({ ...user(ctx, 'Bert'), research: { computer: 3 } });
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Am Angriffsverband nehmen bereits 2 Flotten teil.');
    expect(limitsOf(ctx)).toEqual({ fleets: 2, players: 5, cutoff: 0 });
    ctx.admin.putSettings([
      ['roundUnionFleets', 16],
      ['roundUnionPlayers', 1],
    ]);
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('not refused');
    // Bert is one player and the limit 1 counts the leader, but a second fleet of a member needs no place.
  });
  it('refuses a sixth player: the default allows five', () => {
    const ctx = setup();
    expect(roundRules(ctx)).toMatchObject({ unionFleets: 16, unionPlayers: 5 });
    ctx.admin.putSettings([['roundUnionPlayers', 1]]);
    const id = opened(ctx);
    ctx.fleets.invite(id, 'u_Bert');
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Am Angriffsverband nehmen bereits 1 Spieler teil.');
  });
});

describe('the arrival of a fleet that joins (#466, 7b)', () => {
  /** Bert's flight to Dirk with four Kampfschiffe at a speed in tenths. */
  const bertFlight = (ctx: TestCtx, pct: number): number =>
    flightMs(
      distance(BERT, DIRK),
      fleetSpeed({ bs: 4 }, { research: user(ctx, 'Bert').research }),
      pct,
      ctx.admin.universe(),
    );
  /** Anna's union arrives `left` ms from now when Bert, invited, joins. */
  function union(left: number, settings: [string, number][] = []) {
    const ctx = setup();
    ctx.admin.putSettings(settings);
    const t = ctx.now();
    send(ctx, user(ctx, 'Anna'), go('p1_1_5', { bs: 4 }));
    const lead = ctx.fleets.all()[0]!;
    const flight = lead.ret - lead.arr;
    retime(ctx, lead.id, t + left, t + left + flight);
    runAction(ctx, 'u_Anna', { type: 'openUnion', id: lead.id });
    runAction(ctx, 'u_Anna', {
      type: 'inviteUnion',
      id: lead.id,
      name: 'Bert',
    });
    const join = () =>
      runAction(ctx, 'u_Bert', {
        type: 'send',
        ...go('p1_2_6', { bs: 4 }, { union: lead.id, pct: 10 }),
      });
    return { ctx, id: lead.id, arr: t + left, join, t };
  }
  it('starts now and arrives exactly at X, the speed solved and the fuel of that speed', () => {
    const probe = setup();
    const fast = bertFlight(probe, 10);
    const slow = bertFlight(probe, 1);
    const left = Math.round((fast + slow) / 2);
    const { ctx, arr, join, t } = union(left);
    const before = ctx.planets.get('p1_2_6')!.res.d;
    join();
    const bert = ctx.fleets.all().find((f) => f.owner === 'u_Bert')!;
    expect(bert).toMatchObject({
      dep: t,
      arr,
      ret: arr + left,
      union: bert.union,
    });
    // The speed between the steps that makes the flight the time left.
    const speed = fleetSpeed(
      { bs: 4 },
      { research: user(ctx, 'Bert').research },
    );
    const pct =
      (35000 * Math.sqrt((10 * distance(BERT, DIRK)) / speed)) /
      ((left * ctx.admin.universe().speed) / 1000 - 10);
    expect(pct).toBeGreaterThan(1);
    expect(pct).toBeLessThan(10);
    expect(bert.fuel).toBe(fuelFor({ bs: 4 }, distance(BERT, DIRK), pct));
    expect(ctx.planets.get('p1_2_6')!.res.d).toBe(before - bert.fuel);
    // The leader's fleet keeps its arrival: X never moves.
    expect(ctx.fleets.all().find((f) => f.owner === 'u_Anna')!.arr).toBe(arr);
  });
  it('takes the bounds inside: the time at 100 % and at 10 % exactly', () => {
    const probe = setup();
    for (const left of [bertFlight(probe, 10), bertFlight(probe, 1)]) {
      const { ctx, arr, join } = union(left);
      join();
      expect(ctx.fleets.all().find((f) => f.owner === 'u_Bert')!.arr).toBe(arr);
    }
  });
  it('refuses a fleet too early even at 10 %, naming the earliest start, and spends nothing', () => {
    const probe = setup();
    const slow = bertFlight(probe, 1);
    const { ctx, arr, join } = union(slow + 3_600_000);
    const res = { ...ctx.planets.get('p1_2_6')!.res };
    const earliest = new Date(Math.ceil((arr - slow) / 1000) * 1000);
    const words = earliest.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(refused(join)).toBe(
      `Deine Flotte wäre selbst mit 10 % zu früh da. Schicke sie frühestens am ${words} los.`,
    );
    expect(ctx.fleets.all()).toHaveLength(1);
    expect(ctx.planets.get('p1_2_6')!.res).toEqual(res);
  });
  it('refuses a fleet too late even at 100 %', () => {
    const probe = setup();
    const { ctx, join } = union(bertFlight(probe, 10) - 1);
    expect(refused(join)).toBe(
      'Deine Flotte erreicht das Ziel selbst mit 100 % nicht bis zur Ankunft des Verbands.',
    );
    expect(ctx.fleets.all()).toHaveLength(1);
  });
  it('closes the union in the last minutes only when the round has a cut-off, default none', () => {
    const probe = setup();
    const left = 2 * bertFlight(probe, 10);
    expect(roundRules(probe).unionCutoff).toBe(0);
    const open = union(left);
    open.join();
    expect(open.ctx.fleets.all()).toHaveLength(2);
    const closed = union(left, [['roundUnionCutoff', 1440]]);
    expect(refused(closed.join)).toBe(
      'In den letzten 1440 Minuten vor der Ankunft tritt niemand mehr bei.',
    );
  });
  it('refuses a union that has arrived', () => {
    const { ctx, arr, join } = union(10_000);
    // The arrival is due: the tick of the action settles it, so the union is gone.
    ctx.clock.t = arr;
    expect(refused(join)).toBe('Diesen Angriffsverband gibt es nicht mehr.');
  });
});

describe('the switch „Verbandsangriff“ (#466, 4)', () => {
  const OFF = 'Verbandsangriffe sind in dieser Runde abgeschaltet.';
  const off = (ctx: TestCtx) => ctx.admin.putSettings([['roundUnionOn', 0]]);
  it('is on by default; off, nobody opens a union', () => {
    const ctx = setup();
    expect(roundRules(ctx).unionOn).toBe(1);
    send(ctx, user(ctx, 'Anna'), go('p1_1_5', { bs: 2 }));
    const attack = ctx.fleets.all()[0]!;
    off(ctx);
    expect(
      refused(() =>
        runAction(ctx, 'u_Anna', { type: 'openUnion', id: attack.id }),
      ),
    ).toBe(OFF);
    expect(ctx.unions.get(attack.id)).toBeNull();
  });
  it('off, nobody invites or joins; the recall of an own fleet still works', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    off(ctx);
    expect(
      refused(() =>
        runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Cora' }),
      ),
    ).toBe(OFF);
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 2 }, { union: id }),
        }),
      ),
    ).toBe(OFF);
    ctx.clock.t += 1;
    expect(recall(ctx, user(ctx, 'Anna'), { id })).toBe(
      'Flotte zurückgerufen.',
    );
    expect(ctx.unions.get(id)).toBeNull();
  });
  it('off, a union in flight arrives as one battle', () => {
    const ctx = setup();
    const id = opened(ctx);
    const bert = joined(ctx, id);
    off(ctx);
    ctx.clock.t = ctx.fleets.get(id)!.arr;
    tick(ctx);
    const battle = ctx.reports
      .ofPlayer('u_Bert')
      .filter((r) => r.type === 'battle');
    expect(battle).toHaveLength(1);
    expect(battle[0]).toMatchObject({
      attName: 'Anna',
      attackers: [{ name: 'Bert' }],
    });
    expect(ctx.fleets.get(bert.id)?.union).toBeUndefined();
  });
});

describe('the recall', () => {
  it('of the leader turns back every fleet of the union and ends it', () => {
    const ctx = setup();
    const id = opened(ctx);
    const bert = joined(ctx, id);
    ctx.clock.t += 1000;
    runAction(ctx, 'u_Anna', { type: 'recall', id });
    for (const f of ctx.fleets.all()) {
      expect(f).toMatchObject({ state: 'back', recalled: true });
      expect(f.union).toBeUndefined();
    }
    expect(ctx.fleets.get(bert.id)!.ret).toBe(ctx.now() + 1000);
    expect(ctx.fleets.invited(id)).toEqual([]);
    expect(unionsFor(ctx, 'u_Bert')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bert').map((r) => r.title)).toContain(
      'Angriffsverband aufgelöst [1:4:8]',
    );
    // The leader needs no report of his own recall.
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.title)).not.toContain(
      'Angriffsverband aufgelöst [1:4:8]',
    );
  });
  it('of a participant turns back only his fleet; the union flies on', () => {
    const ctx = setup();
    const id = opened(ctx);
    const bert = joined(ctx, id);
    const arr = ctx.fleets.get(id)!.arr;
    ctx.clock.t += 1000;
    runAction(ctx, 'u_Bert', { type: 'recall', id: bert.id });
    expect(ctx.fleets.get(bert.id)).toMatchObject({
      state: 'back',
      recalled: true,
    });
    expect(ctx.fleets.get(bert.id)!.union).toBeUndefined();
    expect(ctx.fleets.get(id)).toMatchObject({ state: 'out', union: id, arr });
    // He is invited still and may join again.
    expect(ctx.fleets.invited(id)).toEqual(['u_Bert']);
  });
  it('is an ordinary recall for a fleet of no union', () => {
    const ctx = setup();
    send(ctx, user(ctx, 'Anna'), go('p1_1_5', { bs: 2 }));
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t += 500;
    expect(recall(ctx, user(ctx, 'Anna'), { id: f.id })).toBe(
      'Flotte zurückgerufen.',
    );
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      ret: ctx.now() + 500,
    });
  });
});

/** Both fleets of a union at the target now: Anna leads, Bert follows; both ready to arrive. */
function arrived(
  ctx: TestCtx,
  annaShips: Record<string, number>,
  bertShips: Record<string, number>,
  cargo = { m: 0, c: 0, d: 0 },
) {
  const lead: Fleet = {
    id: 'lead',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: ANNA,
    to: DIRK_ID,
    toC: DIRK,
    mission: 'attack',
    ships: annaShips,
    cargo,
    dep: ctx.now() - 1000,
    arr: ctx.now() + 1000,
    ret: ctx.now() + 2000,
    state: 'out',
    recalled: false,
    fuel: 1,
    union: 'lead',
  };
  const bert: Fleet = {
    ...lead,
    id: 'bert',
    owner: 'u_Bert',
    from: 'p1_2_6',
    fromC: BERT,
    ships: bertShips,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 900,
    union: 'lead',
  };
  ctx.unions.save({
    id: 'lead',
    leader: 'u_Anna',
    lead: 'lead',
    target: DIRK_ID,
    toC: DIRK,
    arr: lead.arr,
  });
  ctx.fleets.save(lead);
  ctx.fleets.save(bert);
  ctx.fleets.invite('lead', 'u_Bert');
  ctx.clock.t += 1000;
  return { lead, bert };
}

describe('the battle of the union', () => {
  it('is one battle of both fleets as two attackers, each with the research of its owner', () => {
    const ctx = setup();
    const dirk = ctx.planets.get(DIRK_ID)!;
    const { lead, bert } = arrived(ctx, { bs: 6, lf: 5 }, { bs: 4, cr: 2 });
    const wanted = battleOf(
      [
        { units: lead.ships, tech: { weapons: 3, shield: 0, armor: 0 } },
        { units: bert.ships, tech: { weapons: 9, shield: 0, armor: 5 } },
      ],
      [{ units: dirk.ships, tech: { weapons: 0, shield: 1, armor: 0 } }],
      seeded(42),
    );
    tick(ctx);
    const [report] = ctx.reports.ofPlayer('u_Anna');
    expect(report).toMatchObject({
      type: 'battle',
      title: expect.stringContaining('Kampfbericht [1:4:8]'),
      participants: ['u_Anna', 'u_Bert', 'u_Dirk'],
      attName: 'Anna',
      attBefore: lead.ships,
      attAfter: wanted.att[0],
      attTech: { weapons: 3, shield: 0, armor: 0 },
      attackers: [
        {
          name: 'Bert',
          before: bert.ships,
          after: wanted.att[1],
          tech: { weapons: 9, shield: 0, armor: 5 },
        },
      ],
      defAfter: wanted.def[0],
      winner: wanted.winner,
      rounds: wanted.rounds,
    });
    // Exactly one battle: one audit entry, one report per player.
    const battles = ctx.db
      .prepare("SELECT detail FROM audit_events WHERE action = 'battle'")
      .all();
    expect(battles).toHaveLength(1);
    expect(JSON.parse((battles[0] as { detail: string }).detail)).toMatchObject(
      {
        fleet: 'lead',
        union: ['bert'],
      },
    );
    for (const name of ['Anna', 'Bert', 'Dirk'])
      expect(
        ctx.reports.ofPlayer(`u_${name}`).filter((r) => r.type === 'battle'),
      ).toHaveLength(1);
  });
  it('gives each attacker the same report, titled by the result, and the defender the report of the defender with all names', () => {
    const ctx = setup();
    arrived(ctx, { bs: 6 }, { bs: 4 });
    tick(ctx);
    const anna = ctx.reports.ofPlayer('u_Anna')[0]!;
    const bert = ctx.reports.ofPlayer('u_Bert')[0]!;
    const dirk = ctx.reports.ofPlayer('u_Dirk')[0]!;
    expect(bert.title).toBe(anna.title);
    expect(anna.title).toMatch(
      /^Kampfbericht \[1:4:8\] – (gewonnen|verloren|unentschieden)$/,
    );
    expect(dirk.title).toBe(
      'Feindkontakt! Delta [1:4:8] wird von Anna und Bert angegriffen',
    );
    expect({ ...bert, id: '', title: '' }).toEqual({
      ...anna,
      id: '',
      title: '',
    });
  });
  it('names every attacker in the report of the defender: a, b und c', () => {
    const ctx = setup();
    const { bert } = arrived(ctx, { bs: 6 }, { bs: 4 });
    ctx.fleets.save({
      ...bert,
      id: 'cora',
      owner: 'u_Cora',
      from: 'p1_3_7',
      fromC: CORA,
      dep: bert.dep + 1,
    });
    ctx.fleets.save({
      ...bert,
      id: 'bert2',
      dep: bert.dep + 2,
      ships: { bs: 1 },
    });
    tick(ctx);
    expect(ctx.reports.ofPlayer('u_Dirk')[0]!.title).toBe(
      'Feindkontakt! Delta [1:4:8] wird von Anna, Bert und Cora angegriffen',
    );
    // A player with two fleets has one report and is named once.
    expect(
      ctx.reports.ofPlayer('u_Bert').filter((r) => r.type === 'battle'),
    ).toHaveLength(1);
    expect(
      (ctx.reports.ofPlayer('u_Anna')[0]!.attackers as unknown[]).length,
    ).toBe(3);
  });
  it('leaves the debris of the ships every side lost', () => {
    const ctx = setup();
    const { lead, bert } = arrived(ctx, { lf: 8 }, { lf: 8 });
    tick(ctx);
    const r = ctx.reports.ofPlayer('u_Anna')[0] as unknown as {
      attAfter: Record<string, number>;
      attackers: { after: Record<string, number> }[];
      defBefore: Record<string, number>;
      defAfter: Record<string, number>;
    };
    const wanted = debrisOf([
      { before: lead.ships, after: r.attAfter },
      { before: bert.ships, after: r.attackers[0]!.after },
      { before: r.defBefore, after: r.defAfter },
    ]);
    expect(wanted.m + wanted.c).toBeGreaterThan(0);
    expect(ctx.debris.get('d1_4_8')).toMatchObject({
      m: wanted.m,
      c: wanted.c,
    });
  });
  it('sends every fleet home with its own survivors; a fleet without survivors is gone', () => {
    const ctx = setup();
    const { lead, bert } = arrived(ctx, { lf: 1 }, { bs: 20 });
    ctx.planets.save({ ...ctx.planets.get(DIRK_ID)!, ships: { bs: 10 } });
    tick(ctx);
    const r = ctx.reports.ofPlayer('u_Anna')[0] as unknown as {
      attAfter: Record<string, number>;
      attackers: { after: Record<string, number> }[];
    };
    expect(countUnits(r.attAfter)).toBe(0);
    expect(ctx.fleets.get(lead.id)).toBeNull();
    expect(ctx.fleets.get(bert.id)).toMatchObject({
      state: 'back',
      ships: r.attackers[0]!.after,
      ret: bert.ret,
    });
    expect(ctx.fleets.get(bert.id)!.union).toBeUndefined();
    expect(ctx.fleets.invited('lead')).toEqual([]);
  });
  it('splits the loot by free cargo space, each fleet keeping the cargo it had', () => {
    const ctx = setup();
    ctx.planets.save({
      ...ctx.planets.get(DIRK_ID)!,
      ships: {},
      def: {},
      res: { m: 6000, c: 3000, d: 0 },
    });
    // The leader's holds are a third full, so both have the same space left.
    const { lead, bert } = arrived(
      ctx,
      { lc: 4 },
      { lc: 3 },
      { m: 0, c: 0, d: capacity({ lc: 1 }) },
    );
    expect(capacity(lead.ships) - capacity({ lc: 1 })).toBe(
      capacity(bert.ships),
    );
    tick(ctx);
    const a = ctx.fleets.get(lead.id)!;
    const b = ctx.fleets.get(bert.id)!;
    expect(a.cargo).toEqual({ m: 1500, c: 750, d: capacity({ lc: 1 }) });
    expect(b.cargo).toEqual({ m: 1500, c: 750, d: 0 });
    const r = ctx.reports.ofPlayer('u_Bert')[0] as unknown as {
      loot: unknown;
      attLoot: unknown;
      attackers: { loot: unknown }[];
    };
    expect(r.loot).toEqual({ m: 3000, c: 1500, d: 0 });
    expect(r.attLoot).toEqual({ m: 1500, c: 750, d: 0 });
    expect(r.attackers[0]!.loot).toEqual({ m: 1500, c: 750, d: 0 });
    const left = ctx.planets.get(DIRK_ID)!.res;
    expect([Math.floor(left.m), Math.floor(left.c)]).toEqual([3000, 1500]);
  });
  it('takes no more loot than all the holds carry together', () => {
    const ctx = setup();
    ctx.planets.save({
      ...ctx.planets.get(DIRK_ID)!,
      ships: {},
      def: {},
      res: { m: 1e6, c: 1e6, d: 1e6 },
    });
    const { lead, bert } = arrived(ctx, { lc: 1 }, { lc: 1 });
    tick(ctx);
    const carried = (f: Fleet) => f.cargo.m + f.cargo.c + f.cargo.d;
    const a = ctx.fleets.get(lead.id)!;
    const b = ctx.fleets.get(bert.id)!;
    expect(carried(a)).toBeLessThanOrEqual(capacity(lead.ships));
    expect(carried(b)).toBeLessThanOrEqual(capacity(bert.ships));
    expect(carried(a) + carried(b)).toBe(
      capacity(lead.ships) + capacity(bert.ships),
    );
  });
  it('settles once: a second tick and the fleet of the union that comes later change nothing', () => {
    const ctx = setup();
    arrived(ctx, { bs: 6 }, { bs: 4 });
    tick(ctx);
    const snapshot = JSON.stringify([
      ctx.fleets.all(),
      ctx.planets.all(),
      ctx.reports.ofPlayer('u_Anna'),
      ctx.reports.ofPlayer('u_Bert'),
      ctx.reports.ofPlayer('u_Dirk'),
      ctx.debris.all(),
    ]);
    tick(ctx);
    tick(ctx);
    expect(
      JSON.stringify([
        ctx.fleets.all(),
        ctx.planets.all(),
        ctx.reports.ofPlayer('u_Anna'),
        ctx.reports.ofPlayer('u_Bert'),
        ctx.reports.ofPlayer('u_Dirk'),
        ctx.debris.all(),
      ]),
    ).toBe(snapshot);
  });
  it('comes home in the next tick when the server was late and the return is due already', () => {
    const ctx = setup();
    const { lead } = arrived(ctx, { bs: 60 }, { bs: 40 });
    ctx.clock.t = lead.ret + 10;
    tick(ctx);
    // The first fleet of the tick fought for all; the one that was due first
    // comes home with the next tick, like any fleet after its arrival.
    tick(ctx);
    expect(ctx.fleets.all()).toEqual([]);
    for (const owner of ['u_Anna', 'u_Bert'])
      expect(
        ctx.reports
          .ofPlayer(owner)
          .map((r) => r.type)
          .sort(),
      ).toEqual(['battle', 'info']);
  });
  it('lets a fleet whose union is gone attack alone, as a Sturmangriff', () => {
    const ctx = setup();
    const { bert } = arrived(ctx, { bs: 6 }, { bs: 4 });
    // A fleet whose union has no row (#466: its leading fleet was gone when
    // the unions moved into rows) arrives alone.
    ctx.fleets.delete('lead');
    ctx.unions.delete('lead');
    ctx.fleets.save(bert);
    expect(arriving(ctx, ctx.fleets.get('bert')!)).toBeNull();
    ctx.fleets.save({ ...bert, union: 'lead' });
    tick(ctx);
    const r = ctx.reports.ofPlayer('u_Bert')[0]!;
    expect(r).toMatchObject({
      attName: 'Bert',
      participants: ['u_Bert', 'u_Dirk'],
    });
    expect(r.attackers).toBeUndefined();
  });
  it("turns a fleet of the target's own owner back instead of letting him attack himself", () => {
    const ctx = setup();
    arrived(ctx, { bs: 6 }, { bs: 4 });
    ctx.fleets.save({
      ...ctx.fleets.get('bert')!,
      id: 'dirks',
      owner: 'u_Dirk',
      from: DIRK_ID,
      fromC: DIRK,
      union: 'lead',
    });
    tick(ctx);
    expect(ctx.fleets.get('dirks')).toMatchObject({
      state: 'back',
      ships: { bs: 4 },
    });
    // It turned back before the battle and takes no part in it, whichever fleet is due first.
    expect(ctx.reports.ofPlayer('u_Dirk')[0]).toMatchObject({
      participants: ['u_Anna', 'u_Bert', 'u_Dirk'],
      attackers: [{ name: 'Bert' }],
    });
    expect(ctx.fleets.ofUnion('lead')).toEqual([]);
  });
});

describe('with holding (#55)', () => {
  const holder = (
    owner: string,
    id: string,
    ships: Record<string, number>,
  ): Fleet => ({
    id,
    owner,
    from: 'p1_3_7',
    fromC: CORA,
    to: DIRK_ID,
    toC: DIRK,
    mission: 'hold',
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: 1,
    arr: 2,
    ret: 1e9,
    state: 'hold',
    recalled: false,
    fuel: 1,
    hold: 1e9,
  });
  it('lets the fleets that hold at the target defend against the whole union, one party each', () => {
    const ctx = setup();
    arrived(ctx, { bs: 6 }, { bs: 4 });
    ctx.fleets.save(holder('u_Cora', 'h_cora', { bs: 3 }));
    tick(ctx);
    const r = ctx.reports.ofPlayer('u_Cora')[0] as unknown as {
      participants: string[];
      held: { name: string; before: unknown }[];
      attackers: unknown[];
    };
    expect(r.participants).toEqual(['u_Anna', 'u_Bert', 'u_Dirk', 'u_Cora']);
    expect(r.held).toMatchObject([{ name: 'Cora', before: { bs: 3 } }]);
    expect(r.attackers).toHaveLength(1);
  });
  it('keeps the own fleet of every member of the union that holds at the target out of the battle', () => {
    const ctx = setup();
    arrived(ctx, { bs: 6 }, { bs: 4 });
    ctx.fleets.save(holder('u_Anna', 'h_anna', { bs: 3 }));
    ctx.fleets.save(holder('u_Bert', 'h_bert', { bs: 2 }));
    tick(ctx);
    expect(ctx.fleets.get('h_anna')).toMatchObject({
      state: 'hold',
      ships: { bs: 3 },
    });
    expect(ctx.fleets.get('h_bert')).toMatchObject({
      state: 'hold',
      ships: { bs: 2 },
    });
    const r = ctx.reports.ofPlayer('u_Anna')[0]!;
    expect(r.held).toBeUndefined();
    expect(r.participants).toEqual(['u_Anna', 'u_Bert', 'u_Dirk']);
  });
});

describe('with vacation (#223) and the noob protection', () => {
  it('refuses to join for a player in vacation, whatever the union (the lock of every action)', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    runAction(ctx, 'u_Bert', { type: 'startVacation' });
    expect(user(ctx, 'Bert').vacation).not.toBeNull();
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Im Urlaubsmodus nicht möglich.');
    expect(ctx.fleets.ofUnion(id)).toHaveLength(1);
  });
  it('refuses an attack on a player in vacation, so no union can be opened there, and a join after the target went away', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    // The target starts the vacation after the launch (he has no fleet out).
    runAction(ctx, 'u_Dirk', { type: 'startVacation' });
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Dieser Spieler ist im Urlaubsmodus.');
    expect(
      refused(() => send(ctx, user(ctx, 'Anna'), go('p1_1_5', { lf: 1 }))),
    ).toBe('Alle Flottenslots belegt.');
    ctx.fleets.delete(id);
    expect(
      refused(() => send(ctx, user(ctx, 'Anna'), go('p1_1_5', { lf: 1 }))),
    ).toBe('Dieser Spieler ist im Urlaubsmodus.');
  });
  it('checks the noob protection of the target for every attacker: a strong player cannot join an attack on a weak one', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    // Bert becomes more than five times as strong as Dirk and Anna.
    const bertHome = ctx.planets.get('p1_2_6')!;
    ctx.planets.save({ ...bertHome, ships: { ...bertHome.ships, bs: 5000 } });
    expect(
      refused(() =>
        runAction(ctx, 'u_Bert', {
          type: 'send',
          ...go('p1_2_6', { bs: 1 }, { union: id }),
        }),
      ),
    ).toBe('Dieser Spieler steht unter Noobschutz.');
  });
});

describe('the state', () => {
  it('shows the union to its leader, its members and the invited, and nobody else', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    const view = (name: string) =>
      (stateFor(ctx, user(ctx, name)) as { unions: unknown[] }).unions;
    const lead = ctx.fleets.get(id)!;
    const wanted = {
      id,
      leader: 'u_Anna',
      to: DIRK_ID,
      toC: DIRK,
      arr: lead.arr,
      fleets: [{ id, owner: 'u_Anna' }],
      invited: ['u_Bert'],
    };
    expect(view('Anna')).toEqual([wanted]);
    expect(view('Bert')).toEqual([wanted]);
    expect(view('Cora')).toEqual([]);
    // The defender sees every fleet as before and nothing of the union.
    expect(view('Dirk')).toEqual([]);
    runAction(ctx, 'u_Bert', {
      type: 'send',
      ...go('p1_2_6', { bs: 2 }, { union: id }),
    });
    const bert = ctx.fleets.all().find((f) => f.owner === 'u_Bert')!;
    expect(view('Bert')).toEqual([
      {
        ...wanted,
        fleets: [
          { id, owner: 'u_Anna' },
          { id: bert.id, owner: 'u_Bert' },
        ],
        invited: [],
      },
    ]);
  });
  it('shows the defender each fleet as today, without a union', () => {
    const ctx = setup();
    const id = opened(ctx);
    joined(ctx, id);
    const dirk = stateFor(ctx, user(ctx, 'Dirk'), DIRK_ID) as {
      fleets: Record<string, unknown>[];
    };
    expect(dirk.fleets.map((f) => f.owner).sort()).toEqual([
      'u_Anna',
      'u_Bert',
    ]);
    for (const f of dirk.fleets) {
      expect(f).not.toHaveProperty('union');
      expect(f).toMatchObject({ mission: 'attack', state: 'out' });
    }
    // The own fleet of the leader carries the ID of its union.
    const anna = stateFor(ctx, user(ctx, 'Anna')) as { fleets: Fleet[] };
    expect(anna.fleets[0]).toMatchObject({ union: id });
  });
  it('forgets a union at its arrival X, the sweep deletes one no fleet reached, and a new round forgets every union', () => {
    const ctx = setup();
    const id = opened(ctx);
    runAction(ctx, 'u_Anna', { type: 'inviteUnion', id, name: 'Bert' });
    const arr = ctx.unions.get(id)!.arr;
    ctx.fleets.delete(id);
    // Its row lives until X (#466): its fleet is no condition any more.
    expect(unionsFor(ctx, 'u_Bert').map((u) => u.id)).toEqual([id]);
    expect(ctx.unions.purge(ctx.now())).toBe(0);
    ctx.clock.t = arr;
    expect(unionsFor(ctx, 'u_Bert')).toEqual([]);
    expect(unionsFor(ctx, 'u_Anna')).toEqual([]);
    // No fleet is out: the sweep deletes the row and its invitations.
    expect(ctx.unions.purge(ctx.now())).toBe(1);
    expect(ctx.unions.get(id)).toBeNull();
    expect(ctx.fleets.invitedTo('u_Bert')).toEqual([]);
    const next = opened(ctx);
    ctx.fleets.invite(next, 'u_Bert');
    runAction(ctx, 'u_Ada', {
      type: 'reset',
      rewards: { achievements: true, daily: true },
    });
    expect(ctx.fleets.invitedTo('u_Bert')).toEqual([]);
    expect(ctx.unions.get(next)).toBeNull();
    expect(ctx.fleets.all()).toEqual([]);
  });
  it('keeps a union whose fleets are still out past X for the tick, and leads it by the leader', () => {
    const ctx = setup();
    const id = opened(ctx);
    joined(ctx, id);
    ctx.clock.t = ctx.unions.get(id)!.arr + 1;
    // The tick has not run yet: the sweep keeps the union for the arrival.
    expect(ctx.unions.purge(ctx.now())).toBe(0);
    tick(ctx);
    expect(ctx.unions.get(id)).toBeNull();
    const [report] = ctx.reports
      .ofPlayer('u_Bert')
      .filter((r) => r.type === 'battle');
    expect(report).toMatchObject({ attName: 'Anna' });
  });
});
