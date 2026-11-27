// What the Sternenkarte shows (#118, bundle 2): the navigation, the panel
// of the last scan (#53), one row per position with its planet, owner,
// rank, noob protection, the moon (#53), the Trümmerfeld (#45) and the
// actions, the words of activity and inactivity (#229), and the Spähschädel
// of a spying.
import type { ShownProtection } from '../../core/galaxy-shown.ts';
import { describe, expect, it } from 'vitest';
import type { DebrisField } from '../../core/debris.ts';
import { MISSION } from '../../core/missions.ts';
import type { Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { debrisTip } from './debris.ts';
import { distance, fleetSpeed, flightMs } from '../../core/flight.ts';
import { dur } from './format.ts';
import {
  type GalaxyAction,
  type GalaxyMark,
  galaxyPage,
  type GalaxyRow,
  targetOf,
} from './galaxy.ts';
import { moonMarkId } from './moon.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

const place = (
  kind: GalaxyPlanet['kind'],
  p: number,
  owner: string,
  name = kind === 'moon' ? 'Luna' : `Welt ${p}`,
  s = 2,
): GalaxyPlanet => ({
  id: `${kind === 'moon' ? 'm' : 'p'}1_${s}_${p}`,
  kind,
  name,
  g: 1,
  s,
  p,
  temp: 20,
  owner,
});

interface Setup {
  galaxy?: GalaxyPlanet[];
  debris?: DebrisField[];
  P?: Partial<Planet>;
  ui?: Partial<Ui>;
  probes?: number;
  now?: number;
  research?: Record<string, number>;
  /** The list of the noob protection the server sent (151a). */
  listed?: ShownProtection;
}

/** Anna (u1) looks at system 1:2 from her planet at [1:2:5]. */
function view(o: Setup = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', probes: o.probes ?? 2 },
    players: {
      u1: { name: 'Anna', points: 1000 },
      u2: { name: 'Bert', points: 100 },
      u3: { name: 'Cleo', points: 5000 },
    },
    galaxy: o.galaxy ?? [],
    debris: o.debris ?? [],
    ...(o.listed && { protectedOwners: o.listed }),
  } as unknown as GameState;
  return {
    s,
    P: planet({ id: 'p1_2_5', g: 1, s: 2, p: 5, ...o.P }),
    R: { research: o.research ?? {}, rq: null },
    now: o.now ?? 0,
    ui: { gal: 1, sys: 2, ...o.ui } as Ui,
  };
}

const rowAt = (v: V, p: number): GalaxyRow => galaxyPage(v).rows[p - 1]!;

const field = (p: number, m = 1800, c = 600): DebrisField => ({
  id: `d1_2_${p}`,
  g: 1,
  s: 2,
  p,
  m,
  c,
});

const at = (p: number, moon = false): Record<string, string> => ({
  'data-g': '1',
  'data-s': '2',
  'data-p': String(p),
  ...(moon ? { 'data-k': 'moon' } : {}),
});

/** The button „Bergung“ at a position. */
const harvest = (p: number): GalaxyAction => ({
  kind: 'harvest',
  label: 'Bergung',
  attrs: { 'data-act': 'gfleet', 'data-m': 'harvest', ...at(p) },
});

/** The symbol of a Trümmerfeld: its tooltip. */
const debrisSymbol = (d: DebrisField): GalaxyMark => ({
  kind: 'debris',
  tip: debrisTip(d),
});

/** The symbol of a moon: its button with the id, the name and whether its row is open. */
const moonSymbol = (moon: GalaxyPlanet, open: boolean): GalaxyMark => ({
  kind: 'moon',
  id: moonMarkId(moon.id),
  moonId: moon.id,
  name: `${moon.name} (Mond)`,
  open,
});

const foreign = (p: number, moon = false): GalaxyAction[] => [
  {
    kind: 'link',
    label: 'Auspex-Erkundung',
    attrs: { 'data-act': 'gspy', ...at(p, moon) },
  },
  {
    kind: 'link',
    label: 'Sturmangriff',
    attrs: { 'data-act': 'gfleet', 'data-m': 'attack', ...at(p, moon) },
  },
  {
    kind: 'link',
    label: 'Versorgungsflug',
    attrs: { 'data-act': 'gfleet', 'data-m': 'transport', ...at(p, moon) },
  },
  // At every foreign moon (#95; owner, 2026-11-21).
  ...(moon
    ? [
        {
          kind: 'link' as const,
          label: 'Mondbruch',
          attrs: {
            'data-act': 'gfleet',
            'data-m': 'moonbreak',
            ...at(p, true),
          },
        },
      ]
    : []),
];

