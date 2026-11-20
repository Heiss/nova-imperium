// The archive of a round (#235): the close, the reset that closes first, the
// refused reset when the archive fails, the deletion of a round and the
// pseudonym of a deleted account.
import { describe, expect, it, vi } from 'vitest';
import { production } from '../../core/economy.ts';
import { EVENT_KIND } from '../../core/round-events.ts';
import { DELETED_PLAYER, type PlayerFinal } from '../../core/round-report.ts';
import { settle, settleR } from '../../core/settle.ts';
import { deleteAccount } from '../delete-account.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { categoryScores } from './highscore.ts';
import { pointsMap } from './points.ts';
import {
  closeActiveRound,
  ensureRound,
  ROUND_EVENT,
  roundFacts,
} from './round-archive.ts';
import { roundRules } from './round.ts';
import { universe } from './context.ts';

/** Admin Ada, Anna and Bert with planets of different strength; Cora has none. */
function setup(): TestCtx {
  const ctx = testCtx();
  const ada = addUser(ctx, 'Ada', { admin: true });
  const anna = addUser(ctx, 'Anna', { research: { energy: 3, laser: 2 } });
  const bert = addUser(ctx, 'Bert');
  addUser(ctx, 'Cora');
  addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 2,
    b: { metal: 10, crystal: 6, solar: 8 },
    ships: { lc: 5 },
    def: { rocket: 20 },
  });
  addPlanet(ctx, anna.id, {
    id: 'm1_1_2',
    kind: 'moon',
    g: 1,
    s: 1,
    p: 2,
    b: { moonbase: 1 },
  });
  addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3, b: { metal: 4 } });
  return ctx;
}

const send = (ctx: TestCtx, who: string, d: Record<string, unknown>) =>
  runAction(ctx, `u_${who}`, d);

/** The events the archive and the admin write, without the journal of actions and the joining (#235). */
const archiveOnly = (ctx: TestCtx) =>
  ctx.rounds
    .events(1)
    .filter(
      (e) => !e.kind.startsWith('journal.') && e.kind !== EVENT_KIND.joined,
    );

const finals = (ctx: TestCtx, round: number) =>
  ctx.rounds.events(round, ROUND_EVENT.player);

