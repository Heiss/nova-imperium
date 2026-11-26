// What the overview shows (#118): the title, the fleet movements, the place
// with its kind, type, temperature, diameter, points and server time, and
// what is being built, researched or ordered; the fleet movements are also
// the list of the fleet view.
import { describe, expect, it } from 'vitest';
import { STRIKER } from '../../core/missiles.ts';
import { MISSION } from '../../core/missions.ts';
import { text } from '../../core/text.ts';
import type { Planet, ResearchQueue } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { dt, dur } from './format.ts';
import {
  activityRows,
  countdown,
  fleetRows,
  heldRows,
  overviewPage,
  type FleetRow,
} from './overview.ts';
import { planetLook } from './planet.ts';
import type { ClientFleet, GameState } from './types.ts';

interface Setup {
  P?: Partial<Planet>;
  rq?: ResearchQueue | null;
  fleets?: ClientFleet[];
  players?: GameState['players'];
  now?: number;
  cfg?: Partial<GameState['cfg']>;
}

function view(o: Setup = {}): V {
  const s = {
    cfg: { ...U, ...o.cfg },
    me: { id: 'u1' },
    galaxy: [],
    fleets: o.fleets ?? [],
    players: o.players ?? {
      u1: { name: 'Ich', points: 1500 },
      u2: { name: 'Feind', points: 9000 },
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
  owner: 'u1',
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 2, p: 3 },
  to: 'p1_2_3',
  mission: 'attack',
  state: 'out',
  arr: 5000,
  ships: { lf: 3 },
  ...o,
});

const plain = (row: FleetRow): string => row.parts.map((p) => p.text).join('');

describe('countdown', () => {
  it('counts down to a time in the future', () => {
    expect(countdown(61_000, 1000)).toEqual({ end: 61_000, left: dur(60_000) });
  });
  it('is due at and after its end', () => {
    expect(countdown(1000, 1000)).toEqual({ end: 1000, left: null });
    expect(countdown(999, 1000)).toEqual({ end: 999, left: null });
  });
});

