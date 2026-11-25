// „Highscore“ renders as before #118, bundle 5 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: highscore() of src/client/views/misc.ts with
// highscoreButtonsHTML() of logic/highscore.ts and homeCell() of
// views/common.ts (removed with the buddy list, bundle 7). On generated states
// (fixed fast-check seed 118) both render the same markup, up to what a
// browser does not show (normalize() of markup.ts); hand-built cases reach
// the rare marks. The markup stays the one the phone layout of style.css
// (`.scores td.n`, `.scores .home`, …) reads, which the test of the classes
// below pins.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coords, esc, fmt } from '../client/logic/format.ts';
import { homePlanetOf } from '../client/logic/friends.ts';
import {
  HIGHSCORE_CATEGORIES,
  highscoreCategory,
  highscoreNote,
  highscoreStand,
  highscoreRanking,
} from '../client/logic/highscore.ts';
import type { GalaxyPlanet } from '../client/logic/types.ts';
import type { Ui, V } from '../client/views/common.ts';
import { highscoreView } from './highscore-view.ts';
import { normalize } from './markup.ts';

// ----- frozen: the Highscore before #118, bundle 5 -----

const homeCell = (pl: GalaxyPlanet | null): string =>
  pl
    ? `<span class="home">${esc(pl.name)}</span> <span class="lnk" data-act="gto" data-g="${pl.g}" data-s="${pl.s}">${coords(pl)}</span>`
    : '-';

const highscoreButtonsHTML = (cat: keyof typeof HIGHSCORE_CATEGORIES): string =>
  `<div class="flex" role="group" aria-labelledby="highscore-h">${Object.entries(
    HIGHSCORE_CATEGORIES,
  )
    .map(
      ([key, label]) =>
        `<button type="button" data-act="highscore" data-cat="${key}" aria-pressed="${key === cat}">${label}</button>`,
    )
    .join('')}</div>`;

/**
 * Changed on purpose since #118: the line „Stand: {Uhrzeit}“ of the pass the
 * points come from (owner, 2026-11-25, #405), when the state names one.
 */
const stand = (v: V): string =>
  v.s.scoresAt === undefined
    ? ''
    : `<div class="dim">${highscoreStand(v.s.scoresAt)}</div>`;

function highscore(v: V): string {
  const cat = highscoreCategory(v.ui.highscore);
  const list = highscoreRanking(v.s.players, cat);
  const rows = list.map(([id, x], i) => {
    const home = homeCell(homePlanetOf(v.s.galaxy, id));
    return `<tr class="${id === v.s.me.id ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(x.name)}</td><td>${home}</td><td class="n">${fmt(x.points)}</td></tr>`;
  });
  return `<h2 id="highscore-h">Highscore</h2>${highscoreButtonsHTML(cat)}<div class="box"><table class="scores"><tr><th class="n">Platz</th><th>Spieler</th><th>Heimatplanet</th><th class="n">Punkte</th></tr>${rows.join('')}</table></div>${stand(v)}<div class="dim">${highscoreNote(cat)}</div>`;
}

// ----- the comparison -----

const IDS = ['u_a', 'u_b', 'u_c', 'u_d', 'u_e', 'u_f'] as const;
/** What a name may hold that is not plain text. */
const NAMES = ['Anna', 'Bert <b>', 'Cleo & Co', 'D"ora', "Emil's", 'a > b'];

const player = fc.record({
  name: fc.constantFrom(...NAMES),
  points: fc.integer({ min: 0, max: 5_000_000 }),
  scores: fc.option(
    fc.record({
      buildings: fc.integer({ min: 0, max: 3_000_000 }),
      research: fc.integer({ min: 0, max: 300 }),
      fleet: fc.integer({ min: 0, max: 20_000 }),
      defense: fc.integer({ min: 0, max: 3_000_000 }),
    }),
    { nil: undefined },
  ),
});

/** A planet or a moon of a player, a moon sometimes listed before the planet (#53). */
const place = fc.record({
  owner: fc.constantFrom(...IDS),
  kind: fc.constantFrom('planet' as const, 'moon' as const),
  name: fc.constantFrom('Heimat', 'Mond <1>', 'Kolonie & Co', 'Z"'),
  g: fc.integer({ min: 1, max: 4 }),
  s: fc.integer({ min: 1, max: 40 }),
  p: fc.integer({ min: 1, max: 15 }),
});

const state = fc
  .record({
    players: fc.uniqueArray(fc.tuple(fc.constantFrom(...IDS), player), {
      maxLength: 6,
      selector: ([id]) => id,
    }),
    me: fc.constantFrom(...IDS, 'u_nobody'),
    places: fc.array(place, { maxLength: 10 }),
    category: fc.option(
      fc.constantFrom(
        ...Object.keys(HIGHSCORE_CATEGORIES),
        'resources',
        'toString',
        '',
      ),
      { nil: undefined },
    ),
  })
  .map((x) => viewOf(x.players, x.me, x.places, x.category));

function viewOf(
  players: [string, Record<string, unknown>][],
  me: string,
  places: Record<string, unknown>[],
  category?: string,
): V {
  return {
    s: {
      me: { id: me },
      players: Object.fromEntries(players),
      galaxy: places.map((p, i) => ({
        ...p,
        id: `x${i}`,
        temp: 0,
      })),
    },
    ui: { highscore: category } as unknown as Ui,
  } as unknown as V;
}

/** The cases the sample reaches rarely: nobody, a moon only, the own row, every category. */
const at = { g: 1, s: 2, p: 5 };
const HAND_BUILT: [string, V][] = [
  ['no players', viewOf([], 'u_a', [])],
  [
    'a player with a moon only has no home planet (#53)',
    viewOf([['u_a', { name: 'Anna', points: 7 }]], 'u_a', [
      { ...at, owner: 'u_a', kind: 'moon', name: 'Mond' },
    ]),
  ],
  [
    'a planet after its moon',
    viewOf([['u_a', { name: 'Anna', points: 7 }]], 'u_b', [
      { ...at, owner: 'u_a', kind: 'moon', name: 'Mond' },
      { ...at, owner: 'u_a', kind: 'planet', name: 'Heimat' },
    ]),
  ],
  [
    'equal points keep the order of the players',
    viewOf(
      [
        ['u_a', { name: 'Anna', points: 5 }],
        ['u_b', { name: 'Bert', points: 5 }],
        ['u_c', { name: 'Cleo', points: 5 }],
      ],
      'u_b',
      [],
    ),
  ],
  ...Object.keys(HIGHSCORE_CATEGORIES).map((cat): [string, V] => [
    `the category ${cat} with and without scores`,
    viewOf(
      [
        [
          'u_a',
          {
            name: 'Anna',
            points: 90,
            scores: { buildings: 8, research: 3, fleet: 1, defense: 0 },
          },
        ],
        ['u_b', { name: 'Bert', points: 40 }],
      ],
      'u_b',
      [],
      cat,
    ),
  ]),
];

describe('Highscore against the view before #118, bundle 5', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(highscoreView(v))).toBe(normalize(highscore(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(highscoreView(v)), name).toBe(normalize(highscore(v)));
  });

  it('keeps the classes and cells the phone layout of style.css reads', () => {
    const html = highscoreView(HAND_BUILT[2]![1]);
    expect(html).toContain('<table class="scores">');
    expect(html).toContain('<th class="n">Platz</th>');
    expect(html).toMatch(
      /<td class="n">1<\/td><td>Anna<\/td><td><span class="home">Heimat<\/span>/,
    );
    expect(html).toMatch(/<td class="n">7<\/td>/);
  });
});