const own = (id: string, p: number, moon = false): GalaxyAction[] => [
  {
    kind: 'button',
    label: 'Wechseln',
    attrs: { 'data-act': 'selectPlanet', 'data-id': id },
  },
  {
    kind: 'button',
    label: 'Versorgungsflug',
    attrs: { 'data-act': 'gfleet', 'data-m': 'transport', ...at(p, moon) },
  },
  {
    kind: 'button',
    label: MISSION.deploy,
    attrs: { 'data-act': 'gfleet', 'data-m': 'deploy', ...at(p, moon) },
  },
];

describe('galaxyPage', () => {
  it('shows the system, the limits of the fields and one row per position', () => {
    const page = galaxyPage(view({ ui: { gal: 2, sys: 7 } }));
    expect(page.gal).toBe(2);
    expect(page.sys).toBe(7);
    expect(page.galaxies).toBe(U.galaxies);
    expect(page.systems).toBe(U.systems);
    // The positions of the system and the expedition position after them (#93).
    expect(page.rows.map((r) => r.position)).toEqual(
      Array.from({ length: U.positions + 1 }, (_, i) => i + 1),
    );
    expect(page.scan).toBeNull();
  });

  it('counts the Spähschädel of a spying, at least one', () => {
    expect(galaxyPage(view({ probes: 0 })).probes).toBe('1');
    expect(galaxyPage(view({ probes: 3 })).probes).toBe('3');
    expect(galaxyPage(view({ probes: 1500 })).probes).toBe('1.500');
  });
});

describe('the expedition position (#93)', () => {
  const last = U.positions + 1;
  const level1 = { expo: 1 };
  const ships = { lc: 3 };

  it('is the row after the last planet position, with no planet and its own note', () => {
    const row = rowAt(view(), last);
    expect(row).toMatchObject({
      position: 16,
      planet: null,
      marks: [],
      actions: [],
      note: 'Expeditionsposition',
      moon: null,
    });
    // The planet positions keep the dash of a free position.
    expect(rowAt(view(), U.positions).note).toBe('–');
  });

  it('offers „Expedition“ with the research and a ship that flies', () => {
    const button = [
      {
        kind: 'button',
        label: 'Expedition',
        attrs: { 'data-act': 'gfleet', 'data-m': 'expedition', ...at(last) },
      },
    ];
    expect(
      rowAt(view({ research: level1, P: { ships } }), last).actions,
    ).toEqual(button);
    expect(
      rowAt(view({ research: { expo: 9 }, P: { ships: { probe: 1 } } }), last)
        .actions,
    ).toEqual(button);
    // Without the research, without a ship, with ships that cannot fly or none left.
    expect(rowAt(view({ P: { ships } }), last).actions).toEqual([]);
    expect(
      rowAt(view({ research: { expo: 0 }, P: { ships } }), last).actions,
    ).toEqual([]);
    expect(rowAt(view({ research: level1 }), last).actions).toEqual([]);
    expect(
      rowAt(view({ research: level1, P: { ships: { sat: 4, lc: 0 } } }), last)
        .actions,
    ).toEqual([]);
  });

  it('shows the Trümmerfeld there with its Bergung, after the expedition', () => {
    const v = view({
      research: level1,
      P: { ships },
      debris: [field(last, 500, 200)],
    });
    const row = rowAt(v, last);
    expect(row.marks).toEqual([debrisSymbol(field(last, 500, 200))]);
    expect(row.actions.map((a) => a.kind)).toEqual(['button', 'harvest']);
    expect(row.actions[1]).toEqual(harvest(last));
  });

  it('offers neither the Landnahme nor the Vermessung there', () => {
    const v = view({
      research: { carto: 1, expo: 1 },
      P: { ships: { colony: 1, probe: 2 } },
    });
    expect(rowAt(v, last).actions.map((a) => 'label' in a && a.label)).toEqual([
      'Expedition',
    ]);
    expect(rowAt(v, 9).actions.map((a) => 'label' in a && a.label)).toEqual([
      'Landnahme',
      'Vermessen',
    ]);
  });

  it('follows the size of the universe: 21 with 20 positions', () => {
    const v = view();
    v.s.cfg = { ...U, positions: 20 };
    const page = galaxyPage(v);
    expect(page.rows).toHaveLength(21);
    expect(page.rows[20]).toMatchObject({
      position: 21,
      note: 'Expeditionsposition',
    });
    expect(page.rows[19]!.note).toBe('–');
  });
});

