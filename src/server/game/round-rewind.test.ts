// The thin Runden-Rewind on the server (#235, view G): the action `roundRewind`
// answers with the cards of the reader's own seat and carries the access rules
// of `roundReport`: a round the reader may not open answers like one that does
// not exist, the check is made on every request.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/activity.ts';
import { DELETED_PLAYER } from '../../core/round-report.ts';
import type { Rewind } from '../../core/round-rewind.ts';
import { deleteAccount } from '../delete-account.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import type { Answer } from './actions.ts';
import { runAction } from './dispatch.ts';

const MIN = 60_000;
const REFUSED = 'Dieser Rundenbericht ist nicht verfügbar.';

/** Ada (admin, plays), Anna the strongest, Bert; Cora has no place; round 1 runs. */
function setup(): TestCtx {
  const ctx = testCtx();
  // Far from the clock's zero, so an interval before `now` is a real one.
  ctx.clock.t += 100 * DAY_MS;
  ctx.db.prepare('UPDATE rounds SET started = ?').run(ctx.now());
  const ada = addUser(ctx, 'Ada', { admin: true });
  const anna = addUser(ctx, 'Anna');
  const bert = addUser(ctx, 'Bert');
  addUser(ctx, 'Cora');
  addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
  addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2, b: { metal: 12 } });
  addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3, b: { metal: 6 } });
  return ctx;
}

/** An accepted interval of Anna: 12 h 40 min from now on. */
function annaPlayed(ctx: TestCtx): void {
  const t0 = ctx.now();
  ctx.playtime.append({
    user: 'u_Anna',
    round: 1,
    session: 1,
    instance: 'page-anna-1',
    seq: 1,
    state: 'active',
    reason: 'heartbeat',
    start: t0,
    end: t0 + 760 * MIN,
    method: 1,
  });
}

/** Round 1 played by Ada, Anna and Bert, closed after 3 days; Dora then plays round 2. */
function closed(): TestCtx {
  const ctx = setup();
  annaPlayed(ctx);
  ctx.clock.t += 3 * DAY_MS;
  runAction(ctx, 'u_Ada', { type: 'reset' });
  const dora = addUser(ctx, 'Dora');
  addPlanet(ctx, dora.id, { g: 1, s: 2, p: 1, b: { metal: 3 } });
  return ctx;
}

const ask = (ctx: TestCtx, who: string, round: number): Rewind =>
  (runAction(ctx, `u_${who}`, { type: 'roundRewind', round }) as Answer).data!
    .rewind as Rewind;

const slots = (r: Rewind): number[] => r.cards.map((c) => c.slot);

describe('the cards of a participant', () => {
  it('gives each participant the cards of their own seat', () => {
    const ctx = closed();
    const anna = ask(ctx, 'Anna', 1);
    expect(anna.round).toBe(1);
    expect(slots(anna)).toEqual([1, 6, 8]);
    expect(anna.cards[0]).toMatchObject({
      number: 1,
      days: 3,
      participants: 3,
    });
    expect(anna.cards[1]).toMatchObject({ ms: 760 * MIN });
    expect(anna.cards[2]).toMatchObject({
      rank: 1,
      of: 3,
      winner: { name: 'Anna', you: true },
    });
    const bert = ask(ctx, 'Bert', 1);
    expect(bert.cards[1]).toMatchObject({ ms: 0 });
    expect(bert.cards[2]).toMatchObject({
      rank: 2,
      winner: { name: 'Anna', you: false },
    });
  });

  it('gives a round archived before the play time the cards 1 and 8 only', () => {
    const ctx = closed();
    ctx.db
      .prepare('DELETE FROM round_events WHERE kind = ?')
      .run('player.playtime');
    expect(slots(ask(ctx, 'Anna', 1))).toEqual([1, 8]);
  });

  it('names a deleted account as the pseudonym', () => {
    const ctx = closed();
    deleteAccount(ctx, ctx.players.get('u_Anna')!, 'secret1');
    const bert = ask(ctx, 'Bert', 1);
    expect(bert.cards[2]).toMatchObject({
      winner: { name: DELETED_PLAYER, you: false },
    });
    expect(JSON.stringify(bert)).not.toContain('Anna');
    expect(JSON.stringify(bert)).not.toContain('u_');
  });

  it('stays available after later resets', () => {
    const ctx = closed();
    runAction(ctx, 'u_Ada', { type: 'reset' });
    expect(slots(ask(ctx, 'Anna', 1))).toEqual([1, 6, 8]);
    expect(slots(ask(ctx, 'Dora', 2))).toEqual([1, 6, 8]);
  });
});

