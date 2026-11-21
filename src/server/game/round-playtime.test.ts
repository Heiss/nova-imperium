// The play time in the round archive (#235 × #232, D2): the close writes the
// accepted intervals of every participant as events of the round, the report
// derives the sum on read and shares it only after the round ended.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/activity.ts';
import {
  DELETED_PLAYER,
  type PlayerPlaytime,
  type RoundReport,
} from '../../core/round-report.ts';
import { deleteAccount } from '../delete-account.ts';
import type { PlaytimeEvent } from '../db/repos/playtime.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import type { Answer } from './actions.ts';
import { runAction } from './dispatch.ts';
import { closeActiveRound, ROUND_EVENT } from './round-archive.ts';

const MIN = 60_000;
const FOREVER = Number.MAX_SAFE_INTEGER;
const REFUSED = 'Dieser Rundenbericht ist nicht verfügbar.';

let seq = 0;
/** Appends an accepted interval of a page; `from` and `to` are minutes after the test clock's now. */
function played(
  ctx: TestCtx,
  user: string,
  from: number,
  to: number,
  over: Partial<PlaytimeEvent> = {},
): void {
  const t0 = ctx.now();
  ctx.playtime.append({
    user,
    round: 1,
    session: 1,
    instance: `page-${user}`,
    seq: ++seq,
    state: 'active',
    reason: 'heartbeat',
    start: t0 + from * MIN,
    end: t0 + to * MIN,
    method: 1,
    ...over,
  });
}

/** Ada (admin), Anna and Bert hold a place; Cora has none. */
function setup(): TestCtx {
  const ctx = testCtx();
  // Far from the clock's zero, so an interval before `now` is a real one.
  ctx.clock.t += 100 * DAY_MS;
  const ada = addUser(ctx, 'Ada', { admin: true });
  const anna = addUser(ctx, 'Anna');
  const bert = addUser(ctx, 'Bert');
  addUser(ctx, 'Cora');
  addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
  addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2, b: { metal: 9 } });
  addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3, b: { metal: 5 } });
  return ctx;
}

const events = (ctx: TestCtx, round = 1) =>
  ctx.rounds.events(round, ROUND_EVENT.playtime);

const payloadOf = (ctx: TestCtx, seat: number): PlayerPlaytime =>
  events(ctx).find((e) => e.seat === seat)!
    .payload as unknown as PlayerPlaytime;

const report = (ctx: TestCtx, who: string, round: number): RoundReport =>
  (runAction(ctx, `u_${who}`, { type: 'roundReport', round }) as Answer).data!
    .report as RoundReport;