describe('a free position', () => {
  it('shows nothing without a colony ship, a field or a moon', () => {
    expect(rowAt(view(), 9)).toEqual({
      position: 9,
      planet: null,
      marks: [],
      actions: [],
      note: '–',
      moon: null,
      sheet: null,
    });
  });

  it('says until when a given-up position is locked and offers no Landnahme (#224)', () => {
    const v = view({ P: { ships: { colony: 1 } } });
    v.s.locks = [{ g: 1, s: 2, p: 9, until: v.now + 60_000 }];
    const row = rowAt(v, 9);
    expect(row.note).toMatch(/^gesperrt bis /);
    expect(row.actions).toEqual([]);
    v.s.locks = [{ g: 1, s: 2, p: 9, until: v.now }];
    expect(rowAt(v, 9).note).toBe('–');
  });

  it('offers no „Vermessen“ at a locked position either, but still the Bergung (#190, #224; owner, 2026-11-18)', () => {
    const v = view({
      P: { ships: { colony: 1, probe: 3 } },
      research: { carto: 1 },
      debris: [field(9)],
    });
    const names = (p: number) => rowAt(v, p).actions.map((a) => a.label);
    v.s.locks = [{ g: 1, s: 2, p: 9, until: v.now + 60_000 }];
    expect(names(9)).toEqual(['Bergung']);
    // The lock ended: both buttons are back, the Bergung after them.
    v.s.locks = [{ g: 1, s: 2, p: 9, until: v.now }];
    expect(names(9)).toEqual(['Landnahme', 'Vermessen', 'Bergung']);
    // Another position keeps its buttons while 9 is locked.
    v.s.locks = [{ g: 1, s: 2, p: 9, until: v.now + 60_000 }];
    expect(names(8)).toEqual(['Landnahme', 'Vermessen']);
  });

  it('offers the Landnahme with a colony ship on the shown planet', () => {
    expect(rowAt(view({ P: { ships: { colony: 1 } } }), 9).actions).toEqual([
      {
        kind: 'button',
        label: 'Landnahme',
        attrs: { 'data-act': 'gfleet', 'data-m': 'colonize', ...at(9) },
      },
    ]);
  });

  it('offers „Vermessen“ with Spähschädel and Auspex-Kartographie, after the Landnahme (#190)', () => {
    const vermessen = {
      kind: 'button',
      label: 'Vermessen',
      attrs: { 'data-act': 'gspy', 'data-m': 'survey', ...at(9) },
    };
    const both = view({
      P: { ships: { colony: 1, probe: 3 } },
      research: { carto: 1 },
      debris: [field(9)],
    });
    expect(rowAt(both, 9).actions.map((a) => a.kind)).toEqual([
      'button',
      'button',
      'harvest',
    ]);
    expect(rowAt(both, 9).actions[1]).toEqual(vermessen);
    expect(
      rowAt(view({ P: { ships: { probe: 1 } }, research: { carto: 3 } }), 9)
        .actions,
    ).toEqual([vermessen]);
    // Not without the research or without Spähschädel, not at a planet.
    expect(rowAt(view({ P: { ships: { probe: 1 } } }), 9).actions).toEqual([]);
    expect(
      rowAt(view({ P: { ships: {} }, research: { carto: 1 } }), 9).actions,
    ).toEqual([]);
    const own = view({
      P: { ships: { probe: 1 } },
      research: { carto: 1 },
      galaxy: [place('planet', 6, 'u3')],
    });
    expect(rowAt(own, 6).actions).toEqual([]);
    expect(
      rowAt(own, 6).planet!.actions.map((a) => 'label' in a && a.label),
    ).not.toContain('Vermessen');
  });

  it('shows a Trümmerfeld with its symbol and the Bergung after the Landnahme (#45)', () => {
    const r = rowAt(
      view({ P: { ships: { colony: 2 } }, debris: [field(9, 0, 300)] }),
      9,
    );
    expect(r.marks).toEqual([debrisSymbol(field(9, 0, 300))]);
    expect(r.actions.map((a) => a.kind)).toEqual(['button', 'harvest']);
    expect(r.actions[1]).toEqual(harvest(9));
    // Only at its own position.
    expect(rowAt(view({ debris: [field(9)] }), 8).marks).toEqual([]);
  });

  it('shows a moon without a planet by its symbol, without its row', () => {
    const luna = place('moon', 9, 'u2');
    const r = rowAt(view({ galaxy: [luna], ui: { gmoon: luna.id } }), 9);
    expect(r.marks).toEqual([moonSymbol(luna, true)]);
    expect(r.planet).toBeNull();
    expect(r.moon).toBeNull();
  });
});

