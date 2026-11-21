// The Runden-Rewind on the server with events in the round (#235, owner
// 2026-11-21): the action `roundRewind` hands the events of a finished round
// to the cards, with the access rules of the report unchanged.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/activity.ts';
import { UNIT } from '../../core/catalog.ts';
import { EVENT_KIND, EVENT_VERSION } from '../../core/round-events.ts';
import type { Rewind } from '../../core/round-rewind.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import type { Answer } from './actions.ts';
import { runAction } from './dispatch.ts';
import { joinRound } from './round-events.ts';

const lf = UNIT.lf!.cost;

/** Anna and Bert play round 1; Anna's events are written by hand, the round is closed after 3 days. */
function closed(version = EVENT_VERSION): TestCtx {
  const ctx = testCtx();
  ctx.clock.t += 100 * DAY_MS;
  ctx.db.prepare('UPDATE rounds SET started = ?').run(ctx.now());
  const ada = addUser(ctx, 'Ada', { admin: true });
  const anna = addUser(ctx, 'Anna');
  const bert = addUser(ctx, 'Bert');
  addPlanet(ctx, ada.id, { g: 1, s: 1, p: 1, b: { metal: 2 } });
  addPlanet(ctx, anna.id, { g: 1, s: 1, p: 2, b: { metal: 12 } });
  addPlanet(ctx, bert.id, { g: 1, s: 1, p: 3, b: { metal: 6 } });
  const seat = joinRound(ctx, anna.id, 'home')!;
  const add = (day: number, kind: string, payload: object) =>
    ctx.rounds.addEvent(1, ctx.now(), {
      at: ctx.now() + day * DAY_MS,
      kind,
      seat,
      version,
      payload,
    });
  add(1, EVENT_KIND.action, {
    cause: 'build',
    ok: true,
    prod: [
      {
        place: 'p1_1_2',
        owner: seat,
        from: 0,
        to: 1,
        m: 5000,
        c: 0,
        d: 0,
        f: 1,
        unitsCost: { ships: lf.map((x) => x * 4) },
      },
    ],
  });
  ctx.clock.t += 3 * DAY_MS;
  runAction(ctx, 'u_Ada', { type: 'reset' });
  return ctx;
}

const ask = (ctx: TestCtx, who: string): Rewind =>
  (runAction(ctx, `u_${who}`, { type: 'roundRewind', round: 1 }) as Answer)
    .data!.rewind as Rewind;

describe('the Rewind of a round with events', () => {
  it('gives the participant the cards of their events, and the others the short form', () => {
    const ctx = closed();
    const anna = ask(ctx, 'Anna');
    expect(anna.cards.map((c) => c.slot)).toEqual([1, 2, 3, 6, 8]);
    expect(anna.cards[1]).toMatchObject({ kind: 'economy', total: 5000 });
    expect(anna.cards[2]).toMatchObject({
      kind: 'focus',
      focus: 'fleet',
      percent: 100,
    });
    expect(ask(ctx, 'Bert').cards.map((c) => c.slot)).toEqual([1, 6, 8]);
  });

  it('gives a round of version 1 the short form', () => {
    expect(ask(closed(1), 'Anna').cards.map((c) => c.slot)).toEqual([1, 6, 8]);
  });

  it('still refuses a reader who took no part', () => {
    const ctx = closed();
    addUser(ctx, 'Cora');
    expect(() =>
      runAction(ctx, 'u_Cora', { type: 'roundRewind', round: 1 }),
    ).toThrow();
  });
});
