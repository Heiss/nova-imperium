// The lines of „Achtung“ and „Bereit“ register themselves since #426 part 4
// (#448). They must give the same lines as before: this test holds the two
// cards as they were (one function each, every source named) and compares
// them with the registry on generated view states, line for line. It also
// checks that every key a source gives is of a kind it declares, so the
// check of the kinds at the start covers the keys drawn (#448 review).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../core/achievements.ts';
import { production } from '../../core/economy.ts';
import { MISSION } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import type { Mission } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { coords, fmt } from './format.ts';
import { fleetEnd, nameOf, sortFleets, unread } from './game.ts';
import { rewardHint } from './menu-hints.ts';
import { countdown } from './overview.ts';
import { attentionItems, type CardItem, readyItems } from './overview-cards.ts';
import type { OverviewLines } from './overview-cards/contract.ts';
import { OVERVIEW_LINES } from './overview-cards/lines.gen.ts';
import type { ClientFleet, GameState } from './types.ts';

// ----- frozen: client/logic/overview-cards.ts before #448 -----

const OLD_HOSTILE: ReadonlySet<Mission> = new Set([
  'attack',
  'moonbreak',
  'missile',
]);
const OLD_MOST_ATTACKS = 3;
const OLD_MOST_IDLE = 3;

function oldAttention(v: V): CardItem[] {
  const { s, P, R, now } = v;
  const incoming = sortFleets(
    s.fleets.filter(
      (f) =>
        f.owner !== s.me.id && f.state === 'out' && OLD_HOSTILE.has(f.mission),
    ),
  );
  const items: CardItem[] = incoming.slice(0, OLD_MOST_ATTACKS).map((f) => ({
    key: `fleet:${f.id}`,
    text: `${MISSION[f.mission]} von ${nameOf(s.players, f.owner)} ${coords(f.fromC)}`,
    due: countdown(fleetEnd(f), now),
  }));
  if (incoming.length > OLD_MOST_ATTACKS)
    items.push({
      key: 'more-fleets',
      text: `und ${incoming.length - OLD_MOST_ATTACKS} weitere Flotten`,
      link: { view: 'fleet', label: 'Zur Flotte' },
    });
  const pr = production(P, s.cfg, R.research);
  const missing = Math.ceil(pr.eUse - pr.eProd);
  if (missing > 0)
    items.push({
      key: 'energy',
      text: `Zu wenig Energie: es fehlen ${fmt(missing)}`,
      link: { view: 'buildings', label: 'Zu den Gebäuden' },
    });
  return items;
}

function oldIdle({ s }: V): CardItem[] {
  const places = (s.idle ?? []).flatMap((id) => {
    const p = s.galaxy.find((x) => x.id === id);
    return p ? [{ id, text: `${placeName(p)} ${coords(p)}` }] : [];
  });
  const items: CardItem[] = places.slice(0, OLD_MOST_IDLE).map((p) => ({
    key: `idle:${p.id}`,
    text: `Bauschleife leer: ${p.text}`,
    select: { id: p.id, label: 'Wechseln' },
  }));
  if (places.length > OLD_MOST_IDLE)
    items.push({
      key: 'more-idle',
      text: `und ${places.length - OLD_MOST_IDLE} weitere`,
    });
  return items;
}

function oldReady(v: V): CardItem[] {
  const { s } = v;
  const items: CardItem[] = [];
  const reward = rewardHint(s);
  if (reward)
    items.push({
      key: 'reward',
      text: reward,
      link: { view: 'achievements', label: 'Abholen' },
    });
  const fresh = unread(s.reports, s.me.readAt);
  if (fresh)
    items.push({
      key: 'unread',
      text:
        fresh === 1
          ? '1 ungelesene Nachricht'
          : `${fresh} ungelesene Nachrichten`,
      link: { view: 'messages', label: 'Lesen' },
    });
  return [...items, ...oldIdle(v)];
}

// ----- generated view states -----

const MISSIONS = Object.keys(MISSION) as Mission[];
const PLACES = ['p1_1_4', 'p1_2_6', 'm1_2_6', 'p2_5_9', 'p3_7_1'];