describe('a foreign planet', () => {
  it('shows its name, owner, rank and the three actions', () => {
    const r = rowAt(view({ galaxy: [place('planet', 6, 'u3')] }), 6);
    expect(r).toEqual({
      position: 6,
      planet: {
        g: 1,
        s: 2,
        p: 6,
        name: 'Welt 6',
        activity: '',
        mine: false,
        owner: 'Cleo',
        inactivity: '',
        rank: '1',
        protected: false,
        vacation: false,
        actions: foreign(6),
        sheet: {
          id: 'p1_2_6',
          title: 'Welt 6 [1:2:6]',
          flight: null,
          actions: foreign(6),
        },
      },
      marks: [],
      actions: [],
      note: '',
      moon: null,
      sheet: null,
    });
  });

  it('marks the noob protection by the list of the server, and an unknown owner without a rank', () => {
    const galaxy = [
      place('planet', 6, 'u2'),
      place('planet', 7, 'u9'),
      place('planet', 8, 'u3'),
    ];
    const v = view({ galaxy, listed: { g: 1, s: 2, owners: ['u2', 'u9'] } });
    expect(rowAt(v, 6).planet).toMatchObject({
      owner: 'Bert',
      rank: '3',
      protected: true,
    });
    expect(rowAt(v, 7).planet).toMatchObject({
      owner: 'Unbekannt',
      rank: '-',
      protected: true,
    });
    // Not in the list: no (n), whatever the stored points say.
    expect(rowAt(v, 8).planet).toMatchObject({ protected: false });
  });

  it('shows no rank while the highscore shows nothing, and keeps the (n) (#422, 182a, 179a)', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u2')],
      listed: { g: 1, s: 2, owners: ['u2'] },
    });
    expect(rowAt(v, 6).planet!.rank).toBe('3');
    const none = { ...v, s: { ...v.s, round: { highscoreShows: 2 } } } as V;
    expect(rowAt(none, 6).planet).toMatchObject({ rank: '', protected: true });
    const total = { ...v, s: { ...v.s, round: { highscoreShows: 1 } } } as V;
    expect(rowAt(total, 6).planet!.rank).toBe('3');
  });

  it('marks no noob protection before the list of the shown system is there (151a)', () => {
    const galaxy = [place('planet', 6, 'u2')];
    // Bert has a tenth of Anna's stored points, but no list came yet.
    expect(rowAt(view({ galaxy }), 6).planet!.protected).toBe(false);
    // The list of another system is not used for this one.
    for (const other of [
      { g: 1, s: 3 },
      { g: 2, s: 2 },
    ])
      expect(
        rowAt(view({ galaxy, listed: { ...other, owners: ['u2'] } }), 6).planet!
          .protected,
      ).toBe(false);
  });

  it('marks an owner in vacation mode (#223), the others not', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u3'), place('planet', 7, 'u2')],
    });
    v.s.players.u3 = { name: 'Cleo', points: 5000, vacation: true };
    v.s.players.u2 = { name: 'Bert', points: 100, vacation: false };
    expect(rowAt(v, 6).planet).toMatchObject({ vacation: true });
    expect(rowAt(v, 7).planet).toMatchObject({ vacation: false });
    // An owner the state does not know is not in vacation mode.
    expect(
      rowAt(view({ galaxy: [place('planet', 6, 'u9')] }), 6).planet,
    ).toMatchObject({ vacation: false });
  });

  it('ends its actions with the Bergung of a field there', () => {
    const r = rowAt(
      view({ galaxy: [place('planet', 6, 'u3')], debris: [field(6)] }),
      6,
    );
    expect(r.planet!.actions).toEqual([...foreign(6), harvest(6)]);
    expect(r.marks).toEqual([debrisSymbol(field(6))]);
    expect(r.actions).toEqual([]);
  });

  it('is only shown in its own system', () => {
    const v = view({ galaxy: [place('planet', 6, 'u3', 'Fern', 3)] });
    expect(rowAt(v, 6).planet).toBeNull();
  });
});

