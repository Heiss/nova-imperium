// The categories of the highscore (#78): one ranking each (D3).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HIGHSCORE_CATEGORIES,
  type HighscoreCategory,
  highscoreCategory,
  highscoreNote,
  highscorePage,
  highscoreRanking,
} from './highscore.ts';
import type { GameState, Players } from './types.ts';
import type { Ui, V } from '../views/common.ts';

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

/** A view state of the players with the places of the galaxy and the chosen category. */
const view = (
  galaxy: unknown[],
  highscore?: HighscoreCategory,
  me = 'u_Bert',
): V =>
  ({
    s: { me: { id: me }, players, galaxy } as unknown as GameState,
    ui: { highscore } as Ui,
  }) as V;

describe('the page of the highscore', () => {
  it('has one button per category, only the shown one pressed', () => {
    expect(highscorePage(view([], 'fleet')).buttons).toEqual([
      { key: 'total', label: 'Gesamt', pressed: false },
      { key: 'buildings', label: 'Gebäude', pressed: false },
      { key: 'research', label: 'Forschung', pressed: false },
      { key: 'fleet', label: 'Flotte', pressed: true },
      { key: 'defense', label: 'Verteidigung', pressed: false },
    ]);
  });

  it('shows the total until a category is chosen, or one that does not exist', () => {
    for (const chosen of [undefined, 'resources' as HighscoreCategory]) {
      const page = highscorePage(view([], chosen));
      expect(page.buttons.find((b) => b.pressed)?.key).toBe('total');
      expect(page.note).toBe(highscoreNote('total'));
    }
  });

  it('numbers the rows by the points of the category and marks the own one', () => {
    const page = highscorePage(view([], 'fleet'));
    expect(
      page.rows.map((r) => [r.rank, r.name, r.points, r.me, r.home]),
    ).toEqual([
      [1, 'Anna', '40', false, null],
      [2, 'Bert', '5', true, null],
      [3, 'Cleo', '0', false, null],
    ]);
    expect(page.note).toBe(highscoreNote('fleet'));
  });

  it('formats the points like the rest of the interface', () => {
    const rich: Players = { u_Anna: { name: 'Anna', points: 1234567 } };
    const page = highscorePage({
      s: { me: { id: 'u_x' }, players: rich, galaxy: [] },
      ui: {},
    } as unknown as V);
    expect(page.rows[0]!.points).toBe('1.234.567');
  });

  it('names a planet of the player, never a moon, even when the moon is listed first (#53)', () => {
    const at = { g: 1, s: 2, p: 5, temp: 20, owner: 'u_Anna' };
    const page = highscorePage(
      view([
        { ...at, id: 'm1_2_5', kind: 'moon', name: 'Mond' },
        { ...at, id: 'p1_2_5', kind: 'planet', name: 'Heimat' },
      ]),
    );
    const anna = page.rows.find((r) => r.id === 'u_Anna')!;
    expect(anna.home).toEqual({ name: 'Heimat', g: 1, s: 2, at: '[1:2:5]' });
    expect(JSON.stringify(page)).not.toContain('Mond');
  });

  it('has no home for a player with a moon only', () => {
    const page = highscorePage(
      view([
        {
          g: 1,
          s: 2,
          p: 5,
          temp: 20,
          owner: 'u_Anna',
          id: 'm1_2_5',
          kind: 'moon',
          name: 'Mond',
        },
      ]),
    );
    expect(page.rows.find((r) => r.id === 'u_Anna')!.home).toBeNull();
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
