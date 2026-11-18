// The categories of the highscore (#78): one ranking each (D3).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HIGHSCORE_CATEGORIES,
  type HighscoreCategory,
  highscoreButtonsHTML,
  highscoreCategory,
  highscoreNote,
  highscoreRanking,
} from './highscore.ts';
import type { Players } from './types.ts';

const players: Players = {
  u_Anna: {
    name: 'Anna',
    points: 50,
    scores: { buildings: 30, research: 2, fleet: 40, defense: 1 },
  },
  u_Bert: {
    name: 'Bert',
    points: 70,
    scores: { buildings: 10, research: 9, fleet: 5, defense: 3 },
  },
  u_Cleo: {
    name: 'Cleo',
    points: 60,
    scores: { buildings: 20, research: 9, fleet: 0, defense: 2 },
  },
};

const order = (cat: HighscoreCategory): string[] =>
  highscoreRanking(players, cat).map(([id]) => id);

describe('the categories of the highscore (#78)', () => {
  it('are total, buildings, research, fleet and defense, in that order (D1, D3)', () => {
    expect(HIGHSCORE_CATEGORIES).toEqual({
      total: 'Gesamt',
      buildings: 'Gebäude',
      research: 'Forschung',
      fleet: 'Flotte',
      defense: 'Verteidigung',
    });
    expect(Object.keys(HIGHSCORE_CATEGORIES)).toEqual([
      'total',
      'buildings',
      'research',
      'fleet',
      'defense',
    ]);
  });

  it('take a known key and fall back to the total otherwise', () => {
    for (const key of Object.keys(HIGHSCORE_CATEGORIES))
      expect(highscoreCategory(key)).toBe(key);
    for (const key of [undefined, null, '', 'toString', 'resources', 3])
      expect(highscoreCategory(key)).toBe('total');
  });
});

describe('the ranking of a category', () => {
  it('sorts by the points of the category, best first', () => {
    expect(order('total')).toEqual(['u_Bert', 'u_Cleo', 'u_Anna']);
    expect(order('buildings')).toEqual(['u_Anna', 'u_Cleo', 'u_Bert']);
    expect(order('fleet')).toEqual(['u_Anna', 'u_Bert', 'u_Cleo']);
    expect(order('defense')).toEqual(['u_Bert', 'u_Cleo', 'u_Anna']);
  });

  it('keeps the order of the players for equal points', () => {
    expect(order('research')).toEqual(['u_Bert', 'u_Cleo', 'u_Anna']);
  });

  it('shows the points of the category with the name', () => {
    expect(highscoreRanking(players, 'fleet')).toEqual([
      ['u_Anna', { name: 'Anna', points: 40 }],
      ['u_Bert', { name: 'Bert', points: 5 }],
      ['u_Cleo', { name: 'Cleo', points: 0 }],
    ]);
    expect(highscoreRanking(players, 'total')[0]).toEqual([
      'u_Bert',
      { name: 'Bert', points: 70 },
    ]);
  });

  it('counts a player without categories as 0 there, not in the total', () => {
    const old: Players = { u_Dora: { name: 'Dora', points: 9 } };
    expect(highscoreRanking(old, 'research')).toEqual([
      ['u_Dora', { name: 'Dora', points: 0 }],
    ]);
    expect(highscoreRanking(old, 'total')).toEqual([
      ['u_Dora', { name: 'Dora', points: 9 }],
    ]);
  });

  it('is a descending order of every player, whatever the points', () => {
    const scores = fc.record({
      buildings: fc.nat(),
      research: fc.nat(),
      fleet: fc.nat(),
      defense: fc.nat(),
    });
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string(),
          fc.record({ name: fc.string(), points: fc.nat(), scores }),
        ),
        fc.constantFrom(
          ...(Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[]),
        ),
        (ps, cat) => {
          const list = highscoreRanking(ps, cat);
          expect(list.map(([id]) => id).sort()).toEqual(Object.keys(ps).sort());
          for (let i = 1; i < list.length; i++)
            expect(list[i - 1]![1].points).toBeGreaterThanOrEqual(
              list[i]![1].points,
            );
        },
      ),
      { seed: 78 },
    );
  });
});

describe('the buttons of the categories', () => {
  it('has one button per category, only the shown one pressed', () => {
    const html = highscoreButtonsHTML('fleet');
    expect(html).toBe(
      '<div class="flex" role="group" aria-labelledby="highscore-h">' +
        '<button type="button" data-act="highscore" data-cat="total" aria-pressed="false">Gesamt</button>' +
        '<button type="button" data-act="highscore" data-cat="buildings" aria-pressed="false">Gebäude</button>' +
        '<button type="button" data-act="highscore" data-cat="research" aria-pressed="false">Forschung</button>' +
        '<button type="button" data-act="highscore" data-cat="fleet" aria-pressed="true">Flotte</button>' +
        '<button type="button" data-act="highscore" data-cat="defense" aria-pressed="false">Verteidigung</button>' +
        '</div>',
    );
  });
});

describe('the note below the table', () => {
  it('keeps the sentence of the total and names the category at 1 per 1,000 (D5)', () => {
    expect(highscoreNote('total')).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Schiffe, Verteidigung).',
    );
    expect(highscoreNote('buildings')).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude).',
    );
    expect(highscoreNote('defense')).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Verteidigung).',
    );
  });

  it('counts ships and research levels for fleet and research (Q1, owner 2026-11-17)', () => {
    expect(highscoreNote('fleet')).toBe(
      '1 Punkt pro Schiff (auch Sonnenreliquiare).',
    );
    expect(highscoreNote('research')).toBe('1 Punkt pro Forschungsstufe.');
  });
});