describe('activity and inactivity (#229)', () => {
  /** Cleo's planet and moon at 6 with their markers, Cleo's account in `inactive`. */
  function marked(inactive?: 'inactive' | 'long'): V {
    const v = view({
      galaxy: [
        { ...place('planet', 6, 'u3'), activity: { minutes: 42 } },
        { ...place('moon', 6, 'u3'), activity: { recent: true } },
        place('planet', 7, 'u2'),
      ],
      ui: { gmoon: 'm1_2_6' },
    });
    if (inactive) v.s.players.u3!.inactive = inactive;
    return v;
  }

  it('words the activity of a planet and of its moon, each its own', () => {
    const r = rowAt(marked(), 6);
    expect(r.planet!.activity).toBe('Aktivität vor 42 Minuten');
    expect(r.moon!.activity).toBe('Aktiv');
    // A place without a marker shows none.
    expect(rowAt(marked(), 7).planet!.activity).toBe('');
  });

  it('words the inactivity of the owner of a place, not of another player', () => {
    expect(rowAt(marked(), 6).planet!.inactivity).toBe('');
    const r = rowAt(marked('inactive'), 6);
    expect(r.planet!.inactivity).toBe('Inaktiv');
    expect(r.moon!.inactivity).toBe('Inaktiv');
    expect(rowAt(marked('long'), 6).planet!.inactivity).toBe('Lange inaktiv');
    expect(rowAt(marked('long'), 7).planet!.inactivity).toBe('');
  });

  it('shows none for an owner the state does not know', () => {
    const v = view({ galaxy: [place('planet', 6, 'u9')] });
    expect(rowAt(v, 6).planet).toMatchObject({ activity: '', inactivity: '' });
  });
});

describe('an own planet', () => {
  it('names the shown planet only', () => {
    const r = rowAt(view({ galaxy: [place('planet', 5, 'u1')] }), 5);
    expect(r.planet).toMatchObject({
      mine: true,
      owner: 'Anna',
      rank: '2',
      protected: false,
      actions: [{ kind: 'active', label: 'Aktiver Planet' }],
    });
  });

  it('offers „Wechseln“, a supply and a Verlegung at another one', () => {
    const r = rowAt(view({ galaxy: [place('planet', 8, 'u1')] }), 8);
    expect(r.planet!.actions).toEqual(own('p1_2_8', 8));
  });
});

