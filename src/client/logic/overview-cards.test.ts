// The cards of the phone overview (#189, D5): what runs, what needs the
// player (an attack on the way, too little energy) and what is ready (a
// reward, new messages). Hand-built cases for every boundary.
import { describe, expect, it } from 'vitest';
import { MISSION } from '../../core/missions.ts';
import type { Planet, ResearchQueue } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { countdown } from './overview.ts';
import {
  attentionItems,
  MOST_ATTACKS,
  overviewCards,
  readyItems,
  runningItems,
} from './overview-cards.ts';
import type { ClientFleet, GameState, Report } from './types.ts';

interface Setup {
  P?: Partial<Planet>;
  rq?: ResearchQueue | null;
  fleets?: ClientFleet[];
  reports?: Report[];
  readAt?: number;
  achievements?: GameState['achievements'];
  round?: Partial<GameState['round']>;
  now?: number;
}

function view(o: Setup = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', readAt: o.readAt ?? 0 },
    round: { achievements: true, daily: true, ...o.round },
    planet: {},
    galaxy: [],
    fleets: o.fleets ?? [],
    reports: o.reports ?? [],
    achievements: o.achievements,
    players: {
      u1: { name: 'Ich', points: 1 },
      u2: { name: 'Feind', points: 2 },
    },
  } as unknown as GameState;
  return {
    s,
    P: planet(o.P),
    R: { research: {}, rq: o.rq ?? null },
    now: o.now ?? 1000,
    ui: {} as Ui,
  };
}

const fleet = (o: Partial<ClientFleet> = {}): ClientFleet => ({
  id: 'f1',
  owner: 'u2',
  fromC: { g: 1, s: 3, p: 7 },
  toC: { g: 1, s: 1, p: 5 },
  to: 'p1_1_5',
  mission: 'attack',
  state: 'out',
  arr: 5000,
  ...o,
});

const report = (id: string, time: number): Report => ({
  id,
  time,
  type: 'info',
  title: id,
});

const queue = (o: Partial<ResearchQueue>): ResearchQueue => ({
  key: 'energy',
  lvl: 2,
  start: 0,
  end: 0,
  cost: [0, 0, 0],
  ...o,
});

describe('Läuft', () => {
  it('is empty when nothing runs', () => {
    expect(runningItems(view())).toEqual([]);
  });

  it('shows the three orders with their countdown and bar', () => {
    const v = view({
      now: 1500,
      P: {
        bq: queue({ key: 'metal', lvl: 4, start: 1000, end: 3000 }),
        sq: [{ key: 'lf', n: 3, unit: 400 }],
        sqT: 1200,
      },
      rq: queue({ start: 500, end: 2500 }),
    });
    const [build, research, yard] = runningItems(v);
    expect(build).toMatchObject({
      label: 'Gebäude',
      what: 'Adamant-Tiefbohrung (Stufe 4)',
      due: countdown(3000, 1500),
      max: 2000,
      value: 500,
      next: false,
    });
    expect(research).toMatchObject({
      label: 'Forschung',
      due: countdown(2500, 1500),
      max: 2000,
      value: 1000,
    });
    // The bar of the shipyard is the unit that is being built.
    expect(yard).toMatchObject({
      label: 'Schiffsschmiede',
      due: countdown(1600, 1500),
      max: 400,
      value: 300,
      next: true,
    });
  });

  it('keeps the bar between empty and full', () => {
    const late = runningItems(
      view({ now: 9000, P: { bq: queue({ start: 1000, end: 3000 }) } }),
    );
    expect(late[0]).toMatchObject({ max: 2000, value: 2000 });
    const early = runningItems(
      view({ now: 100, P: { bq: queue({ start: 1000, end: 3000 }) } }),
    );
    expect(early[0]).toMatchObject({ max: 2000, value: 0 });
    // An order that ends where it starts has a bar of length 1, not 0.
    const empty = runningItems(
      view({ now: 1000, P: { bq: queue({ start: 1000, end: 1000 }) } }),
    );
    expect(empty[0]).toMatchObject({ max: 1, value: 0 });
  });

  it('starts the bar of a shipyard without a start time now', () => {
    const [yard] = runningItems(
      view({ now: 1000, P: { sq: [{ key: 'lf', n: 1, unit: 500 }] } }),
    );
    expect(yard).toMatchObject({ max: 500, value: 0 });
  });
});

