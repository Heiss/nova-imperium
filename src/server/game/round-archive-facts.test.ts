// What the archive reads of the game at the cutoff (#235): the places without
// empty levels, the economy of every resource, the vacation, the seats in
// order, the members of each guild, and the checks of a complete archive.
import { describe, expect, it } from 'vitest';
import { production } from '../../core/economy.ts';
import { settle, settleR } from '../../core/settle.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { universe } from './context.ts';
import { closeActiveRound, ROUND_EVENT, roundFacts } from './round-archive.ts';

const finalOf = (ctx: TestCtx, name: string) =>
  roundFacts(ctx).players.find((p) => p.user.name === name)!.final;

describe('the final state of a participant', () => {
  it('holds only the levels above zero: places, research and the fleets on the way', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna', { research: { energy: 3, laser: 0 } });
    addPlanet(ctx, anna.id, {
      g: 1,
      s: 1,
      p: 2,
      b: { metal: 4, crystal: 0 },
      ships: { lc: 2, lf: 0 },
      def: { rocket: 0, gauss: 1 },
    });
    ctx.fleets.save({
      id: 'f1',
      owner: anna.id,
      from: 'p1_1_2',
      fromC: { g: 1, s: 1, p: 2 },
      to: 'p1_1_9',
      toC: { g: 1, s: 1, p: 9 },
      mission: 'transport',
      ships: { lc: 1, hc: 0 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: 0,
      arr: 9e12,
      ret: 9e12,
      state: 'out',
      recalled: false,
      fuel: 0,
    });
    const final = finalOf(ctx, 'Anna');
    expect(final.research).toEqual({ energy: 3 });
    expect(final.places[0]).toMatchObject({
      b: { metal: 4 },
      ships: { lc: 2 },
      def: { gauss: 1 },
    });
    expect(final.flying).toEqual({ lc: 1 });
  });

  it('adds up the production of every resource of every place', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna', { research: { energy: 2 } });
    addPlanet(ctx, anna.id, {
      g: 1,
      s: 1,
      p: 2,
      b: { metal: 5, crystal: 4, deut: 3, solar: 6 },
    });
    addPlanet(ctx, anna.id, {
      g: 1,
      s: 1,
      p: 3,
      b: { metal: 2, crystal: 3, deut: 2, solar: 4 },
    });
    const u = universe(ctx);
    const research = settleR(ctx.players.get(anna.id)!, ctx.now()).research;
    const rates = ctx.planets
      .all()
      .map((p) => production(settle(p, ctx.now(), u), u, research));
    const sum = (k: 'm' | 'c' | 'd') => rates.reduce((s, r) => s + r[k], 0);
    expect(sum('c')).toBeGreaterThan(0);
    expect(sum('d')).toBeGreaterThan(0);
    expect(finalOf(ctx, 'Anna').economy).toEqual({
      m: sum('m'),
      c: sum('c'),
      d: sum('d'),
    });
  });

  it('says whether the player is on vacation', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2 });
    addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3 });
    ctx.players.save({ ...ctx.players.get(anna.id)!, vacation: ctx.now() });
    expect(finalOf(ctx, 'Anna').vacation).toBe(true);
    expect(finalOf(ctx, 'Bert').vacation).toBe(false);
  });
});

describe('the seats of the participants', () => {
  it('lists them by seat, also when the seats were given in another order than the accounts', () => {
    const ctx = testCtx();
    for (const [name, p, seat] of [
      ['Anna', 2, 3],
      ['Bert', 3, 1],
      ['Cleo', 4, 2],
    ] as const) {
      const u = addUser(ctx, name);
      addPlanet(ctx, u.id, { g: 1, s: 1, p });
      ctx.rounds.addParticipant({
        round: 1,
        seat,
        player: u.id,
        name,
      });
    }
    expect(roundFacts(ctx).players.map((p) => [p.seat, p.user.name])).toEqual([
      [1, 'Bert'],
      [2, 'Cleo'],
      [3, 'Anna'],
    ]);
  });

  it('keeps the seat of a participant whose account is gone out of the free ones', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2 });
    ctx.rounds.addParticipant({ round: 1, seat: 1, player: null, name: 'x' });
    expect(roundFacts(ctx).players.map((p) => p.seat)).toEqual([2]);
  });
});

describe('the guilds of the round', () => {
  it('names the seats of the members of each guild, no applicant and no member without a place', () => {
    const ctx = testCtx();
    const names = ['Anna', 'Bert', 'Cleo', 'Dora', 'Emil'];
    for (const [i, name] of names.entries()) {
      const u = addUser(ctx, name);
      // Emil holds no place: he is no participant.
      if (name !== 'Emil') addPlanet(ctx, u.id, { g: 1, s: 1, p: i + 1 });
    }
    ctx.guilds.create('g1', 'AAA', 'Eins', '', 'u_Anna');
    ctx.guilds.create('g2', 'BBB', 'Zwei', '', 'u_Bert');
    for (const [who, guild] of [
      ['Cleo', 'g1'],
      ['Emil', 'g1'],
      ['Dora', 'g2'],
    ] as const) {
      ctx.guilds.apply(`u_${who}`, guild);
      ctx.guilds.accept(`u_${who}`);
    }
    // Dora left g2 for nothing: an applicant of g1 is no member.
    ctx.db.prepare('DELETE FROM guild_members WHERE user_id = ?').run('u_Dora');
    ctx.guilds.apply('u_Dora', 'g1');
    const seat = (name: string) =>
      roundFacts(ctx).players.find((p) => p.user.name === name)!.seat;
    expect(
      roundFacts(ctx).guilds.map((g) => [g.tag, [...g.seats].sort()]),
    ).toEqual([
      ['AAA', [seat('Anna'), seat('Cleo')].sort()],
      ['BBB', [seat('Bert')]],
    ]);
  });
});

describe('the checks of a complete archive', () => {
  /** Anna plays and the journal joined her already; the round is ready to close. */
  function ready(): TestCtx {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2, b: { metal: 3 } });
    return ctx;
  }
  const incomplete = 'Das Archiv der Runde ist unvollständig.';

  it('refuses a round that holds a final state too many', () => {
    const ctx = ready();
    ctx.rounds.addEvent(1, ctx.now(), {
      at: ctx.now(),
      kind: ROUND_EVENT.player,
      seat: 7,
      payload: {},
    });
    expect(() => closeActiveRound(ctx)).toThrow(incomplete);
  });

  it('refuses a round whose events did not all get written', () => {
    const ctx = ready();
    const add = ctx.rounds.addEvent.bind(ctx.rounds);
    ctx.rounds.addEvent = (round, at, e) => {
      if (e.kind !== ROUND_EVENT.closed) add(round, at, e);
    };
    expect(() => closeActiveRound(ctx)).toThrow(incomplete);
  });

  it('closes a round that is complete', () => {
    const ctx = ready();
    expect(closeActiveRound(ctx).status).toBe('closed');
  });
});