describe('the archive of the running round (#235)', () => {
  it('starts with the running round as an active, complete row', () => {
    const ctx = testCtx();
    const round = ctx.rounds.get(1)!;
    expect(round).toMatchObject({
      number: 1,
      status: 'active',
      closed: null,
      coverage: 'complete',
      events: null,
    });
    expect(ensureRound(ctx)).toEqual(round);
  });

  it('gives a database without the row of the running round a partial one, started with the round', () => {
    const ctx = testCtx(5_000_000);
    ctx.db.exec('DELETE FROM rounds');
    ctx.admin.putSettings([
      ['round', 4],
      ['roundStart', 1_234_000],
    ]);
    expect(ensureRound(ctx)).toMatchObject({
      number: 4,
      status: 'active',
      started: 1_234_000,
      coverage: 'partial',
    });
  });

  it('reads the facts of the participants: points, production, places, flying ships', () => {
    const ctx = setup();
    ctx.fleets.save({
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_2',
      fromC: { g: 1, s: 1, p: 2 },
      to: 'p1_1_3',
      toC: { g: 1, s: 1, p: 3 },
      mission: 'attack',
      ships: { lc: 3 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: 0,
      arr: 9e12,
      ret: 9e12,
      state: 'out',
      recalled: false,
      fuel: 0,
    });
    const facts = roundFacts(ctx);
    // Cora has no planet and is no participant; the seats follow the accounts.
    expect(facts.players.map((p) => [p.seat, p.user.name])).toEqual([
      [1, 'Ada'],
      [2, 'Anna'],
      [3, 'Bert'],
    ]);
    const anna = facts.players[1]!.final;
    const u = universe(ctx);
    const planet = settle(ctx.planets.home('u_Anna')!, ctx.now(), u);
    const research = settleR(ctx.players.get('u_Anna')!, ctx.now()).research;
    expect(anna.economy.m).toBe(
      production(planet, u, research).m +
        production(
          settle(ctx.planets.get('m1_1_2')!, ctx.now(), u),
          u,
          research,
        ).m,
    );
    expect(anna.valuation).toEqual({
      total: pointsMap(ctx).u_Anna,
      ...categoryScores(ctx).u_Anna,
    });
    expect(anna.research).toEqual({ energy: 3, laser: 2 });
    expect(anna.places.map((p) => p.kind).sort()).toEqual(['moon', 'planet']);
    expect(anna.places.find((p) => p.kind === 'planet')).toMatchObject({
      b: { metal: 10, crystal: 6, solar: 8 },
      ships: { lc: 5 },
      def: { rocket: 20 },
    });
    expect(anna.flying).toEqual({ lc: 3 });
    expect(facts.players[0]!.final.flying).toEqual({});
  });
});

describe('„Runde abschließen“ (D1)', () => {
  it('is only for the admin', () => {
    const ctx = setup();
    expect(() => send(ctx, 'Anna', { type: 'closeRound' })).toThrow(
      'Nur der Admin',
    );
    expect(ctx.rounds.get(1)!.status).toBe('active');
  });

  it('archives the participants at the cutoff and closes the round', () => {
    const ctx = setup();
    ctx.clock.t += 5 * 86400000;
    const answer = send(ctx, 'Ada', { type: 'closeRound' });
    expect(answer).toBe(
      'Runde 1 abgeschlossen: ihr Bericht steht den Teilnehmern im Rundenarchiv bereit.',
    );
    const round = ctx.rounds.get(1)!;
    expect(round).toMatchObject({ status: 'closed', closed: ctx.now() });
    expect(round.rules).toEqual(roundRules(ctx));
    expect(
      ctx.rounds.participants(1).map((p) => [p.seat, p.player, p.name]),
    ).toEqual([
      [1, 'u_Ada', 'Ada'],
      [2, 'u_Anna', 'Anna'],
      [3, 'u_Bert', 'Bert'],
    ]);
    expect(finals(ctx, 1).map((e) => [e.seat, e.at])).toEqual([
      [1, ctx.now()],
      [2, ctx.now()],
      [3, ctx.now()],
    ]);
    const closed = ctx.rounds.events(1, ROUND_EVENT.closed);
    expect(closed).toHaveLength(1);
    expect(closed[0]!.payload).toEqual({ cutoff: ctx.now(), participants: 3 });
    // The count the close expects is the count of the events the round holds.
    expect(round.events).toBe(ctx.rounds.countEvents(1));
    expect(round.events).toBe(7);
  });

  it('keeps the world: planets stay and the game goes on until „Neue Runde“', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'closeRound' });
    expect(ctx.planets.all()).toHaveLength(4);
    expect(roundRules(ctx).number).toBe(1);
  });

  it('refuses a second close and writes nothing twice', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'closeRound' });
    const count = ctx.rounds.countEvents(1);
    expect(() => send(ctx, 'Ada', { type: 'closeRound' })).toThrow(
      'Diese Runde ist schon abgeschlossen.',
    );
    expect(ctx.rounds.countEvents(1)).toBe(count);
  });

  it('writes the guilds of the round with their members by seat', () => {
    const ctx = setup();
    ctx.guilds.create('g1', 'ABC', 'Die Alten', '', 'u_Anna');
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    closeActiveRound(ctx);
    const [guild] = ctx.rounds.events(1, ROUND_EVENT.guild);
    expect(guild!.payload).toEqual({
      tag: 'ABC',
      name: 'Die Alten',
      seats: [2, 3],
    });
  });

  it('is the same fact when read again: the archived final does not follow the game', () => {
    const ctx = setup();
    closeActiveRound(ctx);
    const before = finals(ctx, 1).map((e) => e.payload);
    ctx.clock.t += 86400000;
    ctx.planets.deleteAll();
    expect(finals(ctx, 1).map((e) => e.payload)).toEqual(before);
    const anna = before[1] as unknown as PlayerFinal;
    expect(anna.valuation.total).toBeGreaterThan(0);
  });
});

