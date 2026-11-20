// The reports of the archive (#235): who may open which round, what a report
// holds, the history across rounds and the audit of the admin's reads.
import { describe, expect, it } from 'vitest';
import {
  DELETED_PLAYER,
  type HistoryEntry,
  type RoundEntry,
  type RoundReport,
} from '../../core/round-report.ts';
import { deleteAccount } from '../delete-account.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import type { Answer } from './actions.ts';
import { runAction } from './dispatch.ts';
import { ARCHIVE_LIMIT, HISTORY_LIMIT } from './round-report.ts';

const DAY = 86400000;
const REFUSED = 'Dieser Rundenbericht ist nicht verfügbar.';

/** Ada (admin), Anna the strongest, Bert; Dora joins after round 1 ended. */
function setup(): TestCtx {
  const ctx = testCtx();
  // The migration dated round 1 with the real clock; the test clock is its own.
  ctx.db.prepare('UPDATE rounds SET started = ?').run(ctx.now());
  const ada = addUser(ctx, 'Ada', { admin: true });
  const anna = addUser(ctx, 'Anna');
  const bert = addUser(ctx, 'Bert');
  addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 2,
    b: { metal: 12, crystal: 8 },
    ships: { lc: 8 },
  });
  addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3, b: { metal: 6 } });
  return ctx;
}

const answer = (ctx: TestCtx, who: string, d: Record<string, unknown>) =>
  runAction(ctx, `u_${who}`, d) as Answer;

const report = (ctx: TestCtx, who: string, round: number): RoundReport =>
  answer(ctx, who, { type: 'roundReport', round }).data!.report as RoundReport;

const list = (ctx: TestCtx, who: string): RoundEntry[] =>
  answer(ctx, who, { type: 'roundArchive' }).data!.rounds as RoundEntry[];

const history = (ctx: TestCtx, who: string): HistoryEntry[] =>
  answer(ctx, who, { type: 'roundHistory' }).data!.history as HistoryEntry[];

/** Round 1 closed after 3 days by the reset, Dora then plays round 2. */
function twoRounds(): TestCtx {
  const ctx = setup();
  ctx.clock.t += 3 * DAY;
  runAction(ctx, 'u_Ada', { type: 'reset' });
  const dora = addUser(ctx, 'Dora');
  addPlanet(ctx, dora.id, { g: 1, s: 2, p: 1, b: { metal: 3 } });
  return ctx;
}