describe('the close archives the play time of each participant (#235 × #232)', () => {
  it('writes no event for a round without participants', () => {
    const ctx = testCtx();
    ctx.clock.t += 100 * DAY_MS;
    addUser(ctx, 'Ada', { admin: true });
    played(ctx, 'u_Ada', 0, 10);
    closeActiveRound(ctx);
    expect(events(ctx)).toEqual([]);
    expect(ctx.rounds.get(1)!.status).toBe('closed');
    expect(report(ctx, 'Ada', 1).playtime).toBeNull();
  });

  it('writes a measured zero for a single participant without play time', () => {
    const ctx = testCtx();
    const ada = addUser(ctx, 'Ada', { admin: true });
    addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
    closeActiveRound(ctx);
    expect(events(ctx)).toHaveLength(1);
    expect(payloadOf(ctx, 1)).toEqual({ methods: [], intervals: [] });
    // A zero is not an unknown value.
    expect(report(ctx, 'Ada', 1).playtime).toEqual({ 1: 0 });
  });

  it('writes one event per seat for several participants, with and without play time', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 10);
    played(ctx, 'u_Anna', 30, 45);
    played(ctx, 'u_Bert', 5, 6);
    const t0 = ctx.now();
    ctx.clock.t += 2 * DAY_MS;
    closeActiveRound(ctx);
    expect(events(ctx).map((e) => e.seat)).toEqual([1, 2, 3]);
    expect(payloadOf(ctx, 1)).toEqual({ methods: [], intervals: [] });
    expect(payloadOf(ctx, 2)).toEqual({
      methods: [1],
      intervals: [
        [t0, t0 + 10 * MIN],
        [t0 + 30 * MIN, t0 + 45 * MIN],
      ],
    });
    expect(payloadOf(ctx, 3).intervals).toEqual([[t0 + 5 * MIN, t0 + 6 * MIN]]);
    expect(report(ctx, 'Anna', 1).playtime).toEqual({
      1: 0,
      2: 25 * MIN,
      3: MIN,
    });
    // The count the close expects includes them: 3 finals, 3 play times, the close.
    // The count the close expects includes them: 3 finals, 3 play times, the closing settlement of the journal, the close.
    expect(ctx.rounds.get(1)!.events).toBe(8);
  });

  it('counts two pages open at the same time once', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 20, { instance: 'page-one-1' });
    played(ctx, 'u_Anna', 10, 30, { instance: 'page-two-2' });
    played(ctx, 'u_Anna', 30, 40, { instance: 'page-one-1' });
    const t0 = ctx.now();
    ctx.clock.t += DAY_MS;
    closeActiveRound(ctx);
    expect(payloadOf(ctx, 2).intervals).toEqual([[t0, t0 + 40 * MIN]]);
    expect(report(ctx, 'Anna', 1).playtime![2]).toBe(40 * MIN);
  });

  it('writes neither page, sequence, session, account nor name', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 5);
    closeActiveRound(ctx);
    const text = JSON.stringify(events(ctx));
    for (const leak of ['u_Anna', 'Anna', 'page-', 'instance', 'session'])
      expect(text).not.toContain(leak);
  });

  it('takes only the intervals of this round and of its participants', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', -60, -50);
    played(ctx, 'u_Anna', -40, -10, { round: 2 });
    // Cora holds no place at the cutoff: no participant, no seat.
    played(ctx, 'u_Cora', -60, -1);
    closeActiveRound(ctx);
    expect(payloadOf(ctx, 2).intervals).toHaveLength(1);
    expect(report(ctx, 'Anna', 1).playtime![2]).toBe(10 * MIN);
    expect(events(ctx)).toHaveLength(3);
  });

  it('cuts an interval at the cutoff and writes nothing after a close', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', -10, 5);
    played(ctx, 'u_Anna', 8, 9);
    const t0 = ctx.now();
    closeActiveRound(ctx);
    expect(payloadOf(ctx, 2).intervals).toEqual([[t0 - 10 * MIN, t0]]);
    // The game goes on after „Runde abschließen“: the archive stays frozen.
    ctx.clock.t += 3 * DAY_MS;
    played(ctx, 'u_Anna', 0, 90);
    expect(report(ctx, 'Anna', 1).playtime![2]).toBe(10 * MIN);
  });

  it('keeps the rows of playtime_events when the round closes', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 10);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    expect(ctx.playtime.active('u_Anna', 0, FOREVER, 1)).toHaveLength(1);
  });

  it('archives the play time of the old round when „Neue Runde“ closes it', () => {
    const ctx = setup();
    played(ctx, 'u_Bert', -12, 0);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    expect(ctx.rounds.get(1)!.status).toBe('closed');
    expect(report(ctx, 'Bert', 1).playtime![3]).toBe(12 * MIN);
  });

  it('refuses the close when a play time event is missing', () => {
    const ctx = setup();
    const add = ctx.rounds.addEvent.bind(ctx.rounds);
    ctx.rounds.addEvent = (round, at, e) => {
      if (e.kind !== ROUND_EVENT.playtime) add(round, at, e);
    };
    expect(() => closeActiveRound(ctx)).toThrow(
      'Das Archiv der Runde ist unvollständig.',
    );
  });
});