describe('fleet movements', () => {
  it('describes an own fleet on its way out with its mission and ships', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ ships: { lf: 3, sc: 0, hf: 1200 } })] }),
      true,
    );
    expect(row).toEqual({
      id: 'f1',
      due: countdown(5000, 1000),
      cls: 'fl-attack',
      parts: [
        {
          text: `Deine Flotte (3 ${text('lf')!.n}, 1.200 ${text('hf')!.n}) von [1:1:5] erreicht [1:2:3] · ${MISSION.attack}`,
          bold: false,
        },
      ],
      recall: true,
    });
  });

  it('shows own missiles on their way with their mission and offers no recall (#54)', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ mission: 'missile', ships: { ipm: 4 } })] }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (4 ${text('ipm')!.n}) von [1:1:5] erreicht [1:2:3] · ${MISSION.missile}`,
    );
    expect(row!.cls).toBe('fl-missile');
    expect(row!.recall).toBe(false);
  });

  it('names the „Gottkaiser“ as the origin of the gift and offers no recall', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ gift: true, mission: 'deploy' })] }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (3 ${text('lf')!.n}) von Gottkaiser erreicht [1:2:3] · ${MISSION.deploy}`,
    );
    expect(row!.cls).toBe('fl-deploy');
    expect(row!.recall).toBe(false);
  });

  it('shows a returning fleet with its return time and no recall', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ state: 'back', arr: 5000, ret: 9000 })] }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (3 ${text('lf')!.n}) kehrt von [1:2:3] nach [1:1:5] zurück`,
    );
    expect(row!.due).toEqual(countdown(9000, 1000));
    expect(row!.cls).toBe('fl-back');
    expect(row!.recall).toBe(false);
  });

  it('takes the arrival when a returning fleet has no return time', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ state: 'back', arr: 5000 })] }),
      true,
    );
    expect(row!.due.end).toBe(5000);
  });

  it('names the owner of a foreign fleet in bold, with its ships', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({ owner: 'u2', fromC: { g: 2, s: 7, p: 1 }, mission: 'spy' }),
        ],
      }),
      true,
    );
    expect(row!.parts).toEqual([
      { text: 'Eine fremde Flotte von ', bold: false },
      { text: 'Feind', bold: true },
      {
        text: ` [2:7:1] erreicht deinen Planeten [1:2:3] · ${MISSION.spy} (3 ${text('lf')!.n})`,
        bold: false,
      },
    ]);
    expect(row!.cls).toBe('fl-spy');
    expect(row!.recall).toBe(false);
  });

  it('leaves out the ships of a foreign fleet that shows none', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ owner: 'u2', ships: { lf: 0 } })] }),
      true,
    );
    expect(row!.parts.at(-1)!.text).toBe(
      ` [1:1:5] erreicht deinen Planeten [1:2:3] · ${MISSION.attack}`,
    );
  });

  it('shows of a foreign fleet only what the Auspex-Lehre recognizes (#228)', () => {
    const lf = text('lf')!.n;
    const sc = text('sc')!.n;
    const seen = (o: Partial<ClientFleet>): string => {
      const f: ClientFleet = { ...fleet({ owner: 'u2' }), ...o };
      if (!('ships' in o)) delete f.ships;
      const [row] = fleetRows(view({ fleets: [f] }), true);
      return row!.parts.at(-1)!.text;
    };
    const line = ` [1:1:5] erreicht deinen Planeten [1:2:3] · ${MISSION.attack}`;
    expect(seen({})).toBe(`${line} (Zusammensetzung unbekannt)`);
    expect(seen({ total: 1234 })).toBe(`${line} (Schiffe insgesamt: 1.234)`);
    expect(seen({ total: 7, types: ['lf', 'sc'] })).toBe(
      `${line} (Schiffe insgesamt: 7 · ${lf}, ${sc})`,
    );
    expect(seen({ types: ['lf', 'zz'] })).toBe(`${line} (${lf}, zz)`);
    expect(
      seen({ total: 7, types: ['lf', 'sc'], ships: { lf: 5, sc: 2 } }),
    ).toBe(`${line} (5 ${lf}, 2 ${sc})`);
    expect(seen({ ships: { lf: 1000 } })).toBe(`${line} (1.000 ${lf})`);
  });

  it('shows an incoming missile flight like a foreign fleet, by the same recognition (#54, #228)', () => {
    const missiles = text(STRIKER)!.n;
    const seen = (o: Partial<ClientFleet>): string => {
      const f: ClientFleet = {
        ...fleet({ owner: 'u2', mission: 'missile' }),
        ...o,
      };
      if (!('ships' in o)) delete f.ships;
      const [row] = fleetRows(view({ fleets: [f] }), true);
      expect(row!.recall).toBe(false);
      return row!.parts.at(-1)!.text;
    };
    const line = ` [1:1:5] erreicht deinen Planeten [1:2:3] · ${MISSION.missile}`;
    expect(seen({})).toBe(`${line} (Zusammensetzung unbekannt)`);
    expect(seen({ total: 3, types: [STRIKER] })).toBe(
      `${line} (Schiffe insgesamt: 3 · ${missiles})`,
    );
    expect(seen({ ships: { [STRIKER]: 3 } })).toBe(`${line} (3 ${missiles})`);
  });

  it('calls an unknown owner „Unbekannt“ and an unknown ship by its key', () => {
    const [row] = fleetRows(
      view({ fleets: [fleet({ owner: 'u9', ships: { zz: 2 } })] }),
      true,
    );
    expect(row!.parts[1]).toEqual({ text: 'Unbekannt', bold: true });
    expect(row!.parts[2]!.text).toContain(' (2 zz)');
  });

  it('counts a fleet without ships as none', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({ ships: undefined as unknown as ClientFleet['ships'] }),
        ],
      }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte () von [1:1:5] erreicht [1:2:3] · ${MISSION.attack}`,
    );
  });

  // #259: an own fleet shows its cargo after its mission or its return.
  it('shows what an own fleet carries on its way out', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({ mission: 'transport', cargo: { m: 10_000, c: 5000, d: 0 } }),
        ],
      }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (3 ${text('lf')!.n}) von [1:1:5] erreicht [1:2:3] · ${MISSION.transport} · Ladung: Adamant 10.000 · Psikristall 5.000 · Promethium 0`,
    );
  });

  it('shows the loot a fleet brings home', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({ state: 'back', ret: 9000, cargo: { m: 0, c: 0, d: 2000 } }),
        ],
      }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (3 ${text('lf')!.n}) kehrt von [1:2:3] nach [1:1:5] zurück · Ladung: Adamant 0 · Psikristall 0 · Promethium 2.000`,
    );
  });

  it('shows no cargo part for a fleet whose cargo is all 0', () => {
    const rows = fleetRows(
      view({
        fleets: [
          fleet({ id: 'a', cargo: { m: 0, c: 0, d: 0 } }),
          fleet({ id: 'b', state: 'back', cargo: { m: 0, c: 0, d: 0 } }),
        ],
      }),
      true,
    );
    expect(rows.map(plain)).toEqual([
      `Deine Flotte (3 ${text('lf')!.n}) von [1:1:5] erreicht [1:2:3] · ${MISSION.attack}`,
      `Deine Flotte (3 ${text('lf')!.n}) kehrt von [1:2:3] nach [1:1:5] zurück`,
    ]);
  });

  it('shows the cargo of the gift of the „Endzeit“', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({
            gift: true,
            mission: 'deploy',
            cargo: { m: 0, c: 7, d: 0 },
          }),
        ],
      }),
      true,
    );
    expect(plain(row!)).toBe(
      `Deine Flotte (3 ${text('lf')!.n}) von Gottkaiser erreicht [1:2:3] · ${MISSION.deploy} · Ladung: Adamant 0 · Psikristall 7 · Promethium 0`,
    );
  });

  it('shows no cargo of a foreign fleet', () => {
    const [row] = fleetRows(
      view({
        fleets: [fleet({ owner: 'u2', cargo: { m: 500, c: 500, d: 500 } })],
      }),
      true,
    );
    expect(plain(row!)).toBe(
      `Eine fremde Flotte von Feind [1:1:5] erreicht deinen Planeten [1:2:3] · ${MISSION.attack} (3 ${text('lf')!.n})`,
    );
  });

  it('sorts by the time each fleet is due, and leaves out foreign ones on request', () => {
    const fleets = [
      fleet({ id: 'a', arr: 8000 }),
      fleet({ id: 'b', owner: 'u2', arr: 2000 }),
      fleet({ id: 'c', state: 'back', arr: 1000, ret: 4000 }),
    ];
    const ids = (rows: FleetRow[]) => rows.map((r) => r.id);
    expect(ids(fleetRows(view({ fleets }), true))).toEqual(['b', 'c', 'a']);
    expect(ids(fleetRows(view({ fleets }), false))).toEqual(['c', 'a']);
  });

  it('is empty without fleets', () => {
    expect(fleetRows(view(), true)).toEqual([]);
  });

  it('shows an own fleet that holds until the end of its holding time, with a recall (#55)', () => {
    const [row] = fleetRows(
      view({
        fleets: [
          fleet({
            mission: 'hold',
            state: 'hold',
            arr: 5000,
            hold: 3000,
            ret: 20_000,
            cargo: { m: 10, c: 0, d: 0 },
          }),
        ],
      }),
      false,
    );
    expect(row).toEqual({
      id: 'f1',
      due: countdown(8000, 1000),
      cls: 'fl-hold',
      parts: [
        {
          text: `Deine Flotte (3 ${text('lf')!.n}) hält bei [1:2:3] · ${MISSION.hold} · Ladung: Adamant 10 · Psikristall 0 · Promethium 0`,
          bold: false,
        },
      ],
      recall: true,
    });
  });

  it('shows an own expedition at its position as a flight that is due when its stay ends, no Halten, with a recall (#93)', () => {
    // The stay is what lies between the times; the fleet is out until its end (state out, no holding time).
    const [row] = fleetRows(
      view({
        fleets: [fleet({ mission: 'expedition', state: 'out', arr: 9000 })],
      }),
      false,
    );
    expect(row).toMatchObject({
      id: 'f1',
      due: countdown(9000, 1000),
      cls: 'fl-expedition',
      recall: true,
    });
    expect(row!.parts[0]!.text).toContain(MISSION.expedition);
    expect(row!.parts[0]!.text).not.toContain('hält bei');
  });

  it('keeps an expedition of another player out of „Gehaltene Flotten“ and off the planet it never flies to', () => {
    const v = view({
      fleets: [fleet({ owner: 'u2', mission: 'expedition', state: 'out' })],
    });
    expect(heldRows(v)).toEqual([]);
    expect(fleetRows(v, false)).toEqual([]);
  });
});

