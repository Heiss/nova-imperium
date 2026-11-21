// The events written while a round runs (#235, owner 2026-11-20): one block
// per family. Each family is written once, with the right seat, payload and
// logical time, nothing in a closed round and nothing without an active
// round row, and the game itself does not change.
import { describe, expect, it } from 'vitest';
import { EVENT_KIND, type ParticipantJoined } from '../../core/round-events.ts';
import { deleteAccount } from '../delete-account.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { placePlanet } from './planets.ts';
import { closeActiveRound, ROUND_EVENT } from './round-archive.ts';
import { joinRound, seatOf, writeRoundEvent } from './round-events.ts';

const send = (ctx: TestCtx, who: string, d: Record<string, unknown>) =>
  runAction(ctx, `u_${who}`, d);

const kinds = (ctx: TestCtx, round = 1) =>
  ctx.rounds.events(round).map((e) => e.kind);

describe('participant.joined: the first place of a player', () => {
  it('writes the seat and the baseline of a new home planet', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.clock.t = 2_000_000;
    const home = placePlanet(ctx, 'u_Anna', 'Heimat', 1);
    const [e, ...rest] = ctx.rounds.events(1, EVENT_KIND.joined);
    expect(rest).toEqual([]);
    expect(e).toMatchObject({
      seat: 1,
      at: 2_000_000,
      recorded: 2_000_000,
      version: 2,
    });
    expect(e!.payload).toEqual({
      entry: 'home',
      research: {},
      places: [
        {
          kind: 'planet',
          g: home.g,
          s: home.s,
          p: home.p,
          res: { m: home.res.m, c: home.res.c, d: home.res.d },
          b: {},
          ships: {},
          def: {},
        },
      ],
    } satisfies ParticipantJoined);
    expect(ctx.rounds.participants(1)).toEqual([
      { round: 1, seat: 1, player: 'u_Anna', name: 'Anna' },
    ]);
  });

  it('gives the next seat to the next player and each seat once', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    placePlanet(ctx, 'u_Anna', 'A', 1);
    placePlanet(ctx, 'u_Bert', 'B', 1);
    expect(joinRound(ctx, 'u_Anna', 'home')).toBe(1);
    expect(joinRound(ctx, 'u_Bert', 'present')).toBe(2);
    expect(
      ctx.rounds.events(1, EVENT_KIND.joined).map((e) => [e.seat]),
    ).toEqual([[1], [2]]);
    expect(ctx.rounds.participants(1)).toHaveLength(2);
  });

  it('writes nothing in a closed round', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna');
    closeActiveRound(ctx);
    const count = ctx.rounds.countEvents(1);
    addUser(ctx, 'Bert');
    placePlanet(ctx, 'u_Bert', 'B', 1);
    expect(ctx.rounds.countEvents(1)).toBe(count);
    expect(ctx.rounds.seatOf(1, 'u_Bert')).toBeNull();
    expect(seatOf(ctx, 'u_Bert')).toBeNull();
  });

  it('writes nothing without an active round row', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.db.exec('DELETE FROM rounds');
    placePlanet(ctx, 'u_Anna', 'A', 1);
    writeRoundEvent(ctx, 'x.y', null, {});
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM round_events').pluck().get(),
    ).toBe(0);
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM round_participants').pluck().get(),
    ).toBe(0);
    expect(ctx.rounds.get(1)).toBeNull();
  });

  it('lets a player who was playing before the events join as „present“, once', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { energy: 2 } });
    addPlanet(ctx, 'u_Anna', { b: { metal: 3 }, ships: { lc: 2 } });
    expect(seatOf(ctx, 'u_Anna')).toBe(1);
    expect(seatOf(ctx, 'u_Anna')).toBe(1);
    const joined = ctx.rounds.events(1, EVENT_KIND.joined);
    expect(joined).toHaveLength(1);
    const payload = joined[0]!.payload as unknown as ParticipantJoined;
    expect(payload.entry).toBe('present');
    expect(payload.research).toEqual({ energy: 2 });
    expect(payload.places[0]).toMatchObject({
      b: { metal: 3 },
      ships: { lc: 2 },
    });
  });

  it('gives no seat to an account that does not exist', () => {
    const ctx = testCtx();
    expect(seatOf(ctx, 'nobody')).toBeNull();
    expect(ctx.rounds.countEvents(1)).toBe(0);
  });

  it('writes the joining of every player of a new round, in the transaction of the reset', () => {
    const ctx = testCtx();
    addUser(ctx, 'Ada', { admin: true });
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Ada', { p: 1 });
    addPlanet(ctx, 'u_Anna', { p: 2 });
    send(ctx, 'Ada', { type: 'reset' });
    expect(kinds(ctx, 2)).toEqual([
      ROUND_EVENT.started,
      EVENT_KIND.joined,
      EVENT_KIND.joined,
      // The reset is the first action of the new round (the journal).
      EVENT_KIND.action,
    ]);
    expect(ctx.rounds.participants(2).map((p) => [p.seat, p.player])).toEqual([
      [1, 'u_Ada'],
      [2, 'u_Anna'],
    ]);
    // The old round took none of it.
    expect(kinds(ctx, 1).includes(EVENT_KIND.joined)).toBe(false);
  });

  it('lets the close keep the seat of the joining, also for a player who lost every place', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    addUser(ctx, 'Cora');
    for (const name of ['Anna', 'Bert', 'Cora'])
      placePlanet(ctx, `u_${name}`, name, 1);
    // Anna lost everything; Cora joins at the close of the others.
    ctx.planets.deleteAll();
    addPlanet(ctx, 'u_Bert', { p: 5 });
    addPlanet(ctx, 'u_Cora', { p: 6 });
    closeActiveRound(ctx);
    expect(ctx.rounds.events(1, ROUND_EVENT.player).map((e) => e.seat)).toEqual(
      [2, 3],
    );
    expect(ctx.rounds.participants(1).map((p) => p.seat)).toEqual([1, 2, 3]);
  });

  it('keeps the seat and the events when the account is deleted, under the pseudonym', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    placePlanet(ctx, 'u_Anna', 'A', 1);
    placePlanet(ctx, 'u_Bert', 'B', 1);
    deleteAccount(ctx, ctx.players.get('u_Anna')!, 'secret1');
    expect(ctx.rounds.participants(1)[0]).toMatchObject({
      seat: 1,
      player: null,
      name: 'Gelöschter Spieler',
    });
    expect(ctx.rounds.events(1, EVENT_KIND.joined)).toHaveLength(2);
    // The payload names nobody.
    expect(JSON.stringify(ctx.rounds.events(1))).not.toContain('Anna');
  });
});