describe('moons (#53)', () => {
  const galaxy = (): GalaxyPlanet[] => [
    place('planet', 5, 'u1'),
    place('moon', 5, 'u1'),
    place('planet', 6, 'u2'),
    place('moon', 6, 'u2', 'Mond'),
  ];

  it('shows the closed symbol at the planet, without the row', () => {
    const r = rowAt(view({ galaxy: galaxy() }), 6);
    expect(r.marks).toEqual([moonSymbol(galaxy()[3]!, false)]);
    expect(r.moon).toBeNull();
  });

  it('puts the symbol of the moon before the one of a field', () => {
    const r = rowAt(view({ galaxy: galaxy(), debris: [field(6)] }), 6);
    expect(r.marks).toEqual([
      moonSymbol(galaxy()[3]!, false),
      debrisSymbol(field(6)),
    ]);
  });

  it('opens the row of a foreign moon with its actions at the moon', () => {
    const r = rowAt(
      view({
        galaxy: galaxy(),
        ui: { gmoon: 'm1_2_6' },
        listed: { g: 1, s: 2, owners: ['u2'] },
      }),
      6,
    );
    expect(r.marks).toEqual([moonSymbol(galaxy()[3]!, true)]);
    expect(r.moon).toEqual({
      g: 1,
      s: 2,
      p: 6,
      name: 'Mond (Mond)',
      activity: '',
      mine: false,
      owner: 'Bert',
      inactivity: '',
      rank: '3',
      protected: true,
      vacation: false,
      actions: foreign(6, true),
      sheet: {
        id: 'm1_2_6',
        title: 'Mond (Mond) [1:2:6]',
        flight: null,
        actions: foreign(6, true),
      },
    });
    // The planet keeps its own actions.
    expect(r.planet!.actions).toEqual(foreign(6));
    // The other moon stays closed.
    expect(
      rowAt(view({ galaxy: galaxy(), ui: { gmoon: 'm1_2_6' } }), 5).moon,
    ).toBeNull();
  });

  it('opens the row of an own moon with „Wechseln“, a supply and a Verlegung', () => {
    const r = rowAt(view({ galaxy: galaxy(), ui: { gmoon: 'm1_2_5' } }), 5);
    expect(r.moon).toMatchObject({ name: 'Luna (Mond)', mine: true });
    expect(r.moon!.actions).toEqual(own('m1_2_5', 5, true));
  });

  it('names the shown moon', () => {
    const r = rowAt(
      view({
        galaxy: galaxy(),
        ui: { gmoon: 'm1_2_5' },
        P: { id: 'm1_2_5', kind: 'moon' },
      }),
      5,
    );
    expect(r.moon!.actions).toEqual([
      { kind: 'active', label: 'Aktiver Mond' },
    ]);
    expect(r.planet!.actions).toEqual(own('p1_2_5', 5));
  });
});

describe('the Auspex-Phalanx (#53)', () => {
  /** Anna's moon at [1:2:5] with a phalanx of `level`. */
  const fromMoon = (level: number, ui: Partial<Ui> = {}): V =>
    view({
      galaxy: [place('planet', 6, 'u2', '<b>"x"'), place('moon', 6, 'u2')],
      P: { id: 'm1_2_5', kind: 'moon', b: { moonbase: 1, phalanx: level } },
      ui: { gmoon: 'm1_2_6', ...ui },
    });

  it('offers the scan at a foreign planet in range, after its actions', () => {
    const r = rowAt(fromMoon(1), 6);
    expect(r.planet!.actions).toEqual([
      ...foreign(6),
      {
        kind: 'button',
        label: 'Phalanx-Scan',
        attrs: {
          'data-act': 'gscan',
          'data-id': 'p1_2_6',
          'aria-label': 'Phalanx-Scan von <b>"x"',
        },
      },
    ]);
    // Not at the moon.
    expect(r.moon!.actions).toEqual(foreign(6, true));
  });

  it('offers no scan without a phalanx', () => {
    expect(rowAt(fromMoon(0), 6).planet!.actions).toEqual(foreign(6));
  });

  it('shows no panel before a scan, or after one from another place', () => {
    expect(galaxyPage(fromMoon(1)).scan).toBeNull();
    const other = { by: 'm9_9_9', target: 'p1_2_6', flights: [] };
    expect(galaxyPage(fromMoon(1, { scan: other })).scan).toBeNull();
  });

  it('shows the flights of the scan: ships, origin, target and arrival', () => {
    const v = fromMoon(1, {
      scan: {
        by: 'm1_2_5',
        target: 'p1_2_6',
        flights: [
          { ships: { lc: 10 }, from: 'p1_2_9', to: 'p1_2_6', arr: 65_000 },
          { ships: { probe: 2 }, from: 'p1_2_6', to: 'm1_2_9', arr: 500 },
        ],
      },
    });
    v.now = 1000;
    expect(galaxyPage(v).scan).toEqual({
      title: 'Phalanx-Scan: <b>"x" [1:2:6]',
      flights: [
        {
          ships: '10 Lastbarke',
          from: '[1:2:9]',
          to: '[1:2:6]',
          due: { end: 65_000, left: dur(64_000) },
        },
        {
          ships: '2 Spähschädel',
          from: '[1:2:6]',
          to: '[1:2:9] (Mond)',
          due: { end: 500, left: null },
        },
      ],
    });
  });
});

