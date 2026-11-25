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
  MOST_IDLE,
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
  idle?: string[];
  galaxy?: GameState['galaxy'];
  now?: number;
}

function view(o: Setup = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', readAt: o.readAt ?? 0 },
    round: { achievements: true, daily: true, ...o.round },
    planet: {},
    galaxy: o.galaxy ?? [],
    idle: o.idle,
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
        key: `fleet:${fleet().id}`,
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

  it('keys two attacks of one player from one place apart, though their lines read the same (#369)', () => {
    const items = attentionItems(
      view({ fleets: [fleet({ id: 'f1' }), fleet({ id: 'f2', arr: 6000 })] }),
    );
    expect(items[0]!.text).toBe(items[1]!.text);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
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
      key: 'more-fleets',
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
      key: 'energy',
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
      { key: 'reward', text: 'Tagesbelohnung abholbar', link },
    ]);
    expect(open({ daily: { ...daily!, claimed: true } })).toEqual([]);
    const both = open({ daily, progress });
    expect(both[0]!.text).toBe('Erfolg und Tagesbelohnung abholbar');
    const one = open({ progress });
    expect(one).toEqual([{ key: 'reward', text: 'Erfolg abholbar', link }]);
  });

  it('counts the messages newer than the last reading', () => {
    const reports = [report('a', 100), report('b', 200), report('c', 300)];
    expect(readyItems(view({ reports, readAt: 200 }))).toEqual([
      {
        key: 'unread',
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

describe('Bereit: an empty build queue on another place', () => {
  const place = (
    p: number,
    name: string,
    kind: 'planet' | 'moon' = 'planet',
  ): GameState['galaxy'][number] =>
    ({
      id: `${kind === 'moon' ? 'm' : 'p'}1_2_${p}`,
      kind,
      name,
      g: 1,
      s: 2,
      p,
    }) as GameState['galaxy'][number];
  const galaxy = [
    place(3, 'Kolonie'),
    place(4, 'Luna', 'moon'),
    place(5, 'Dritte'),
    place(6, 'Vierte'),
    place(7, 'Fünfte'),
  ];
  const lines = (idle: string[]) =>
    readyItems(view({ galaxy, idle })).map((i) => i.text);

  it('is not there without the key of the server or with no place in it', () => {
    expect(readyItems(view({ galaxy }))).toEqual([]);
    expect(readyItems(view({ galaxy, idle: [] }))).toEqual([]);
  });

  it('names a place with its position and a button that selects it', () => {
    expect(readyItems(view({ galaxy, idle: ['p1_2_3'] }))).toEqual([
      {
        key: 'idle:p1_2_3',
        text: 'Bauschleife leer: Kolonie [1:2:3]',
        select: { id: 'p1_2_3', label: 'Wechseln' },
      },
    ]);
  });

  it('keys a planet named like its moon apart from the moon, though their lines read the same (#369)', () => {
    const twins = [place(8, 'X (Mond)'), place(8, 'X', 'moon')];
    const items = readyItems(
      view({ galaxy: twins, idle: ['p1_2_8', 'm1_2_8'] }),
    );
    expect(items[0]!.text).toBe(items[1]!.text);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('words a moon with „(Mond)“', () => {
    expect(lines(['m1_2_4'])).toEqual([
      'Bauschleife leer: Luna (Mond) [1:2:4]',
    ]);
  });

  it('names at most the most places and counts the rest', () => {
    expect(MOST_IDLE).toBe(3);
    expect(lines(['p1_2_3', 'm1_2_4', 'p1_2_5'])).toHaveLength(3);
    const four = readyItems(
      view({ galaxy, idle: ['p1_2_3', 'm1_2_4', 'p1_2_5', 'p1_2_6'] }),
    );
    expect(four.map((i) => i.text)).toEqual([
      'Bauschleife leer: Kolonie [1:2:3]',
      'Bauschleife leer: Luna (Mond) [1:2:4]',
      'Bauschleife leer: Dritte [1:2:5]',
      'und 1 weitere',
    ]);
    // The rest line has no button, and a key of its own (#369).
    expect(four[3]!.select).toBeUndefined();
    expect(four.map((i) => i.key)).toEqual([
      'idle:p1_2_3',
      'idle:m1_2_4',
      'idle:p1_2_5',
      'more-idle',
    ]);
    expect(
      lines(['p1_2_3', 'm1_2_4', 'p1_2_5', 'p1_2_6', 'p1_2_7']).at(-1),
    ).toBe('und 2 weitere');
  });

  it('leaves out a place the galaxy does not list, and counts only the listed ones', () => {
    expect(lines(['p9_9_9', 'p1_2_3'])).toEqual([
      'Bauschleife leer: Kolonie [1:2:3]',
    ]);
  });

  it('comes after the reward and the messages', () => {
    const items = readyItems(
      view({
        galaxy,
        idle: ['p1_2_3'],
        reports: [report('a', 100)],
        achievements: {
          progress: {},
          claimed: [],
          daily: { claimed: false } as never,
        },
      }),
    );
    expect(items.map((i) => i.link?.view ?? i.select?.id)).toEqual([
      'achievements',
      'messages',
      'p1_2_3',
    ]);
  });
});

it('puts the three cards together', () => {
  const cards = overviewCards(view());
  expect(cards).toEqual({ running: [], attention: [], ready: [] });
});
