// What the Sternenkarte shows (#118, bundle 2): the navigation, the panel
// of the last scan (#53), one row per position with its planet, owner,
// rank, noob protection, the moon (#53), the Trümmerfeld (#45) and the
// actions, the words of activity and inactivity (#229), and the Spähschädel
// of a spying.
import { describe, expect, it } from 'vitest';
import type { DebrisField } from '../../core/debris.ts';
import { MISSION } from '../../core/missions.ts';
import type { Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { debrisMark, harvestButton } from './debris.ts';
import { dur } from './format.ts';
import {
  type GalaxyAction,
  galaxyPage,
  type GalaxyRow,
  targetOf,
} from './galaxy.ts';
import { moonMark } from './moon.ts';
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
    expect(page.rows.map((r) => r.position)).toEqual(
      Array.from({ length: U.positions }, (_, i) => i + 1),
    );
    expect(page.scan).toBeNull();
  });

  it('counts the Spähschädel of a spying, at least one', () => {
    expect(galaxyPage(view({ probes: 0 })).probes).toBe('1');
    expect(galaxyPage(view({ probes: 3 })).probes).toBe('3');
    expect(galaxyPage(view({ probes: 1500 })).probes).toBe('1.500');
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
      'html',
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
    expect(r.marks).toEqual([debrisMark(field(9, 0, 300))]);
    expect(r.actions.map((a) => a.kind)).toEqual(['button', 'html']);
    expect(r.actions[1]).toEqual({
      kind: 'html',
      html: harvestButton({ g: 1, s: 2, p: 9 }),
    });
    // Only at its own position.
    expect(rowAt(view({ debris: [field(9)] }), 8).marks).toEqual([]);
  });

  it('shows a moon without a planet by its symbol, without its row', () => {
    const luna = place('moon', 9, 'u2');
    const r = rowAt(view({ galaxy: [luna], ui: { gmoon: luna.id } }), 9);
    expect(r.marks).toEqual([moonMark(luna, true)]);
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
        actions: foreign(6),
      },
      marks: [],
      actions: [],
      note: '',
      moon: null,
    });
  });

  it('marks the noob protection, and an unknown owner without a rank or points', () => {
    const v = view({
      galaxy: [place('planet', 6, 'u2'), place('planet', 7, 'u9')],
    });
    expect(rowAt(v, 6).planet).toMatchObject({
      owner: 'Bert',
      rank: '3',
      protected: true,
    });
    expect(rowAt(v, 7).planet).toMatchObject({
      owner: 'Unbekannt',
      rank: '-',
      // Without points, as before.
      protected: true,
    });
  });

  it('ends its actions with the Bergung of a field there', () => {
    const r = rowAt(
      view({ galaxy: [place('planet', 6, 'u3')], debris: [field(6)] }),
      6,
    );
    expect(r.planet!.actions).toEqual([
      ...foreign(6),
      { kind: 'html', html: harvestButton({ g: 1, s: 2, p: 6 }) },
    ]);
    expect(r.marks).toEqual([debrisMark(field(6))]);
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
    expect(r.marks).toEqual([moonMark(galaxy()[3]!, false)]);
    expect(r.moon).toBeNull();
  });

  it('puts the symbol of the moon before the one of a field', () => {
    const r = rowAt(view({ galaxy: galaxy(), debris: [field(6)] }), 6);
    expect(r.marks).toEqual([
      moonMark(galaxy()[3]!, false),
      debrisMark(field(6)),
    ]);
  });

  it('opens the row of a foreign moon with its actions at the moon', () => {
    const r = rowAt(view({ galaxy: galaxy(), ui: { gmoon: 'm1_2_6' } }), 6);
    expect(r.marks).toEqual([moonMark(galaxy()[3]!, true)]);
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
      actions: foreign(6, true),
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
