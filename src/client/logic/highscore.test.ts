// The categories of the highscore (#422): Gesamt, Wirtschaft and Militär,
// one ranking each (D3 of #78), the notes by the mode of the round (168a).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HIGHSCORE_CATEGORIES,
  highscoreNote,
} from '../../core/highscore-categories.ts';
import {
  type HighscoreCategory,
  highscoreCategory,
  highscorePage,
  highscoreStand,
  highscoreRanking,
} from './highscore.ts';
import type { GameState, Players } from './types.ts';
import type { Ui, V } from '../views/common.ts';

const players: Players = {
  u_Anna: { name: 'Anna', points: 50, scores: { economy: 30, military: 40 } },
  u_Bert: { name: 'Bert', points: 70, scores: { economy: 10, military: 5 } },
  u_Cleo: { name: 'Cleo', points: 60, scores: { economy: 30, military: 0 } },
};

const order = (cat: HighscoreCategory): string[] =>
  highscoreRanking(players, cat).map(([id]) => id);

describe('the categories of the highscore (#422)', () => {
  it('are Gesamt, Wirtschaft and Militär, in that order (160a)', () => {
    expect(HIGHSCORE_CATEGORIES).toEqual({
      total: 'Gesamt',
      economy: 'Wirtschaft',
      military: 'Militär',
    });
    expect(Object.keys(HIGHSCORE_CATEGORIES)).toEqual([
      'total',
      'economy',
      'military',
    ]);
  });

  it('take a known key and fall back to the total otherwise, also an old category', () => {
    for (const key of Object.keys(HIGHSCORE_CATEGORIES))
      expect(highscoreCategory(key)).toBe(key);
    for (const key of [
      undefined,
      null,
      '',
      'toString',
      'resources',
      'buildings',
      'research',
      'fleet',
      'defense',
      3,
    ])
      expect(highscoreCategory(key)).toBe('total');
  });
});

describe('the ranking of a category', () => {
  it('sorts by the value of the category, best first', () => {
    expect(order('total')).toEqual(['u_Bert', 'u_Cleo', 'u_Anna']);
    expect(order('military')).toEqual(['u_Anna', 'u_Bert', 'u_Cleo']);
  });

  it('keeps the order of the players for equal values', () => {
    expect(order('economy')).toEqual(['u_Anna', 'u_Cleo', 'u_Bert']);
  });

  it('shows the value of the category with the name', () => {
    expect(highscoreRanking(players, 'military')).toEqual([
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
    expect(highscoreRanking(old, 'economy')).toEqual([
      ['u_Dora', { name: 'Dora', points: 0 }],
    ]);
    expect(highscoreRanking(old, 'total')).toEqual([
      ['u_Dora', { name: 'Dora', points: 9 }],
    ]);
  });

  it('is a descending order of every player, whatever the values', () => {
    const scores = fc.record({ economy: fc.nat(), military: fc.nat() });
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

/** The modes of a round: Anzahl (0) or Rohstoffe (1) for Wirtschaft and Militär. */
const round = (economy = 0, military = 0) => ({
  highscoreEconomy: economy,
  highscoreMilitary: military,
});

/** A view state of the players with the places of the galaxy and the chosen category. */
const view = (
  galaxy: unknown[],
  highscore?: HighscoreCategory,
  me = 'u_Bert',
  modes = round(),
): V =>
  ({
    s: {
      me: { id: me },
      players,
      galaxy,
      round: modes,
    } as unknown as GameState,
    ui: { highscore } as Ui,
  }) as V;

describe('„Stand“ of the highscore (#405)', () => {
  it('names the clock time of the pass the points come from', () => {
    const at = new Date(2026, 10, 25, 8, 5, 42).getTime();
    expect(highscoreStand(at)).toBe('Stand: 08:05');
    const page = highscorePage({
      ...view([]),
      s: { ...view([]).s, scoresAt: at },
    } as V);
    expect(page.stand).toBe('Stand: 08:05');
  });

  it('is empty for a state without a pass (a server before #405)', () => {
    expect(highscorePage(view([])).stand).toBe('');
  });
});

describe('the page of the highscore', () => {
  it('has one button per category, only the shown one pressed', () => {
    expect(highscorePage(view([], 'military')).buttons).toEqual([
      { key: 'total', label: 'Gesamt', pressed: false },
      { key: 'economy', label: 'Wirtschaft', pressed: false },
      { key: 'military', label: 'Militär', pressed: true },
    ]);
  });

  it('shows the total until a category is chosen, or one that does not exist', () => {
    for (const chosen of [
      undefined,
      'resources' as HighscoreCategory,
      'fleet' as HighscoreCategory,
    ]) {
      const page = highscorePage(view([], chosen));
      expect(page.buttons.find((b) => b.pressed)?.key).toBe('total');
      expect(page.note).toBe(
        highscoreNote('total', { economy: 0, military: 0 }),
      );
    }
  });

  it('numbers the rows by the value of the category and marks the own one', () => {
    const page = highscorePage(view([], 'military'));
    expect(
      page.rows.map((r) => [r.rank, r.name, r.points, r.me, r.home]),
    ).toEqual([
      [1, 'Anna', '40', false, null],
      [2, 'Bert', '5', true, null],
      [3, 'Cleo', '0', false, null],
    ]);
    expect(page.note).toBe(
      '1 Punkt pro Schiff, Verteidigungsanlage und Rakete.',
    );
  });

  it('shows the note of the mode the round sets for each category (168a)', () => {
    const note = (cat: HighscoreCategory, e: number, m: number) =>
      highscorePage(view([], cat, 'u_Bert', round(e, m))).note;
    expect(note('economy', 1, 0)).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).',
    );
    expect(note('military', 1, 0)).toBe(
      '1 Punkt pro Schiff, Verteidigungsanlage und Rakete.',
    );
    expect(note('military', 0, 1)).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Flotte, Verteidigung, Raketen).',
    );
  });

  it('formats the points like the rest of the interface', () => {
    const rich: Players = { u_Anna: { name: 'Anna', points: 1234567 } };
    const page = highscorePage({
      s: { me: { id: 'u_x' }, players: rich, galaxy: [], round: round() },
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
  const modes = (economy: 0 | 1, military: 0 | 1) => ({ economy, military });
  it('keeps the sentence of the total in every mode', () => {
    for (const m of [modes(0, 0), modes(1, 1)])
      expect(highscoreNote('total', m)).toBe(
        '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Schiffe, Verteidigung).',
      );
  });

  it('are the owner’s notes for Wirtschaft and Militär by number and by resources (168a)', () => {
    expect(highscoreNote('economy', modes(0, 1))).toBe(
      '1 Punkt pro Gebäudestufe, Forschungsstufe und Sonnenreliquiar.',
    );
    expect(highscoreNote('economy', modes(1, 0))).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).',
    );
    expect(highscoreNote('military', modes(1, 0))).toBe(
      '1 Punkt pro Schiff, Verteidigungsanlage und Rakete.',
    );
    expect(highscoreNote('military', modes(0, 1))).toBe(
      '1 Punkt = 1.000 verbaute Rohstoffe (Flotte, Verteidigung, Raketen).',
    );
  });
});