describe('who sees the play time (#235 D2)', () => {
  function closed(): TestCtx {
    const ctx = setup();
    played(ctx, 'u_Anna', -30, 0);
    played(ctx, 'u_Bert', -7, 0);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    const dora = addUser(ctx, 'Dora');
    addPlanet(ctx, dora.id, { g: 1, s: 2, p: 1, b: { metal: 1 } });
    return ctx;
  }

  it('shows every participant of a finished round the time of all, the sum only', () => {
    const ctx = closed();
    const times = { 1: 0, 2: 30 * MIN, 3: 7 * MIN };
    expect(report(ctx, 'Bert', 1).playtime).toEqual(times);
    expect(report(ctx, 'Anna', 1).playtime).toEqual(times);
    expect(report(ctx, 'Ada', 1).playtime).toEqual(times);
    // No interval and no start time reaches the reader.
    expect(JSON.stringify(report(ctx, 'Bert', 1))).not.toContain('intervals');
  });

  it('refuses a player who did not take part, like a round that does not exist', () => {
    const ctx = closed();
    expect(() => report(ctx, 'Dora', 1)).toThrow(REFUSED);
    expect(() => report(ctx, 'Dora', 9)).toThrow(REFUSED);
  });

  it('keeps it private while the round runs, also in the provisional report of the admin', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 30);
    expect(() => report(ctx, 'Anna', 1)).toThrow(REFUSED);
    const provisional = report(ctx, 'Ada', 1);
    expect(provisional.round.provisional).toBe(true);
    expect(provisional.playtime).toBeNull();
  });

  it('writes nothing while reading: the provisional report adds no event', () => {
    const ctx = setup();
    report(ctx, 'Ada', 1);
    expect(events(ctx)).toEqual([]);
  });
});

describe('an old archive and a deleted account', () => {
  it('leaves a round archived before the play time without it: unknown, not zero', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', -30, 0);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    ctx.db
      .prepare('DELETE FROM round_events WHERE kind = ?')
      .run(ROUND_EVENT.playtime);
    expect(report(ctx, 'Anna', 1).playtime).toBeNull();
    // The rest of the report is unaffected.
    expect(report(ctx, 'Anna', 1).rows).toHaveLength(3);
  });

  it('keeps the time of a deleted account under the pseudonym, with no link back', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', -30, 0);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    deleteAccount(ctx, ctx.players.get('u_Anna')!, 'secret1');
    // The account's own rows go with it; the archive keeps its copy.
    expect(ctx.playtime.active('u_Anna', 0, FOREVER)).toEqual([]);
    const r = report(ctx, 'Bert', 1);
    const row = r.rows.find((x) => x.name === DELETED_PLAYER)!;
    expect(r.playtime![row.seat]).toBe(30 * MIN);
    expect(r.rows.map((x) => x.name)).not.toContain('Anna');
    const all = JSON.stringify(ctx.rounds.events(1));
    expect(all).not.toContain('u_Anna');
    expect(all).not.toContain('Anna');
  });
});

describe('„Runde löschen“ and the play time rows (#232: kept until the admin deletes the round)', () => {
  it('deletes the rows of that round with it, and only those', () => {
    const ctx = setup();
    played(ctx, 'u_Anna', 0, 10);
    runAction(ctx, 'u_Ada', { type: 'reset' });
    played(ctx, 'u_Anna', 20, 40, { round: 2 });
    runAction(ctx, 'u_Ada', { type: 'deleteRound', round: 1 });
    expect(events(ctx)).toEqual([]);
    expect(ctx.playtime.active('u_Anna', 0, FOREVER, 1)).toEqual([]);
    expect(ctx.playtime.active('u_Anna', 0, FOREVER, 2)).toHaveLength(1);
  });
});

describe('the size of the play time in an archive', () => {
  it('of a round of 14 days with 20 players who play 6 hours a day in stretches of 5 minutes', () => {
    const ctx = testCtx();
    const users: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const u = addUser(ctx, `P${i}`);
      addPlanet(ctx, u.id, { g: 1, s: i, p: 1, b: { metal: 1 } });
      users.push(u.id);
    }
    const t0 = ctx.now();
    // 72 stretches a day of 5 minutes, one every 20 minutes, over 14 days.
    for (const [n, id] of users.entries())
      for (let day = 0; day < 14; day++)
        for (let k = 0; k < 72; k++) {
          const from = day * 1440 + n + k * 20;
          played(ctx, id, from, from + 5);
        }
    ctx.clock.t = t0 + 14 * DAY_MS;
    closeActiveRound(ctx);
    const bytes = ctx.db
      .prepare(
        'SELECT SUM(LENGTH(payload) + LENGTH(kind) + 40) FROM round_events WHERE kind = ?',
      )
      .pluck()
      .get(ROUND_EVENT.playtime) as number;
    expect(events(ctx)).toHaveLength(20);
    expect(payloadOf(ctx, 1).intervals).toHaveLength(14 * 72);
    // About 1 000 intervals of 30 bytes per player: roughly 600 KB for the round.
    expect(bytes).toBeLessThan(700_000);
    expect(bytes).toBeGreaterThan(400_000);
  });
});