describe('who may open a Rewind (#235, access contract)', () => {
  it('refuses a player a round they did not take part in, like a round that does not exist', () => {
    const ctx = closed();
    expect(() => ask(ctx, 'Dora', 1)).toThrow(REFUSED);
    expect(() => ask(ctx, 'Dora', 99)).toThrow(REFUSED);
    expect(() => ask(ctx, 'Dora', -1)).toThrow(REFUSED);
    // A player with no place at all.
    expect(() => ask(ctx, 'Cora', 1)).toThrow(REFUSED);
  });

  it('refuses a player the running round, also one they play', () => {
    const ctx = closed();
    expect(() => ask(ctx, 'Dora', 2)).toThrow(REFUSED);
    expect(() => ask(ctx, 'Anna', 2)).toThrow(REFUSED);
  });

  it('refuses the admin the running round, which has no Rewind and no seat yet', () => {
    const ctx = closed();
    expect(() => ask(ctx, 'Ada', 2)).toThrow(REFUSED);
  });

  it('gives the admin who took part their own Rewind of a finished round', () => {
    const ctx = closed();
    const ada = ask(ctx, 'Ada', 1);
    expect(slots(ada)).toEqual([1, 6, 8]);
    expect(ada.cards[2]).toMatchObject({ rank: 3, of: 3 });
  });

  it('refuses the admin who did not take part: the Rewind is a personal story', () => {
    const ctx = setup();
    addUser(ctx, 'Boss', { admin: true });
    ctx.clock.t += DAY_MS;
    runAction(ctx, 'u_Ada', { type: 'reset' });
    expect(slots(ask(ctx, 'Ada', 1))).toEqual([1, 6, 8]);
    expect(() => ask(ctx, 'Boss', 1)).toThrow(REFUSED);
  });

  it('refuses a deleted round to everybody, the admin too', () => {
    const ctx = closed();
    runAction(ctx, 'u_Ada', { type: 'deleteRound', round: 1 });
    expect(() => ask(ctx, 'Ada', 1)).toThrow(REFUSED);
    expect(() => ask(ctx, 'Anna', 1)).toThrow(REFUSED);
  });

  it('checks on every request: a refusal is no cache, a deleted account has no access', () => {
    const ctx = closed();
    expect(slots(ask(ctx, 'Anna', 1))).toEqual([1, 6, 8]);
    runAction(ctx, 'u_Ada', { type: 'deleteRound', round: 1 });
    expect(() => ask(ctx, 'Anna', 1)).toThrow(REFUSED);
  });

  it('asks for a round number', () => {
    const ctx = closed();
    expect(() => runAction(ctx, 'u_Anna', { type: 'roundRewind' })).toThrow();
  });
});

describe('the audit of the admin`s reads', () => {
  it('writes an entry when the admin opens a Rewind, none for a player or a refusal', () => {
    const ctx = closed();
    const count = (): number =>
      (
        ctx.db
          .prepare(
            "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'roundRewind'",
          )
          .get() as { n: number }
      ).n;
    ask(ctx, 'Anna', 1);
    expect(count()).toBe(0);
    expect(() => ask(ctx, 'Ada', 2)).toThrow(REFUSED);
    expect(count()).toBe(0);
    ask(ctx, 'Ada', 1);
    expect(count()).toBe(1);
  });
});