describe('„Neue Runde“ closes the old round first (D1)', () => {
  it('archives the running round, opens the next and resets the world', () => {
    const ctx = setup();
    ctx.clock.t += 86400000;
    const closedAt = ctx.now();
    send(ctx, 'Ada', { type: 'reset' });
    expect(ctx.rounds.get(1)).toMatchObject({
      status: 'closed',
      closed: closedAt,
    });
    expect(finals(ctx, 1)).toHaveLength(3);
    expect(ctx.rounds.get(2)).toMatchObject({
      status: 'active',
      started: closedAt,
      coverage: 'complete',
    });
    expect(ctx.rounds.get(2)!.rules).toEqual(roundRules(ctx));
    expect(roundRules(ctx).number).toBe(2);
    // The new round starts with its own start and the joining of every player (#235).
    expect(ctx.rounds.events(2).map((e) => e.kind)).toEqual([
      ROUND_EVENT.started,
      ...Array(4).fill(EVENT_KIND.joined),
      // The reset itself is an action of the admin in the new round (the journal).
      EVENT_KIND.action,
    ]);
    // The reset itself still happened.
    expect(ctx.planets.home('u_Anna')!.b).toEqual({});
    // The archived round keeps what stood before the reset.
    const anna = finals(ctx, 1)[1]!.payload as unknown as PlayerFinal;
    expect(anna.places.find((p) => p.kind === 'planet')!.b).toEqual({
      metal: 10,
      crystal: 6,
      solar: 8,
    });
  });

  it('does not archive twice after „Runde abschließen“', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'closeRound' });
    const snapshot = JSON.stringify([
      ctx.rounds.get(1),
      ctx.rounds.events(1),
      ctx.rounds.participants(1),
    ]);
    ctx.clock.t += 3600000;
    send(ctx, 'Ada', { type: 'reset' });
    expect(
      JSON.stringify([
        ctx.rounds.get(1),
        ctx.rounds.events(1),
        ctx.rounds.participants(1),
      ]),
    ).toBe(snapshot);
    expect(ctx.rounds.get(2)!.status).toBe('active');
  });

  it('runs round after round: each is archived with its own participants', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'reset' });
    addPlanet(ctx, 'u_Cora', { g: 1, s: 2, p: 1 });
    send(ctx, 'Ada', { type: 'reset' });
    expect(ctx.rounds.all().map((r) => [r.number, r.status])).toEqual([
      [3, 'active'],
      [2, 'closed'],
      [1, 'closed'],
    ]);
    // Cora got a planet from the reset of round 1, so she is in round 2 and not in round 1.
    // The running round 3 holds a seat for everyone already (their joining event).
    expect(ctx.rounds.roundsOf('u_Cora')).toEqual([3, 2]);
    expect(ctx.rounds.roundsOf('u_Anna')).toEqual([3, 2, 1]);
  });

  it('refuses the reset, and loses nothing, when an event cannot be written', () => {
    const ctx = setup();
    ctx.clock.t += 86400000;
    const spy = vi.spyOn(ctx.rounds, 'addEvent').mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => send(ctx, 'Ada', { type: 'reset' })).toThrow('disk full');
    spy.mockRestore();
    // The transaction rolled back: the round runs, the world stands, no rule changed.
    expect(ctx.rounds.get(1)).toMatchObject({ status: 'active', closed: null });
    expect(ctx.rounds.get(2)).toBeNull();
    expect(ctx.rounds.participants(1)).toEqual([]);
    expect(ctx.rounds.countEvents(1)).toBe(0);
    expect(roundRules(ctx).number).toBe(1);
    expect(ctx.planets.home('u_Anna')!.b).toEqual({
      metal: 10,
      crystal: 6,
      solar: 8,
    });
    // The retry works.
    send(ctx, 'Ada', { type: 'reset' });
    expect(ctx.rounds.get(1)!.status).toBe('closed');
    expect(ctx.rounds.get(2)!.status).toBe('active');
  });

  it('refuses the reset when the archive is incomplete', () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.rounds, 'participants').mockReturnValue([]);
    expect(() => send(ctx, 'Ada', { type: 'reset' })).toThrow(
      'Das Archiv der Runde ist unvollständig. Es wurde nichts geändert.',
    );
    spy.mockRestore();
    expect(ctx.rounds.get(1)!.status).toBe('active');
    expect(roundRules(ctx).number).toBe(1);
    expect(ctx.planets.all()).toHaveLength(4);
    expect(archiveOnly(ctx)).toEqual([]);
  });

  it('refuses the reset without archiving when its rules are refused', () => {
    const ctx = setup();
    expect(() =>
      send(ctx, 'Ada', { type: 'reset', vacationHours: 'x' }),
    ).toThrow();
    expect(ctx.rounds.get(1)!.status).toBe('active');
    expect(archiveOnly(ctx)).toEqual([]);
  });
});