describe('the report of a finished round', () => {
  it('shows a participant the round, the ranking by points and their own place', () => {
    const ctx = twoRounds();
    const r = report(ctx, 'Bert', 1);
    expect(r.round).toMatchObject({
      number: 1,
      provisional: false,
      days: 3,
      coverage: 'complete',
      closed: r.round.asOf,
    });
    expect(r.rows.map((x) => [x.name, x.you])).toEqual([
      ['Anna', false],
      ['Bert', true],
      ['Ada', false],
    ]);
    expect(r.you).toMatchObject({ rank: 2, of: 3 });
    expect(r.rows[0]!.valuation.total).toBeGreaterThan(
      r.rows[1]!.valuation.total,
    );
    expect(r.rows[0]).toMatchObject({ planets: 1, moons: 0, guild: null });
    // The rules the round ran under are part of it.
    expect(r.round.rules).toMatchObject({ number: 1 });
  });

  it('shows the play time of the archived round: a measured zero without recorded time', () => {
    const ctx = twoRounds();
    expect(report(ctx, 'Anna', 1).playtime).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('leaves out the ids of the other players', () => {
    const ctx = twoRounds();
    expect(JSON.stringify(report(ctx, 'Bert', 1))).not.toContain('u_');
  });

  it('shows the guilds of the round with the sum of the points of their members', () => {
    const ctx = setup();
    ctx.guilds.create('g1', 'ABC', 'Die Alten', '', 'u_Anna');
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.accept('u_Bert');
    runAction(ctx, 'u_Ada', { type: 'reset' });
    const r = report(ctx, 'Anna', 1);
    expect(r.rows.find((x) => x.name === 'Bert')!.guild).toEqual({
      tag: 'ABC',
      name: 'Die Alten',
    });
    const sum = r.rows
      .filter((x) => x.guild)
      .reduce((s, x) => s + x.valuation.total, 0);
    expect(r.guilds).toEqual([
      { tag: 'ABC', name: 'Die Alten', members: 2, points: sum },
    ]);
  });

  it('stays available after later resets', () => {
    const ctx = twoRounds();
    runAction(ctx, 'u_Ada', { type: 'reset' });
    expect(report(ctx, 'Anna', 1).round.number).toBe(1);
    expect(report(ctx, 'Dora', 2).round.number).toBe(2);
  });

  it('shows a deleted account under the pseudonym with its numbers', () => {
    const ctx = twoRounds();
    const before = report(ctx, 'Anna', 1).rows.find((x) => x.name === 'Bert')!;
    deleteAccount(ctx, ctx.players.get('u_Bert')!, 'secret1');
    const after = report(ctx, 'Anna', 1);
    const row = after.rows.find((x) => x.name === DELETED_PLAYER)!;
    expect(row.valuation).toEqual(before.valuation);
    expect(row.you).toBe(false);
    expect(after.rows.map((x) => x.name)).not.toContain('Bert');
  });
});

describe('who may open a report (#235, access contract)', () => {
  it('refuses a player a round they did not take part in, like a round that does not exist', () => {
    const ctx = twoRounds();
    // Dora joined after round 1; Anna did not play round 2 (reset gave her a planet, so she did).
    expect(() => report(ctx, 'Dora', 1)).toThrow(REFUSED);
    expect(() => report(ctx, 'Dora', 99)).toThrow(REFUSED);
    expect(() => report(ctx, 'Dora', -1)).toThrow(REFUSED);
  });

  it('refuses a player the running round, also one they play', () => {
    const ctx = twoRounds();
    expect(() => report(ctx, 'Dora', 2)).toThrow(REFUSED);
    expect(() => report(ctx, 'Anna', 2)).toThrow(REFUSED);
  });

  it('gives the admin any finished round', () => {
    const ctx = twoRounds();
    expect(report(ctx, 'Ada', 1).rows).toHaveLength(3);
  });

  it('gives the admin the running round as a provisional report and writes nothing', () => {
    const ctx = twoRounds();
    ctx.clock.t += DAY;
    // Not counted: the journal writes the read itself as an action of the admin.
    const events = () =>
      ctx.rounds.events(2).filter((e) => !e.kind.startsWith('journal.'));
    const before = events();
    // The seats of the round were given when the players joined (#235 events).
    const seats = ctx.rounds.participants(2);
    const r = report(ctx, 'Ada', 2);
    expect(r.round).toMatchObject({
      provisional: true,
      closed: null,
      asOf: ctx.now(),
      days: 1,
    });
    expect(r.rows.map((x) => x.name).sort()).toEqual(
      ['Ada', 'Anna', 'Bert', 'Dora'].sort(),
    );
    expect(ctx.rounds.get(2)!.status).toBe('active');
    expect(events()).toEqual(before);
    expect(ctx.rounds.participants(2)).toEqual(seats);
    // Reading again changes nothing either.
    expect(report(ctx, 'Ada', 2)).toEqual(r);
  });

  it('lets only the admin delete and close, so a player cannot reach the archive otherwise', () => {
    const ctx = twoRounds();
    expect(() =>
      answer(ctx, 'Anna', { type: 'deleteRound', round: 1 }),
    ).toThrow('Nur der Admin');
  });

  it('refuses a deleted round to everybody, the admin too', () => {
    const ctx = twoRounds();
    runAction(ctx, 'u_Ada', { type: 'deleteRound', round: 1 });
    expect(() => report(ctx, 'Ada', 1)).toThrow(REFUSED);
    expect(() => report(ctx, 'Anna', 1)).toThrow(REFUSED);
  });
});

describe('the list of rounds', () => {
  it('shows a player their finished rounds and the lock of the running one', () => {
    const ctx = twoRounds();
    expect(list(ctx, 'Anna')).toEqual([
      expect.objectContaining({
        number: 2,
        status: 'active',
        locked: true,
        participants: null,
        you: null,
      }),
      expect.objectContaining({
        number: 1,
        status: 'closed',
        locked: false,
        participants: 3,
        you: expect.objectContaining({ rank: 1, of: 3 }),
      }),
    ]);
    // Dora did not play round 1: it is absent for her.
    expect(list(ctx, 'Dora').map((x) => x.number)).toEqual([2]);
  });

  it('shows the admin every round, the running one open', () => {
    const ctx = twoRounds();
    expect(list(ctx, 'Ada').map((x) => [x.number, x.locked])).toEqual([
      [2, false],
      [1, false],
    ]);
  });

  it('carries no report data for a locked round', () => {
    const ctx = twoRounds();
    const [running] = list(ctx, 'Anna');
    expect(Object.keys(running!).sort()).toEqual(
      [
        'closed',
        'coverage',
        'locked',
        'number',
        'participants',
        'started',
        'status',
        'you',
      ].sort(),
    );
  });

  it('is bounded to the newest rounds', () => {
    const ctx = setup();
    for (let n = 2; n < ARCHIVE_LIMIT + 20; n++)
      ctx.rounds.open({
        number: n,
        started: n,
        coverage: 'complete',
        rules: {},
      });
    expect(list(ctx, 'Ada')).toHaveLength(ARCHIVE_LIMIT);
    expect(list(ctx, 'Ada')[0]!.number).toBe(ARCHIVE_LIMIT + 19);
  });
});

describe('the history across rounds (slice 3)', () => {
  it('compares the finished rounds of a player: length, settings, winner, own place and values', () => {
    const ctx = twoRounds();
    ctx.clock.t += 2 * DAY;
    runAction(ctx, 'u_Ada', { type: 'reset' });
    const rows = history(ctx, 'Anna');
    expect(rows.map((x) => [x.number, x.days, x.participants])).toEqual([
      [2, 2, 4],
      [1, 3, 3],
    ]);
    const first = rows[1]!;
    expect(first.winner).toMatchObject({ name: 'Anna' });
    expect(first.you).toMatchObject({ rank: 1, of: 3, planets: 1, moons: 0 });
    expect(first.you!.points).toBe(first.winner!.points);
    expect(first.rules).toMatchObject({ number: 1 });
    expect(first.coverage).toBe('complete');
  });

  it('lists only rounds the player took part in and never the running one', () => {
    const ctx = twoRounds();
    expect(history(ctx, 'Dora')).toEqual([]);
    expect(history(ctx, 'Anna').map((x) => x.number)).toEqual([1]);
  });

  it('gives the admin all finished rounds without a personal place', () => {
    const ctx = twoRounds();
    const rows = history(ctx, 'Ada');
    expect(rows.map((x) => x.number)).toEqual([1]);
    expect(rows[0]!.you).toMatchObject({ rank: 3 });
  });

  it('names a pseudonym for a deleted winner', () => {
    const ctx = twoRounds();
    deleteAccount(ctx, ctx.players.get('u_Anna')!, 'secret1');
    expect(history(ctx, 'Bert')[0]!.winner!.name).toBe(DELETED_PLAYER);
  });

  it('is bounded to the newest rounds', () => {
    const ctx = setup();
    const ada = ctx.players.get('u_Ada')!;
    for (let n = 2; n < HISTORY_LIMIT + 10; n++) {
      ctx.rounds.open({
        number: n,
        started: n,
        coverage: 'complete',
        rules: {},
      });
      ctx.rounds.addParticipant({
        round: n,
        seat: 1,
        player: ada.id,
        name: 'Ada',
      });
      ctx.rounds.close(n, n + DAY, {}, 0);
    }
    const rows = history(ctx, 'Ada');
    expect(rows).toHaveLength(HISTORY_LIMIT);
    expect(rows[0]!.number).toBe(HISTORY_LIMIT + 9);
    // A round without a final event has no ranking, so no winner and no place.
    expect(rows[0]).toMatchObject({ participants: 0, winner: null, you: null });
  });
});

describe('the audit of the reads of the admin', () => {
  const entries = (ctx: TestCtx) =>
    ctx.db
      .prepare(
        "SELECT actor, action, category, detail FROM audit_events WHERE category = 'admin.read' ORDER BY id",
      )
      .all() as {
      actor: string;
      action: string;
      category: string;
      detail: string;
    }[];

  it('records the opening of a report and of the history', () => {
    const ctx = twoRounds();
    report(ctx, 'Ada', 2);
    report(ctx, 'Ada', 1);
    history(ctx, 'Ada');
    expect(
      entries(ctx).map((e) => [e.actor, e.action, JSON.parse(e.detail)]),
    ).toEqual([
      ['u_Ada', 'roundReport', { round: 2, provisional: true }],
      ['u_Ada', 'roundReport', { round: 1, provisional: false }],
      ['u_Ada', 'roundHistory', {}],
    ]);
  });

  it('records no read of a player', () => {
    const ctx = twoRounds();
    report(ctx, 'Anna', 1);
    history(ctx, 'Anna');
    expect(entries(ctx)).toEqual([]);
  });
});