describe('fleets that hold at the planet (#55)', () => {
  const held = (o: Partial<ClientFleet> = {}) =>
    fleet({
      owner: 'u2',
      mission: 'hold',
      state: 'hold',
      arr: 2000,
      hold: 5000,
      ships: { bs: 2 },
      ...o,
    });

  it('are no movements, but „Gehaltene Flotten“ with owner, origin, ships and end', () => {
    const v = view({
      fleets: [
        held({ id: 'h2', hold: 9000 }),
        held({ id: 'h1' }),
        held({ id: 'out', state: 'out' }),
      ],
    });
    expect(fleetRows(v, true).map((r) => r.id)).toEqual(['out']);
    expect(heldRows(v)).toEqual([
      {
        id: 'h1',
        due: countdown(7000, 1000),
        parts: [
          { text: 'Flotte von ', bold: false },
          { text: 'Feind', bold: true },
          { text: ` [1:1:5] (2 ${text('bs')!.n})`, bold: false },
        ],
      },
      expect.objectContaining({ id: 'h2', due: countdown(11_000, 1000) }),
    ]);
    expect(overviewPage(v).held).toEqual(heldRows(v));
  });

  it('word what the server sent of the ships, less than all only when it sent less (#228)', () => {
    const ships = (o: Partial<ClientFleet>) =>
      heldRows(view({ fleets: [held({ ships: undefined, ...o })] }))[0]!
        .parts[2]!.text;
    expect(ships({ total: 3, types: ['bs', 'lf'] })).toBe(
      ` [1:1:5] (Schiffe insgesamt: 3 · ${text('bs')!.n}, ${text('lf')!.n})`,
    );
    expect(ships({ total: 3 })).toBe(' [1:1:5] (Schiffe insgesamt: 3)');
    expect(ships({})).toBe(' [1:1:5] (Zusammensetzung unbekannt)');
  });

  it('leave out the own fleets that hold elsewhere', () => {
    expect(heldRows(view({ fleets: [held({ owner: 'u1' })] }))).toEqual([]);
  });
});