const fleetArb = fc.record({
  owner: fc.constantFrom('u1', 'u2', 'u3'),
  // Half the fleets an attack, so more than three come together too.
  mission: fc.oneof(
    fc.constantFrom<Mission>('attack', 'moonbreak', 'missile'),
    fc.constantFrom(...MISSIONS),
  ),
  state: fc.constantFrom('out', 'back', 'hold'),
  arr: fc.integer({ min: 0, max: 20_000 }),
  ret: fc.option(fc.integer({ min: 0, max: 40_000 }), { nil: undefined }),
  from: fc.integer({ min: 1, max: 15 }),
});

const viewArb = fc
  .record({
    fleets: fc.array(fleetArb, { maxLength: 12 }),
    metal: fc.integer({ min: 0, max: 25 }),
    solar: fc.integer({ min: 0, max: 25 }),
    reports: fc.array(fc.integer({ min: 0, max: 2000 }), { maxLength: 4 }),
    readAt: fc.integer({ min: 0, max: 2000 }),
    achievementsOn: fc.boolean(),
    rewards: fc.option(
      fc.record({
        progress: fc.integer({ min: 0, max: 1_000_000 }),
        daily: fc.option(fc.boolean(), { nil: null }),
      }),
      { nil: undefined },
    ),
    idle: fc.option(fc.subarray([...PLACES, 'p9_9_9']), { nil: undefined }),
    galaxy: fc.subarray(PLACES),
    now: fc.integer({ min: 0, max: 20_000 }),
  })
  .map((o): V => {
    const fleets = o.fleets.map(
      (f, i): ClientFleet =>
        ({
          id: `f${i}`,
          owner: f.owner,
          fromC: { g: 1, s: f.from, p: 7 },
          toC: { g: 1, s: 1, p: 5 },
          to: 'p1_1_5',
          mission: f.mission,
          state: f.state,
          arr: f.arr,
          ...(f.ret === undefined ? {} : { ret: f.ret }),
        }) as ClientFleet,
    );
    const s = {
      cfg: U,
      me: { id: 'u1', readAt: o.readAt },
      round: { achievements: o.achievementsOn, daily: true },
      planet: {},
      galaxy: o.galaxy.map((id) => {
        const [g, sys, p] = id.slice(1).split('_').map(Number);
        return {
          id,
          kind: id.startsWith('m') ? 'moon' : 'planet',
          name: `Ort ${id}`,
          g,
          s: sys,
          p,
        };
      }),
      idle: o.idle,
      fleets,
      reports: o.reports.map((time, i) => ({
        id: `r${i}`,
        time,
        type: 'info',
        title: `r${i}`,
      })),
      achievements: o.rewards && {
        // Every metric at the generated progress: none, some or all reached.
        progress: Object.fromEntries(
          ACHIEVEMENTS.map((a) => [a.metric, o.rewards!.progress]),
        ),
        claimed: [],
        daily: o.rewards.daily === null ? null : { claimed: o.rewards.daily },
      },
      players: {
        u1: { name: 'Ich', points: 1 },
        u2: { name: 'Feind', points: 2 },
        u3: { name: 'Fremd', points: 3 },
      },
    } as unknown as GameState;
    return {
      s,
      P: planet({ b: { metal: o.metal, solar: o.solar } }),
      R: { research: {}, rq: null },
      now: o.now,
      ui: {} as Ui,
    };
  });

describe('the overview lines as before the registry (#426 part 4, #448)', () => {
  it('gives „Achtung“ and „Bereit“ line for line as the old code', () => {
    fc.assert(
      fc.property(viewArb, (v) => {
        expect(attentionItems(v)).toStrictEqual(oldAttention(v));
        expect(readyItems(v)).toStrictEqual(oldReady(v));
      }),
      { numRuns: 400 },
    );
  });

  it('gives only keys of the kinds each source declares', () => {
    const sources = OVERVIEW_LINES.flatMap(
      ([, list]) => list as readonly OverviewLines[],
    );
    fc.assert(
      fc.property(viewArb, (v) => {
        for (const source of sources)
          for (const { key } of source.lines(v))
            expect(source.keys, key).toContain(key.split(':')[0]);
      }),
      { numRuns: 400 },
    );
  });

  it('meets every line of both cards in the generated states', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(viewArb, (v) => {
        for (const { key } of [...oldAttention(v), ...oldReady(v)])
          seen.add(key.split(':')[0]!);
      }),
      { numRuns: 400, seed: 441 },
    );
    expect([...seen].sort()).toEqual([
      'energy',
      'fleet',
      'idle',
      'more-fleets',
      'more-idle',
      'reward',
      'unread',
    ]);
  });
});