describe('„Runde löschen“ (Lifetime)', () => {
  it('deletes a closed round with its participants and events, and only that', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'reset' });
    expect(send(ctx, 'Ada', { type: 'deleteRound', round: 1 })).toBe(
      'Runde 1 aus dem Archiv gelöscht.',
    );
    expect(ctx.rounds.get(1)).toBeNull();
    expect(ctx.rounds.participants(1)).toEqual([]);
    expect(ctx.rounds.events(1)).toEqual([]);
    expect(ctx.rounds.get(2)!.status).toBe('active');
  });

  it('refuses the running round, an unknown round and a player', () => {
    const ctx = setup();
    expect(() => send(ctx, 'Ada', { type: 'deleteRound', round: 1 })).toThrow(
      'Nur eine abgeschlossene Runde lässt sich löschen.',
    );
    expect(() => send(ctx, 'Ada', { type: 'deleteRound', round: 9 })).toThrow(
      'Diese Runde gibt es nicht im Archiv.',
    );
    send(ctx, 'Ada', { type: 'closeRound' });
    expect(() => send(ctx, 'Anna', { type: 'deleteRound', round: 1 })).toThrow(
      'Nur der Admin',
    );
    expect(ctx.rounds.get(1)!.status).toBe('closed');
  });
});

describe('a deleted account in the archive (D4)', () => {
  it('keeps its numbers under the pseudonym and loses its link', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'reset' });
    const user = ctx.players.get('u_Anna')!;
    deleteAccount(ctx, user, 'secret1');
    expect(
      ctx.rounds.participants(1).map((p) => [p.seat, p.player, p.name]),
    ).toEqual([
      [1, 'u_Ada', 'Ada'],
      [2, null, DELETED_PLAYER],
      [3, 'u_Bert', 'Bert'],
    ]);
    expect(ctx.rounds.roundsOf('u_Anna')).toEqual([]);
    // The numbers of the seat stay.
    expect(finals(ctx, 1)).toHaveLength(3);
    // Neither the name nor the id of the account is in any event of the round.
    const all = JSON.stringify(ctx.rounds.events(1));
    expect(all).not.toContain('Anna');
    expect(all).not.toContain('u_Anna');
  });

  it('leaves the archive of other accounts alone', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'reset' });
    deleteAccount(ctx, ctx.players.get('u_Cora')!, 'secret1');
    expect(ctx.rounds.participants(1).map((p) => p.name)).toEqual([
      'Ada',
      'Anna',
      'Bert',
    ]);
  });
});