describe('targetOf', () => {
  it('reads the place of an action, a moon by data-k', () => {
    expect(targetOf({ g: '2', s: '17', p: '9' })).toEqual({
      g: 2,
      s: 17,
      p: 9,
      kind: 'planet',
    });
    expect(targetOf({ g: '1', s: '2', p: '6', k: 'moon' })).toEqual({
      g: 1,
      s: 2,
      p: 6,
      kind: 'moon',
    });
    expect(targetOf({ g: '1', s: '2', p: '6', k: 'planet' }).kind).toBe(
      'planet',
    );
  });
});

describe('the Raketenangriff (#54)', () => {
  const armed = (ipm: number, impulse = 1, s = 2): V => {
    const v = view({
      galaxy: [place('planet', 6, 'u2'), place('planet', 7, 'u1')],
      P: { owner: 'u1', s, def: { ipm } },
    });
    v.R = { research: { impulse }, rq: null };
    return v;
  };

  it('is offered at a foreign planet in range from a planet with Orbitalraketen', () => {
    expect(rowAt(armed(2), 6).planet!.actions.at(-1)).toEqual({
      kind: 'button',
      label: 'Raketenangriff',
      attrs: {
        'data-act': 'gmissile',
        'data-id': 'p1_2_6',
        ...at(6),
        'aria-label': 'Raketenangriff auf Welt 6',
      },
    });
    const own = rowAt(armed(2), 7).planet!.actions;
    expect(JSON.stringify(own)).not.toContain('gmissile');
  });

  it('is not offered without Orbitalraketen or out of range', () => {
    expect(rowAt(armed(0), 6).planet!.actions).toEqual(foreign(6));
    expect(rowAt(armed(2, 0), 6).planet!.actions).toEqual(foreign(6));
    expect(rowAt(armed(2, 1, 7), 6).planet!.actions).toEqual(foreign(6));
  });
});

