// What the fleet view shows (#118, bundle 3): the fleets on their way with
// the slots, the ships that can fly, the form of target, mission, speed and
// cargo (#240), and what main.ts writes beside the form: the target (#45,
// #53) and the preview of the flight.
import { describe, expect, it } from 'vitest';
import { shipSpeed } from '../../core/flight.ts';
import { MISSION } from '../../core/missions.ts';
import type { Levels } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import {
  CARGO_FIELDS,
  fleetPage,
  missionChoice,
  missionOptions,
  previewCells,
  targetInfo,
  targetSite,
} from './fleet.ts';
import type { FleetForm, FleetPreview } from './game.ts';
import type { ClientFleet, GalaxyPlanet, GameState } from './types.ts';

const place = (
  kind: GalaxyPlanet['kind'],
  p: number,
  owner: string,
  name = 'Welt <b>',
): GalaxyPlanet => ({
  id: `${kind === 'moon' ? 'm' : 'p'}1_2_${p}`,
  kind,
  name,
  g: 1,
  s: 2,
  p,
  temp: 20,
  owner,
});

const fleetOf = (over: Partial<ClientFleet>): ClientFleet =>
  ({
    id: 'f1',
    owner: 'u1',
    mission: 'transport',
    state: 'out',
    fromC: { g: 1, s: 2, p: 5 },
    toC: { g: 1, s: 2, p: 6 },
    arr: 2000,
    ships: { lc: 1 },
    ...over,
  }) as ClientFleet;

interface Setup {
  ships?: Levels;
  research?: Levels;
  fleets?: ClientFleet[];
  galaxy?: GalaxyPlanet[];
  ft?: Ui['ft'];
  fm?: string;
}

function view(x: Setup = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1' },
    players: { u1: { name: 'Anna' }, u2: { name: 'Bert & Co' } },
    fleets: x.fleets ?? [],
    galaxy: x.galaxy ?? [],
    debris: [{ id: 'd1_2_7', g: 1, s: 2, p: 7, m: 1500, c: 20 }],
  } as unknown as GameState;
  return {
    s,
    P: planet({ id: 'p1_2_5', g: 1, s: 2, p: 5, ships: x.ships ?? {} }),
    R: { research: x.research ?? {}, rq: null },
    now: 1000,
    ui: { ft: x.ft ?? null, fm: x.fm ?? 'attack' } as unknown as Ui,
  };
}

describe('missionOptions', () => {
  it('lists every mission in the order of MISSION, the chosen one selected', () => {
    expect(missionOptions('spy')).toEqual(
      Object.entries(MISSION).map(([value, label]) => ({
        value,
        label,
        selected: value === 'spy',
      })),
    );
  });

  it('selects none for an unknown mission', () => {
    expect(missionOptions('nope').some((o) => o.selected)).toBe(false);
  });

  it('keeps only the missions the filter accepts, in their order', () => {
    const list = missionOptions('deploy', (m) => m !== 'attack' && m !== 'spy');
    expect(list.map((o) => o.value)).toEqual(
      Object.keys(MISSION).filter((m) => m !== 'attack' && m !== 'spy'),
    );
    expect(list.find((o) => o.selected)?.value).toBe('deploy');
  });
});

