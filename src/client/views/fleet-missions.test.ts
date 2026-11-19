// The fleet form offers only the missions that fit the target and a list
// „Schnellwahl“ (#253), and names the limit of planets beside a Landnahme
// (#237).
import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { GameState } from '../logic/types.ts';
import { fleetView as fleet } from '../../test/fleet-view.ts';
import type { Ui, V } from './common.ts';

const place = (
  id: string,
  kind: 'planet' | 'moon',
  name: string,
  g: number,
  s: number,
  p: number,
  owner: string,
) => ({ id, kind, name, g, s, p, temp: 1, owner });

type At = { g: number; s: number; p: number; kind?: 'moon' };

function view(
  to: At | null,
  over: { ships?: Record<string, number>; me?: object; cfg?: object } = {},
  galaxy: ReturnType<typeof place>[] = [
    place('p1_1_5', 'planet', 'Heimat', 1, 1, 5, 'u1'),
    place('p1_2_6', 'planet', 'Beta', 1, 2, 6, 'u2'),
    place('p1_3_7', 'planet', 'Kolonie <i>', 1, 3, 7, 'u1'),
    place('m1_3_7', 'moon', 'Mond', 1, 3, 7, 'u1'),
  ],
  fm?: string,
): V {
  const s = {
    cfg: over.cfg ?? U,
    me: { id: 'u1', probes: 1, research: {}, ...over.me },
    players: { u1: { name: 'Anna', points: 1 } },
    galaxy,
    debris: [],
    fleets: [],
  } as unknown as GameState;
  return {
    s,
    P: planet({ ships: over.ships ?? { lc: 5 } }),
    R: { research: {}, rq: null },
    now: 0,
    ui: { gal: 1, sys: 1, ft: to, ...(fm ? { fm } : {}) } as Ui,
  };
}

/** The values of the options of the list „Auftrag“. */
const missions = (html: string): string[] => {
  const list = /<select id="t_m"[^>]*>(.*?)<\/select>/.exec(html)![1]!;
  return [...list.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]!);
};

describe('the list „Auftrag“ of the fleet form (#253)', () => {
  it('holds only the missions that fit a foreign planet', () => {
    expect(missions(fleet(view({ g: 1, s: 2, p: 6 })))).toEqual([
      'attack',
      'transport',
      'spy',
      'hold',
    ]);
  });

  it('holds the Landnahme and the Vermessung on an empty field, and no attack', () => {
    expect(missions(fleet(view({ g: 1, s: 4, p: 8 })))).toEqual([
      'colonize',
      'survey',
    ]);
  });

  it('holds the transport and the deploy on an own planet, and only the expedition on the expedition position', () => {
    expect(missions(fleet(view({ g: 1, s: 3, p: 7 })))).toEqual([
      'transport',
      'deploy',
    ]);
    expect(missions(fleet(view({ g: 1, s: 4, p: 16 })))).toEqual([
      'expedition',
    ]);
  });

  it('selects the mission of the map link while it fits, else the first one in today`s order', () => {
    expect(fleet(view({ g: 1, s: 2, p: 6 }, {}, undefined, 'spy'))).toContain(
      '<option value="spy" selected>',
    );
    const html = fleet(view({ g: 1, s: 2, p: 6 }, {}, undefined, 'colonize'));
    expect(html).toContain('<option value="attack" selected>');
    expect(html).not.toContain('value="colonize"');
  });

  it('says that no mission fits, and blocks the button, while the target is the start planet', () => {
    // The form starts from the planet at 1:1:5 and aims there by default.
    for (const to of [null, { g: 1, s: 1, p: 5 }]) {
      const html = fleet(view(to));
      expect(missions(html)).toEqual(['']);
      expect(html).toContain(
        '<option value="" selected disabled>Kein Auftrag passt zum Ziel</option>',
      );
      expect(/<button id="t_send"[^>]*>/.exec(html)![0]).toContain('disabled');
    }
  });

  it('enables the button when a mission fits, and keeps it blocked when all slots are used', () => {
    const open = /<button id="t_send"[^>]*>/.exec(
      fleet(view({ g: 1, s: 2, p: 6 })),
    )![0];
    expect(open).not.toContain('disabled');
    expect(open).toContain('data-full=""');
    // One slot, one fleet on its way: all slots are used.
    const full = view({ g: 1, s: 2, p: 6 });
    full.s.fleets = [
      {
        id: 'f1',
        owner: 'u1',
        fromC: { g: 1, s: 1, p: 5 },
        toC: { g: 1, s: 2, p: 6 },
        to: 'p1_2_6',
        mission: 'attack',
        state: 'out',
        arr: 5000,
      },
    ];
    const blocked = /<button id="t_send"[^>]*>/.exec(fleet(full))![0];
    expect(blocked).toContain('disabled');
    expect(blocked).toContain('data-full="1"');
  });
});

describe('the list „Schnellwahl“ of the fleet form (#253)', () => {
  it('is labelled, starts with „– wählen –“ and lists the other own planets and moons', () => {
    const html = fleet(view({ g: 1, s: 2, p: 6 }));
    expect(html).toContain('<label for="t_q">Schnellwahl</label>');
    const list = /<select id="t_q"[^>]*>(.*?)<\/select>/.exec(html)![1]!;
    expect(list).toBe(
      '<option value="">– wählen –</option><option value="p1_3_7">Kolonie &lt;i> [1:3:7]</option><option value="m1_3_7">Mond (Mond) [1:3:7]</option>',
    );
    expect(/<select id="t_q"[^>]*>/.exec(html)![0]).not.toContain('disabled');
  });

  it('escapes the names of players in the options', () => {
    const v = view({ g: 1, s: 2, p: 6 });
    v.s.players.u2 = { name: 'Bert <b>', points: 1 };
    v.s.quick = { friends: ['p1_2_6'], guild: [], last: [] };
    const html = fleet(v);
    expect(html).toContain('Freund: Bert &lt;b> [1:2:6]');
    expect(html).not.toContain('<b>');
  });

  it('is disabled without another own place of the player', () => {
    const html = fleet(
      view({ g: 1, s: 2, p: 6 }, {}, [
        place('p1_1_5', 'planet', 'Heimat', 1, 1, 5, 'u1'),
      ]),
    );
    expect(/<select id="t_q"[^>]*>/.exec(html)![0]).toContain('disabled');
  });
});

describe('the limit of planets beside the Landnahme (#237)', () => {
  const ROUND = {
    ...U,
    roundColonyBase: 6,
    roundColonyResearch: 1,
    roundColonyPerLevel: 2,
    roundColonyMaxLevel: 4,
  };
  const note = (html: string): string =>
    /<span id="t_limit" class="dim">(.*?)<\/span>/.exec(html)![1]!;

  it('names the planets against the limit when a Landnahme is chosen', () => {
    const html = fleet(view({ g: 1, s: 4, p: 8 }, { cfg: ROUND }));
    expect(note(html)).toBe('Planeten: 2 / 6 · Kolonialverwaltung Stufe 0');
  });

  it('says nothing for another mission, and „unbegrenzt“ without a limit', () => {
    expect(note(fleet(view({ g: 1, s: 2, p: 6 }, { cfg: ROUND })))).toBe('');
    expect(note(fleet(view({ g: 1, s: 4, p: 8 })))).toBe(
      'Planeten: 2 · unbegrenzt',
    );
  });
});