describe('the size of an archive', () => {
  it('of a round with 20 players of three places each stays small', () => {
    const ctx = testCtx();
    const full = {
      metal: 20,
      crystal: 18,
      deut: 16,
      solar: 20,
      fusion: 10,
      robot: 10,
      shipyard: 12,
      lab: 12,
      storage: 10,
    };
    for (let i = 1; i <= 20; i++) {
      const u = addUser(ctx, `P${i}`, {
        research: { energy: 8, laser: 7, ion: 5, weapons: 9, shield: 9 },
      });
      for (let k = 1; k <= 3; k++)
        addPlanet(ctx, u.id, {
          id: `p${i}_${k}`,
          g: 1,
          s: i,
          p: k,
          b: full,
          ships: { lc: 100, sc: 100, cruiser: 50, bs: 20, bomber: 5 },
          def: { rocket: 200, laser: 100, plasma: 10 },
        });
    }
    ctx.guilds.create('g1', 'ABC', 'Die Alten', '', 'u_P1');
    closeActiveRound(ctx);
    const bytes = ctx.db
      .prepare(
        `SELECT
           (SELECT SUM(LENGTH(payload) + LENGTH(kind) + 40) FROM round_events) +
           (SELECT SUM(LENGTH(name) + 16) FROM round_participants) +
           (SELECT 200 FROM rounds LIMIT 1)`,
      )
      .pluck()
      .get() as number;
    expect(ctx.rounds.participants(1)).toHaveLength(20);
    // 20 players with three fully built places: about 22 KB measured, so a year of
    // weekly rounds is a few megabytes.
    expect(bytes).toBeLessThan(40_000);
    expect(bytes).toBeGreaterThan(5_000);
  });
});

describe('the interventions of the admin in the history', () => {
  it('writes the Endzeit and a change of the settings into the running round', () => {
    const ctx = setup();
    ctx.clock.t += 1000;
    send(ctx, 'Ada', { type: 'endzeit', minutes: 60 });
    ctx.clock.t += 1000;
    send(ctx, 'Ada', {
      type: 'settings',
      settings: { ...universe(ctx), speed: 7 },
    });
    const events = ctx.rounds
      .events(1)
      .filter((e) => e.kind.startsWith('admin.'))
      .map((e) => [e.kind, e.at, e.recorded, e.seat]);
    expect(events).toEqual([
      ['admin.endzeit', 1_001_000, 1_001_000, null],
      ['admin.settings', 1_002_000, 1_002_000, null],
    ]);
    expect(ctx.rounds.events(1, 'admin.endzeit')[0]!.payload).toEqual({
      minutes: 60,
      recipients: 3,
      due: 1_001_000 + 60 * 60000,
    });
    const saved = ctx.rounds.events(1, 'admin.settings')[0]!.payload as {
      settings: { speed: number };
    };
    expect(saved.settings.speed).toBe(7);
  });

  it('counts them in the archive of the close', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'endzeit', minutes: 60 });
    send(ctx, 'Ada', { type: 'closeRound' });
    // 1 Endzeit + 3 participants + 3 play times + the close; no guilds.
    expect(archiveOnly(ctx)).toHaveLength(8);
    // The expected count is the count of every event of the round, the journal's included.
    expect(ctx.rounds.get(1)!.events).toBe(ctx.rounds.countEvents(1));
  });

  it('does not write into a round that is closed, and Endzeit alone does not close a round', () => {
    const ctx = setup();
    send(ctx, 'Ada', { type: 'endzeit', minutes: 60 });
    expect(ctx.rounds.get(1)!.status).toBe('active');
    send(ctx, 'Ada', { type: 'closeRound' });
    const count = ctx.rounds.countEvents(1);
    send(ctx, 'Ada', {
      type: 'settings',
      settings: { ...universe(ctx), speed: 3 },
    });
    expect(ctx.rounds.countEvents(1)).toBe(count);
  });

  it('writes a refused change of the settings nowhere', () => {
    const ctx = setup();
    expect(() =>
      send(ctx, 'Ada', { type: 'settings', settings: {} }),
    ).toThrow();
    expect(archiveOnly(ctx)).toEqual([]);
  });
});