describe('activities', () => {
  it('is empty when nothing is in work', () => {
    expect(activityRows(view())).toEqual([]);
  });

  it('lists the building, the research and the shipyard in that order', () => {
    const v = view({
      P: {
        bq: { key: 'metal', lvl: 4, start: 0, end: 7000, cost: [0, 0, 0] },
        sq: [
          { key: 'lf', n: 1200, unit: 3000 },
          { key: 'rl', n: 2, unit: 500 },
        ],
        sqT: 2000,
      },
      rq: { key: 'energy', lvl: 2, start: 0, end: 500, cost: [0, 0, 0] },
    });
    expect(activityRows(v)).toEqual([
      {
        label: 'Gebäude',
        what: `${text('metal')!.n} (Stufe 4)`,
        due: countdown(7000, 1000),
        next: false,
      },
      {
        label: 'Forschung',
        what: `${text('energy')!.n} (Stufe 2)`,
        due: { end: 500, left: null },
        next: false,
      },
      {
        label: 'Schiffsschmiede',
        what: `1.200× ${text('lf')!.n}, 2× ${text('rl')!.n}`,
        due: countdown(5000, 1000),
        next: true,
      },
    ]);
  });

  it('keeps the rows of entries the client does not know (a newer server)', () => {
    const v = view({
      P: {
        bq: { key: 'zz', lvl: 4, start: 0, end: 7000, cost: [0, 0, 0] },
        sq: [{ key: 'zz', n: 2, unit: 3000 }],
      },
      rq: { key: 'zz', lvl: 2, start: 0, end: 500, cost: [0, 0, 0] },
    });
    const rows = activityRows(v);
    expect(rows.map((r) => r.label)).toEqual([
      'Gebäude',
      'Forschung',
      'Schiffsschmiede',
    ]);
    expect(rows[0]!.what).toMatch(/ \(Stufe 4\)$/);
    expect(rows[1]!.what).toMatch(/ \(Stufe 2\)$/);
    expect(rows[2]!.what).toMatch(/^2× /);
  });

  it('counts the next unit from now when the shipyard has no start yet', () => {
    const v = view({ P: { sq: [{ key: 'lf', n: 1, unit: 3000 }], sqT: null } });
    expect(activityRows(v)[0]!.due).toEqual(countdown(4000, 1000));
  });
});