describe('fleetPage', () => {
  it('counts the own fleets against the slots, without the gift (#161)', () => {
    const page = fleetPage(
      view({
        research: { computer: 2 },
        fleets: [
          fleetOf({ id: 'a' }),
          fleetOf({ id: 'b', gift: true }),
          fleetOf({ id: 'c', owner: 'u2' }),
        ],
      }),
    );
    expect(page.slots).toBe('1 / 3');
    expect(page.full).toBe(false);
    // Only the own fleets are listed, the gift too.
    expect(page.fleets.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('is full when every slot is taken', () => {
    expect(fleetPage(view({ fleets: [fleetOf({})] })).full).toBe(true);
    expect(fleetPage(view()).full).toBe(false);
    expect(fleetPage(view()).slots).toBe('0 / 1');
  });

  it('lists the ships that stand there and can fly, in the order of the catalog', () => {
    const page = fleetPage(
      view({
        ships: { sat: 3, probe: 1500, sc: 0, lc: 2 },
        research: { combustion: 4 },
      }),
    );
    expect(page.ships).toEqual([
      {
        key: 'lc',
        name: 'Lastbarke',
        have: '2',
        speed: expect.any(String),
      },
      {
        key: 'probe',
        name: 'Spähschädel',
        have: '1.500',
        speed: expect.any(String),
      },
    ]);
    const speed = shipSpeed('lc', { research: { combustion: 4 } });
    expect(page.ships[0]!.speed).toBe(speed.toLocaleString('de-DE'));
  });

  it('has no ships without one that can fly', () => {
    expect(fleetPage(view({ ships: { sat: 4 } })).ships).toEqual([]);
  });

  it('aims at the shown planet, with the limits of the universe', () => {
    expect(fleetPage(view()).target).toEqual({
      g: 1,
      s: 2,
      p: 5,
      galaxies: U.galaxies,
      systems: U.systems,
      positions: U.positions,
      moon: false,
      toMoon: false,
    });
  });

  it('aims at the target of the Sternenkarte, its moon where one is (#53)', () => {
    const galaxy = [place('planet', 6, 'u2'), place('moon', 6, 'u2')];
    const at = { g: 1, s: 2, p: 6 };
    const toMoon = fleetPage(
      view({ galaxy, ft: { ...at, kind: 'moon' } }),
    ).target;
    expect(toMoon).toMatchObject({ ...at, moon: true, toMoon: true });
    const toPlanet = fleetPage(
      view({ galaxy, ft: { ...at, kind: 'planet' } }),
    ).target;
    expect(toPlanet).toMatchObject({ moon: true, toMoon: false });
    // A moon chosen where there is none is no moon.
    const none = fleetPage(view({ ft: { ...at, kind: 'moon' } })).target;
    expect(none).toMatchObject({ moon: false, toMoon: false });
  });

  it('offers the missions with the chosen one, the speeds and the cargo fields', () => {
    const page = fleetPage(view({ fm: 'transport' }));
    expect(page.missions).toEqual(missionOptions('transport'));
    expect(page.speeds.map((s) => [s.value, s.label])).toEqual(
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((x) => [String(x), `${x * 10} %`]),
    );
    expect(page.speeds.some((s) => s.selected)).toBe(false);
    expect(page.cargo).toBe(CARGO_FIELDS);
    expect(CARGO_FIELDS).toEqual([
      { key: 'm', name: 'Adamant' },
      { key: 'c', name: 'Psikristall' },
      { key: 'd', name: 'Promethium' },
    ]);
  });
});

const form = (
  mission: string,
  p: number,
  kind?: 'planet' | 'moon',
): FleetForm => ({
  ships: { lc: 1 },
  to: { g: 1, s: 2, p, ...(kind ? { kind } : {}) },
  mission,
  pct: 10,
  cargo: { m: 0, c: 0, d: 0 },
});

describe('targetSite (#253)', () => {
  const own = place('planet', 5, 'u1');
  const foreign = place('planet', 6, 'u2');
  const moon = place('moon', 6, 'u2', 'Luna');
  const s = view({
    galaxy: [own, foreign, moon, place('planet', 7, 'u2')],
  }).s;
  const to = (p: number, kind?: 'planet' | 'moon') =>
    form('attack', p, kind).to;

  it('finds the planet at the position, with or without the kind', () => {
    expect(targetSite(s, to(6))).toEqual({
      planet: foreign,
      debris: false,
      moon: false,
    });
    expect(targetSite(s, to(5, 'planet'))).toEqual({
      planet: own,
      debris: false,
      moon: false,
    });
  });

  it('finds the moon when the fleet flies to it, or none (#53)', () => {
    expect(targetSite(s, to(6, 'moon'))).toEqual({
      planet: moon,
      debris: false,
      moon: true,
    });
    expect(targetSite(s, to(5, 'moon'))).toEqual({
      planet: null,
      debris: false,
      moon: true,
    });
  });

  it('finds a free position and the Trümmerfeld (#45)', () => {
    expect(targetSite(s, to(9))).toEqual({
      planet: null,
      debris: false,
      moon: false,
    });
    expect(targetSite(s, to(7)).debris).toBe(true);
    expect(targetSite(s, to(7)).planet?.owner).toBe('u2');
    expect(targetSite({ ...s, galaxy: [] }, to(7))).toEqual({
      planet: null,
      debris: true,
      moon: false,
    });
  });
});

describe('missionChoice (#253)', () => {
  const foreign = { planet: { owner: 'u2' }, debris: false };
  const free = { planet: null, debris: false };
  const values = (site: typeof foreign | typeof free, chosen: string) =>
    missionChoice('u1', site, chosen).options.map((o) => o.value);

  it('offers only the missions that fit the target, in the order of the form', () => {
    expect(values(foreign, 'attack')).toEqual(['attack', 'transport', 'spy']);
    expect(values({ planet: { owner: 'u1' }, debris: false }, 'x')).toEqual([
      'transport',
      'deploy',
    ]);
    expect(values(free, 'colonize')).toEqual(['colonize']);
    expect(values({ planet: null, debris: true }, 'x')).toEqual([
      'colonize',
      'harvest',
    ]);
  });

  it('keeps the chosen mission while it fits', () => {
    const choice = missionChoice('u1', foreign, 'spy');
    expect(choice.mission).toBe('spy');
    expect(choice.checking).toBe(false);
    expect(choice.options).toEqual(
      missionOptions('spy', (m) => ['attack', 'transport', 'spy'].includes(m)),
    );
  });

  it('switches to the first mission that fits when the chosen one does not', () => {
    const choice = missionChoice('u1', free, 'attack');
    expect(choice.mission).toBe('colonize');
    expect(choice.options).toEqual([
      { value: 'colonize', label: MISSION.colonize, selected: true },
    ]);
    expect(missionChoice('u1', foreign, 'deploy').mission).toBe('attack');
    expect(missionChoice('u1', foreign, '').mission).toBe('attack');
  });

  it('shows no mission where none fits', () => {
    expect(
      missionChoice('u1', { planet: null, debris: false, moon: true }, 'spy'),
    ).toEqual({ checking: false, options: [], mission: '' });
  });

  it('is checking while the target is not known', () => {
    expect(missionChoice('u1', undefined, 'attack')).toEqual({
      checking: true,
      options: [],
      mission: '',
    });
  });
});

describe('targetInfo', () => {
  const s = view({
    galaxy: [
      place('planet', 6, 'u2'),
      place('moon', 6, 'u2', 'Luna'),
      place('planet', 8, 'u9'),
    ],
  }).s;

  it('names the planet and its owner, escaped', () => {
    expect(targetInfo(s, form('attack', 6))).toBe(
      'Welt &lt;b&gt; (Bert &amp; Co)',
    );
    expect(targetInfo(s, form('attack', 6, 'planet'))).toBe(
      'Welt &lt;b&gt; (Bert &amp; Co)',
    );
    expect(targetInfo(s, form('spy', 8))).toBe('Welt &lt;b&gt; (Unbekannt)');
  });

  it('names the moon and its owner, or that there is none (#53)', () => {
    expect(targetInfo(s, form('attack', 6, 'moon'))).toBe(
      'Luna (Mond) (Bert &amp; Co)',
    );
    expect(targetInfo(s, form('attack', 8, 'moon'))).toBe(
      '<span class="bad">kein Mond</span>',
    );
  });

  it('shows a free position for a colonization, else no planet', () => {
    expect(targetInfo(s, form('colonize', 9))).toBe('Freie Position');
    expect(targetInfo(s, form('transport', 9))).toBe(
      '<span class="bad">kein Planet</span>',
    );
    expect(targetInfo(s, form('nope', 9))).toBe(
      '<span class="bad">kein Planet</span>',
    );
  });

  it('shows the Trümmerfeld of a Bergung, or that there is none (#45)', () => {
    expect(targetInfo(s, form('harvest', 7))).toBe(
      'Trümmerfeld: 1.500 Adamant, 20 Psikristall',
    );
    expect(targetInfo(s, form('harvest', 6))).toBe(
      '<span class="bad">kein Trümmerfeld</span>',
    );
    // Only a Bergung looks at the field.
    expect(targetInfo(s, form('transport', 7))).toBe(
      '<span class="bad">kein Planet</span>',
    );
  });
});

describe('previewCells', () => {
  const pv: FleetPreview = {
    dist: 2795,
    ms: 3_723_000,
    fuel: 12,
    cap: 25_000,
    load: 1200,
    fuelShort: false,
    overload: false,
  };
  const now = Date.UTC(2026, 10, 17, 10, 0, 0);
  const at = (t: number): string =>
    new Date(t).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  it('shows „-“ in every cell without a ship', () => {
    expect(previewCells(null, 'attack', now)).toEqual({
      i_dist: '-',
      i_dur: '-',
      i_arr: '-',
      i_fuel: '-',
      i_cap: '-',
    });
  });

  it('shows distance, time, arrival and return, fuel and load', () => {
    const cells = previewCells(pv, 'attack', now);
    expect(cells.i_dist).toBe('2.795');
    expect(cells.i_dur).toBe('1h 02m 03s');
    expect(cells.i_arr).toBe(`${at(now + pv.ms)} / ${at(now + 2 * pv.ms)}`);
    expect(cells.i_fuel).toBe('<span class="">12</span> Promethium');
    expect(cells.i_cap).toBe('<span class="">1.200</span> / 25.000');
  });

  it('marks too little fuel and too much load', () => {
    const cells = previewCells(
      { ...pv, fuelShort: true, overload: true },
      'attack',
      now,
    );
    expect(cells.i_fuel).toBe('<span class="bad">12</span> Promethium');
    expect(cells.i_cap).toBe('<span class="bad">1.200</span> / 25.000');
  });

  it('shows no return for a mission that stays (#129)', () => {
    expect(previewCells(pv, 'deploy', now).i_arr).toBe(
      `${at(now + pv.ms)} / –`,
    );
    expect(previewCells(pv, 'nope', now).i_arr).toBe(
      `${at(now + pv.ms)} / ${at(now + 2 * pv.ms)}`,
    );
  });
});