describe('the sheet „⋯“ of a position on a phone (#189)', () => {
  it('has the actions of the row, without the dim name of the active place', () => {
    const v = view({
      galaxy: [place('planet', 5, 'u1'), place('planet', 6, 'u3')],
    });
    // [1:2:5] is the shown planet: only its name, so no sheet.
    expect(rowAt(v, 5).planet!.actions.map((a) => a.kind)).toEqual(['active']);
    expect(rowAt(v, 5).planet!.sheet).toBeNull();
    expect(rowAt(v, 6).planet!.sheet!.actions).toEqual(foreign(6));
  });

  it('offers the actions of an own planet that is not shown, with its title', () => {
    const v = view({ galaxy: [place('planet', 7, 'u1', 'Kolonie')] });
    expect(rowAt(v, 7).planet!.sheet).toEqual({
      id: 'p1_2_7',
      title: 'Kolonie [1:2:7]',
      flight: null,
      actions: own('p1_2_7', 7),
    });
  });

  it('holds the Bergung of a field with the actions of the planet and of a free position', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u3')],
      debris: [field(6), field(9)],
    });
    expect(rowAt(v, 6).planet!.sheet!.actions.at(-1)).toEqual(harvest(6));
    expect(rowAt(v, 9).sheet).toMatchObject({
      id: 'free-9',
      title: 'Position [1:2:9]',
      actions: [harvest(9)],
    });
  });

  it('has no sheet at a free position without an action, and one at the expedition position with one', () => {
    expect(rowAt(view(), 9).sheet).toBeNull();
    const v = view({ research: { expo: 1 }, P: { ships: { lc: 3 } } });
    expect(rowAt(v, U.positions + 1).sheet).toMatchObject({
      id: `free-${U.positions + 1}`,
      title: 'Expeditionsposition [1:2:16]',
    });
  });

  it('gives a moon its own sheet', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u3'), place('moon', 6, 'u3', 'Luna')],
      ui: { gmoon: 'm1_2_6' },
    });
    expect(rowAt(v, 6).moon!.sheet).toMatchObject({
      id: 'm1_2_6',
      title: 'Luna (Mond) [1:2:6]',
    });
  });

  it('names the flight time of all ships that fly, at full speed', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u3')],
      P: { ships: { lc: 2, probe: 1, sat: 5 } },
    });
    // The slowest ship that flies sets the speed: the satellite does not fly.
    const ms = flightMs(
      distance({ g: 1, s: 2, p: 5 }, { g: 1, s: 2, p: 6 }),
      fleetSpeed({ lc: 2, probe: 1 }, v.R),
      10,
      U,
    );
    expect(rowAt(v, 6).planet!.sheet!.flight).toBe(
      `Flugzeit mit allen Schiffen: ${dur(ms)}`,
    );
  });

  it('names no flight time without a ship that flies', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u3')],
      P: { ships: { sat: 5, lc: 0 } },
    });
    expect(rowAt(v, 6).planet!.sheet!.flight).toBeNull();
  });

  it('opens the sheet that ui.gsheet names, while its place is on the page', () => {
    const base = { galaxy: [place('planet', 6, 'u3')] };
    expect(galaxyPage(view(base)).sheet).toBeNull();
    expect(
      galaxyPage(view({ ...base, ui: { gsheet: 'p1_2_6' } })).sheet?.id,
    ).toBe('p1_2_6');
    // Another system, an unknown id or none.
    expect(
      galaxyPage(view({ ...base, ui: { gsheet: 'p1_3_6' } })).sheet,
    ).toBeNull();
    expect(
      galaxyPage(view({ ...base, ui: { gsheet: null } })).sheet,
    ).toBeNull();
    expect(
      galaxyPage(view({ ...base, ui: { gsheet: 'free-9' } })).sheet,
    ).toBeNull();
    // A free position and a moon.
    const free = view({ debris: [field(9)], ui: { gsheet: 'free-9' } });
    expect(galaxyPage(free).sheet?.id).toBe('free-9');
  });
});

describe('the Mondbruch (#95)', () => {
  const galaxy = (): GalaxyPlanet[] => [
    place('planet', 5, 'u1'),
    place('moon', 5, 'u1'),
    place('planet', 6, 'u2'),
    place('moon', 6, 'u2', 'Mond'),
  ];
  const labels = (a: GalaxyAction[]): (string | undefined)[] =>
    a.map((x) => ('label' in x ? x.label : undefined));
  const open = (P: Partial<Planet>, id = 'm1_2_6') =>
    rowAt(
      view({ galaxy: galaxy(), P, ui: { gmoon: id } }),
      Number(id.slice(-1)),
    );
  const link: GalaxyAction = {
    kind: 'link',
    label: 'Mondbruch',
    attrs: { 'data-act': 'gfleet', 'data-m': 'moonbreak', ...at(6, true) },
  };

  it('is offered at a foreign moon, after the supply, with the moon as the target', () => {
    const r = open({ ships: { dstar: 1 } });
    expect(r.moon!.actions).toEqual(foreign(6, true));
    expect(r.moon!.actions.at(-1)).toEqual(link);
    expect(r.moon!.actions.at(-2)).toMatchObject({ label: 'Versorgungsflug' });
    expect(r.moon!.sheet!.actions).toEqual(foreign(6, true));
  });

  it('is offered without a Weltenbrecher too (owner, 2026-11-21)', () => {
    expect(labels(open({ ships: { sc: 3 } }).moon!.actions)).toContain(
      'Mondbruch',
    );
    expect(labels(open({ ships: { dstar: 0 } }).moon!.actions)).toContain(
      'Mondbruch',
    );
    expect(labels(open({ ships: {} }).moon!.sheet!.actions)).toContain(
      'Mondbruch',
    );
  });

  it('is not offered at a foreign planet, nor at an own moon', () => {
    const r = open({ ships: { dstar: 1 } });
    expect(labels(r.planet!.actions)).not.toContain('Mondbruch');
    const mine = open({ ships: { dstar: 1 } }, 'm1_2_5');
    expect(labels(mine.moon!.actions)).not.toContain('Mondbruch');
  });
});