describe('Achtung', () => {
  it('is empty without an attack and with energy', () => {
    expect(attentionItems(view())).toEqual([]);
  });

  it('names an attack, its sender, origin and arrival', () => {
    expect(attentionItems(view({ fleets: [fleet()] }))).toEqual([
      {
        text: `${MISSION.attack} von Feind [1:3:7]`,
        due: countdown(5000, 1000),
      },
    ]);
  });

  it('counts the Mondbruch and the missiles, but no spy, transport, deployment or holding fleet', () => {
    const missions = [
      'attack',
      'moonbreak',
      'missile',
      'spy',
      'transport',
      'deploy',
      'hold',
    ] as const;
    const items = attentionItems(
      view({
        fleets: missions.map((mission, i) =>
          fleet({ id: `f${i}`, mission, arr: 2000 + i }),
        ),
      }),
    );
    expect(items.map((i) => i.text)).toEqual([
      `${MISSION.attack} von Feind [1:3:7]`,
      `${MISSION.moonbreak} von Feind [1:3:7]`,
      `${MISSION.missile} von Feind [1:3:7]`,
    ]);
  });

  it('leaves out own fleets and fleets that are not on their way out', () => {
    expect(
      attentionItems(
        view({
          fleets: [
            fleet({ owner: 'u1' }),
            fleet({ id: 'f2', state: 'back' }),
            fleet({ id: 'f3', state: 'hold' }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('names an unknown sender', () => {
    const [item] = attentionItems(view({ fleets: [fleet({ owner: 'u9' })] }));
    expect(item!.text).toBe(`${MISSION.attack} von Unbekannt [1:3:7]`);
  });

  it('lists the attacks by their arrival and counts those beyond the most', () => {
    const fleets = Array.from({ length: MOST_ATTACKS + 2 }, (_, i) =>
      fleet({ id: `f${i}`, arr: 9000 - i * 100 }),
    );
    const items = attentionItems(view({ fleets }));
    expect(items).toHaveLength(MOST_ATTACKS + 1);
    // The soonest first.
    expect(items[0]!.due).toEqual(
      countdown(9000 - (MOST_ATTACKS + 1) * 100, 1000),
    );
    expect(items.at(-1)).toEqual({
      text: 'und 2 weitere Flotten',
      link: { view: 'fleet', label: 'Zur Flotte' },
    });
  });

  it('shows exactly the most attacks without a rest line', () => {
    const fleets = Array.from({ length: MOST_ATTACKS }, (_, i) =>
      fleet({ id: `f${i}` }),
    );
    const items = attentionItems(view({ fleets }));
    expect(items).toHaveLength(MOST_ATTACKS);
    expect(items.every((i) => i.due)).toBe(true);
  });

  it('shows missing energy with a link to the buildings', () => {
    // Without a Sonnenkathedrale a mine uses energy and nothing makes it.
    const [item] = attentionItems(view({ P: { b: { metal: 10 } } }));
    expect(item).toMatchObject({
      link: { view: 'buildings', label: 'Zu den Gebäuden' },
    });
    expect(item!.text).toMatch(/^Zu wenig Energie: es fehlen [\d.]+$/);
  });

  it('shows no energy line when production covers the use', () => {
    expect(
      attentionItems(view({ P: { b: { metal: 10, solar: 20 } } })),
    ).toEqual([]);
  });

  it('puts the attack before the energy', () => {
    const items = attentionItems(
      view({ fleets: [fleet()], P: { b: { metal: 10 } } }),
    );
    expect(items[0]!.due).toBeDefined();
    expect(items[1]!.link?.view).toBe('buildings');
  });
});

describe('Bereit', () => {
  it('is empty without a reward and without new messages', () => {
    expect(readyItems(view())).toEqual([]);
  });

  it('offers the daily reward and the achievement, together or alone', () => {
    const daily = { claimed: false } as NonNullable<
      GameState['achievements']
    >['daily'];
    const progress = { 'buildings:metal': 999 };
    const open = (a: Partial<NonNullable<GameState['achievements']>>) =>
      readyItems(
        view({
          achievements: { progress: {}, claimed: [], daily: null, ...a },
        }),
      );
    const link = { view: 'achievements', label: 'Abholen' };
    expect(open({ daily })).toEqual([
      { text: 'Tagesbelohnung abholbar', link },
    ]);
    expect(open({ daily: { ...daily!, claimed: true } })).toEqual([]);
    const both = open({ daily, progress });
    expect(both[0]!.text).toBe('Erfolg und Tagesbelohnung abholbar');
    const one = open({ progress });
    expect(one).toEqual([{ text: 'Erfolg abholbar', link }]);
  });

  it('counts the messages newer than the last reading', () => {
    const reports = [report('a', 100), report('b', 200), report('c', 300)];
    expect(readyItems(view({ reports, readAt: 200 }))).toEqual([
      {
        text: '1 ungelesene Nachricht',
        link: { view: 'messages', label: 'Lesen' },
      },
    ]);
    expect(readyItems(view({ reports, readAt: 100 }))[0]!.text).toBe(
      '2 ungelesene Nachrichten',
    );
    expect(readyItems(view({ reports, readAt: 300 }))).toEqual([]);
  });

  it('lists the reward before the messages', () => {
    const items = readyItems(
      view({
        reports: [report('a', 100)],
        achievements: {
          progress: {},
          claimed: [],
          daily: { claimed: false } as never,
        },
      }),
    );
    expect(items.map((i) => i.link?.view)).toEqual([
      'achievements',
      'messages',
    ]);
  });
});

it('puts the three cards together', () => {
  const cards = overviewCards(view());
  expect(cards).toEqual({ running: [], attention: [], ready: [] });
});