describe('overview page', () => {
  it('shows a planet with its name, position, type and temperature', () => {
    const P = { name: 'Heimat', temp: 50, diameter: 12800, b: { metal: 3 } };
    const page = overviewPage(view({ P }));
    expect(page).toMatchObject({
      title: 'Übersicht – Heimat [1:1:5]',
      moon: false,
      label: 'Planet',
      name: 'Heimat',
      position: '[1:1:5]',
      type: planetLook(planet(P)).name,
      temperature: 'ca. 10°C bis 50°C',
      time: dt(1000),
    });
    expect(page.diameter).toMatch(/^12\.800 km \(3\/\d/);
  });

  it('shows a moon as „Mond“ with its name', () => {
    const page = overviewPage(
      view({ P: { kind: 'moon', name: 'Luna', temp: -10, diameter: 4000 } }),
    );
    expect(page).toMatchObject({
      title: 'Übersicht – Luna (Mond) [1:1:5]',
      moon: true,
      label: 'Mond',
      name: 'Luna (Mond)',
      type: 'Mond',
      temperature: 'ca. -50°C bis -10°C',
    });
  });

  it('offers „Kolonie aufgeben“ on a planet that is not the main planet (#224)', () => {
    const colony = view();
    expect(overviewPage(colony).abandon).toBe(true);
    const main = view();
    main.s.mainPlanet = 'p1_1_5';
    expect(overviewPage(main).abandon).toBe(false);
    expect(overviewPage(view({ P: { kind: 'moon' } })).abandon).toBe(false);
  });

  it('shows the planets against the limit of the round (#237)', () => {
    const v = view({ P: { name: 'Heimat' } });
    v.s.cfg = {
      ...v.s.cfg,
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 4,
    };
    v.s.galaxy = [
      {
        id: 'p1_1_5',
        kind: 'planet',
        name: 'Heimat',
        g: 1,
        s: 1,
        p: 5,
        temp: 1,
        owner: v.s.me.id,
      },
    ];
    expect(overviewPage(v).planets).toBe(
      'Planeten: 1 / 6 · Kolonialverwaltung Stufe 0',
    );
    // Without a limit in the round.
    expect(overviewPage(view()).planets).toMatch(
      /^Planeten: \d+ · unbegrenzt$/,
    );
  });

  it('shows the points and the place in the highscore', () => {
    expect(overviewPage(view()).points).toBe('1.500 (Platz 2 von 2)');
    const alone = view({
      players: { u2: { name: 'Feind', points: 3 } } as never,
    });
    expect(overviewPage(alone).points).toBe('0 (Platz - von 1)');
  });

  it('shows the own points without a place while the highscore shows nothing (#422, 182a)', () => {
    const none = view({
      players: {
        u1: { name: 'Ich', points: 1500 },
        u2: { name: 'Feind' },
      } as never,
    });
    none.s = { ...none.s, round: { highscoreShows: 2 } } as never;
    expect(overviewPage(none).points).toBe('1.500');
    // „nur Gesamt“ keeps the place.
    const total = view();
    total.s = { ...total.s, round: { highscoreShows: 1 } } as never;
    expect(overviewPage(total).points).toBe('1.500 (Platz 2 von 2)');
  });

  it('has the fleets of everyone and the activities', () => {
    const v = view({
      fleets: [fleet({ owner: 'u2' })],
      P: { bq: { key: 'metal', lvl: 1, start: 0, end: 2000, cost: [0, 0, 0] } },
    });
    const page = overviewPage(v);
    expect(page.fleets).toEqual(fleetRows(v, true));
    expect(page.activities).toEqual(activityRows(v));
  });
});
