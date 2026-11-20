// What single blocks of the rule pages hold, block by block, on states made
// by hand: the tables of „Sichtbarkeit und Aktivität“, „Tagesbelohnung und
// Erfolge“ and „Kolonien und Planetengrenze“, the stands of the question about
// the enemy and of the guide to the first colony, and the links each page
// ends with. `pages.test.ts` guards the shapes, `pages.values.test.ts` the
// values of the rules; these tests fix what a block shows.
import { describe, expect, it } from 'vitest';
import { planet } from '../../test/fixtures.ts';
import { MOST_PLANETS } from '../colony-limit.ts';
import { PAGES } from './pages/index.ts';
import { defaultState } from './state.ts';
import type { Block, LexState, Own } from './types.ts';

const page = (id: string) => PAGES.find((p) => p.id === id)!;

/** The blocks of a section of a page for a state. */
const blocks = (id: string, section: string, s = defaultState()): Block[] =>
  page(id)
    .sections(s)
    .find((x) => x.id === section)!.blocks;

/** The table with this caption: its head, and each row's cells (and mark). */
function tableOf(id: string, caption: string, s = defaultState()) {
  const t = page(id)
    .sections(s)
    .flatMap((x) => x.blocks)
    .find((b) => b.t === 'table' && b.caption === caption);
  if (t?.t !== 'table') throw new Error(`no table ${caption}`);
  return t;
}

const cellsOf = (id: string, caption: string, s = defaultState()) =>
  tableOf(id, caption, s).rows.map((r) => r.cells);

/** The default state with other values of the round and the universe. */
const state = (
  round: Record<string, number | boolean> = {},
  u: Record<string, number> = {},
  more: Partial<LexState> = {},
): LexState => {
  const s = defaultState();
  return {
    ...s,
    round: { ...s.round, ...round },
    u: { ...s.u, ...u },
    ...more,
  };
};

const own = (over: Partial<Own> = {}): Own => ({
  planet: planet(),
  planets: 3,
  fleets: 0,
  points: { own: 1000, top: 5000 },
  now: 0,
  ...over,
});

describe('the sections and the links of the pages', () => {
  const sections = (id: string): string[][] =>
    page(id)
      .sections(defaultState())
      .map((x) => [x.id, x.title]);

  it('Kolonien und Planetengrenze', () => {
    expect(sections('rule-colonies')).toEqual([
      ['found', 'Eine Kolonie gründen'],
      ['limit', 'Die Planetengrenze'],
      ['abandon', 'Eine Kolonie aufgeben'],
      ['main', 'Der Hauptplanet'],
    ]);
    expect(page('rule-colonies').seeAlso).toEqual([
      'colony',
      'colonial',
      'mission-colonize',
      'mission-survey',
      'faq-colony',
    ]);
  });

  it('Sichtbarkeit und Aktivität', () => {
    expect(sections('rule-vision').map(([id]) => id)).toEqual([
      'fleets',
      'activity',
      'inactivity',
      'playtime',
    ]);
    expect(page('rule-vision').seeAlso).toEqual([
      'spy',
      'rule-spy',
      'faq-intel',
    ]);
  });

  it('Dieses Universum', () => {
    expect(sections('rule-universe').map(([id]) => id)).toEqual([
      'size',
      'settings',
    ]);
    expect(page('rule-universe').seeAlso).toEqual([
      'rule-flight',
      'rule-planets',
      'rule-expeditions',
      'rule-allies',
      'rule-endzeit',
      'rule-rewards',
    ]);
  });

  it('Highscore', () => {
    expect(page('rule-highscore').seeAlso).toEqual([
      'rule-protection',
      'rule-endzeit',
    ]);
  });

  it('Tagesbelohnung und Erfolge', () => {
    expect(sections('rule-rewards').map(([id]) => id)).toEqual([
      'daily',
      'achievements',
      'round',
    ]);
    expect(page('rule-rewards').seeAlso).toEqual([
      'rule-universe',
      'faq-resources',
    ]);
  });

  it('Deine erste Kolonie', () => {
    expect(sections('guide-colony').map(([id]) => id)).toEqual([
      'why',
      'steps',
    ]);
    expect(page('guide-colony').seeAlso).toEqual([
      'faq-colony',
      'rule-colonies',
      'colony',
      'mission-colonize',
    ]);
  });

  it('Wie bekomme ich mehr Informationen über den Gegner?', () => {
    expect(sections('faq-intel').map(([id]) => id)).toEqual([
      'answer',
      'steps',
      'values',
    ]);
    expect(page('faq-intel').seeAlso).toEqual([
      'rule-spy',
      'spy',
      'probe',
      'mission-spy',
      'rule-vision',
    ]);
  });
});

describe('Sichtbarkeit und Aktivität: what a foreign fleet shows', () => {
  const CAPTION = 'Was du bei einer fremden Flotte siehst';

  it('shows nothing below the first threshold, then the total, the types, the counts', () => {
    // The example fleet has 3 + 12 ships of 2 kinds.
    expect(cellsOf('rule-vision', CAPTION)).toEqual([
      [0, 'unbekannt', 'unbekannt', 'nein'],
      [2, '15', 'unbekannt', 'nein'],
      [4, '15', '2', 'nein'],
      [8, '15', '2', 'ja'],
    ]);
  });

  it('lists each level once, in ascending order, whichever the order of the thresholds', () => {
    const levels = (total: number, types: number, counts: number) =>
      cellsOf(
        'rule-vision',
        CAPTION,
        state({
          recognitionTotal: total,
          recognitionTypes: types,
          recognitionCounts: counts,
        }),
      ).map(([level]) => level);
    expect(levels(5, 2, 3)).toEqual([0, 2, 3, 5]);
    expect(levels(1, 1, 1)).toEqual([0, 1]);
    expect(levels(3, 1, 3)).toEqual([0, 1, 3]);
  });

  it('says what each part shows from its own threshold on', () => {
    const rows = cellsOf(
      'rule-vision',
      CAPTION,
      state({ recognitionTotal: 3, recognitionTypes: 1, recognitionCounts: 2 }),
    );
    expect(rows).toEqual([
      [0, 'unbekannt', 'unbekannt', 'nein'],
      [1, 'unbekannt', '2', 'nein'],
      [2, 'unbekannt', '2', 'ja'],
      [3, '15', '2', 'ja'],
    ]);
  });
});

describe('Sichtbarkeit und Aktivität: the markers of a planet and of an account', () => {
  const ACTIVITY = 'Was die Sternenkarte nach der Aktivität zeigt';
  const INACTIVITY = 'Wann ein Spieler inaktiv heißt';

  it('shows „Aktiv“ within the recent minutes, then the minutes, then nothing', () => {
    expect(cellsOf('rule-vision', ACTIVITY)).toEqual([
      [0, 'Aktiv'],
      [10, 'Aktiv'],
      [14, 'Aktiv'],
      [15, 'Aktivität vor 15 Minuten'],
      [30, 'Aktivität vor 30 Minuten'],
      [59, 'Aktivität vor 59 Minuten'],
      [60, 'keine Anzeige'],
      [90, 'keine Anzeige'],
    ]);
  });

  it('follows the thresholds of the round', () => {
    const rows = cellsOf(
      'rule-vision',
      ACTIVITY,
      state({ activityRecent: 1, activityMinutes: 30 }),
    );
    expect(rows.slice(0, 5)).toEqual([
      [0, 'Aktiv'],
      [10, 'Aktivität vor 10 Minuten'],
      [14, 'Aktivität vor 14 Minuten'],
      [15, 'Aktivität vor 15 Minuten'],
      [30, 'Aktivität vor 30 Minuten'],
    ]);
    expect(rows[5]).toEqual([59, 'keine Anzeige']);
  });

  it('shows „Inaktiv“ from the first threshold in days and „Lange inaktiv“ from the second', () => {
    expect(cellsOf('rule-vision', INACTIVITY)).toEqual([
      [0, 'keine Anzeige'],
      [6, 'keine Anzeige'],
      [7, 'Inaktiv'],
      [27, 'Inaktiv'],
      [28, 'Lange inaktiv'],
    ]);
  });

  it('lists each day once, when the thresholds lie close', () => {
    expect(
      cellsOf(
        'rule-vision',
        INACTIVITY,
        state({ inactiveDays: 1, longInactiveDays: 2 }),
      ),
    ).toEqual([
      [0, 'keine Anzeige'],
      [1, 'Inaktiv'],
      [2, 'Lange inaktiv'],
    ]);
  });
});

describe('Tagesbelohnung und Erfolge: the tables', () => {
  it('shows the reward by day of the round for the example production', () => {
    expect(
      cellsOf(
        'rule-rewards',
        'Belohnung bei einer mittleren Produktion von 6.000 Adamant, 3.000 Psikristall und 1.500 Promethium je Stunde',
      ),
    ).toEqual([
      [1, 30, 3000, 1500, 750],
      [2, 42, 4200, 2100, 1050],
      [3, 49, 4900, 2450, 1225],
      [5, 58, 5800, 2900, 1450],
      [10, 71, 7100, 3550, 1775],
      [20, 83, 8300, 4150, 2075],
      [30, 90, 9000, 4500, 2250],
      [60, 90, 9000, 4500, 2250],
    ]);
  });

  it('lists the targets of each series once, in ascending order, as German numbers', () => {
    expect(
      cellsOf('rule-rewards', 'Die Reihen der Erfolge und ihre Zielmarken'),
    ).toEqual([
      ['Gebäude', '1, 2, 3, 5, 8, 10, 12, 15, 20'],
      ['Forschung', '1, 2, 3, 5, 8, 10, 12, 15, 20'],
      ['Schiffe', '1, 5, 10, 25, 50, 100, 250, 500'],
      ['Verteidigung', '1, 5, 10, 25, 50, 100, 250, 500'],
      ['Flotten', '1, 3, 5, 10, 25, 50, 100, 250'],
      ['Schiffsschmiede', '1, 3, 5, 10, 25, 50, 100, 250'],
    ]);
  });

  it('shows the fixed rewards of the fleets and of the orders side by side', () => {
    expect(
      cellsOf(
        'rule-rewards',
        'Belohnung für gestartete Flotten und Aufträge an die Schiffsschmiede',
      ),
    ).toEqual([
      [1, '15 · 8 · 3', '12 · 6 · 2'],
      [3, '45 · 24 · 9', '36 · 18 · 6'],
      [5, '75 · 40 · 15', '60 · 30 · 10'],
      [10, '150 · 80 · 30', '120 · 60 · 20'],
      [25, '375 · 200 · 75', '300 · 150 · 50'],
      [50, '750 · 400 · 150', '600 · 300 · 100'],
      [100, '1.500 · 800 · 300', '1.200 · 600 · 200'],
      [250, '3.750 · 2.000 · 750', '3.000 · 1.500 · 500'],
    ]);
  });

  it('says yes or no for the achievements and the daily rewards of the round', () => {
    const facts = (round: Record<string, boolean>) =>
      blocks('rule-rewards', 'round', state(round)).find(
        (b) => b.t === 'facts',
      );
    expect(facts({ achievements: true, daily: true })).toEqual({
      t: 'facts',
      items: [
        { label: 'Erfolge', text: 'ja' },
        { label: 'Tagesbelohnungen', text: 'ja' },
      ],
    });
    expect(facts({ achievements: false, daily: false })).toEqual({
      t: 'facts',
      items: [
        { label: 'Erfolge', text: 'nein' },
        { label: 'Tagesbelohnungen', text: 'nein' },
      ],
    });
    expect(facts({ achievements: false, daily: true })).toMatchObject({
      items: [{ text: 'nein' }, { text: 'ja' }],
    });
  });
});

describe('Kolonien und Planetengrenze: the limit', () => {
  /** A round with a base limit and the research, as the universe stores it. */
  const limited = (
    base: number,
    perLevel: number,
    maxLevel: number,
    more = {},
  ) =>
    state(
      {},
      {
        roundColonyBase: base,
        roundColonyResearch: 1,
        roundColonyPerLevel: perLevel,
        roundColonyMaxLevel: maxLevel,
      },
      more,
    );
  const BY_LEVEL = 'Planetengrenze nach der Kolonialverwaltung';
  const limit = (s: LexState) => blocks('rule-colonies', 'limit', s);
  const facts = (s: LexState) => limit(s).find((b) => b.t === 'facts');

  it('names the base limit, and „keine Grenze“ for 0', () => {
    expect(facts(state({}, { roundColonyBase: 0 }))).toEqual({
      t: 'facts',
      items: [
        { label: 'Grundgrenze in dieser Runde', text: 'keine Grenze' },
        { label: 'Kolonialverwaltung in dieser Runde', text: 'nein' },
      ],
    });
    expect(
      facts(state({}, { roundColonyBase: 6, roundColonyResearch: 0 })),
    ).toEqual({
      t: 'facts',
      items: [
        { label: 'Grundgrenze in dieser Runde', text: '6' },
        { label: 'Kolonialverwaltung in dieser Runde', text: 'nein' },
      ],
    });
  });

  it('adds the planets per level and the highest level when the round has the research', () => {
    expect(facts(limited(6, 2, 4))).toEqual({
      t: 'facts',
      items: [
        { label: 'Grundgrenze in dieser Runde', text: '6' },
        { label: 'Kolonialverwaltung in dieser Runde', text: 'ja' },
        { label: 'Planeten je Stufe', text: '2' },
        { label: 'Höchste Stufe', text: '4' },
      ],
    });
    expect(facts(limited(6, 3, 0))).toMatchObject({
      items: [{}, {}, { text: '3' }, { text: 'unbegrenzt' }],
    });
  });

  it('has the formula and the table only with a base limit and the research', () => {
    const has = (s: LexState) => ({
      formula: limit(s).some((b) => b.t === 'formula'),
      table: limit(s).some((b) => b.t === 'table'),
    });
    expect(has(limited(6, 2, 4))).toEqual({ formula: true, table: true });
    expect(
      has(state({}, { roundColonyBase: 6, roundColonyResearch: 0 })),
    ).toEqual({ formula: false, table: false });
    expect(
      has(state({}, { roundColonyBase: 0, roundColonyResearch: 1 })),
    ).toEqual({ formula: false, table: false });
    expect(
      has(state({}, { roundColonyBase: 0, roundColonyResearch: 0 })),
    ).toEqual({ formula: false, table: false });
  });

  it('shows the limit by level, no higher than the highest level raises it', () => {
    const s = limited(6, 2, 4);
    expect(tableOf('rule-colonies', BY_LEVEL, s).head).toEqual([
      'Stufe der Kolonialverwaltung',
      'Planeten',
    ]);
    expect(cellsOf('rule-colonies', BY_LEVEL, s)).toEqual([
      [0, 6],
      [1, 8],
      [2, 10],
      [3, 12],
      [4, 14],
      [5, 14],
      [8, 14],
      [10, 14],
    ]);
  });

  it('shows the limit by level without a highest level, no higher than the most planets', () => {
    expect(cellsOf('rule-colonies', BY_LEVEL, limited(6, 2, 0))).toEqual([
      [0, 6],
      [1, 8],
      [2, 10],
      [3, 12],
      [4, 14],
      [5, 16],
      [8, MOST_PLANETS],
      [10, MOST_PLANETS],
    ]);
  });

  it('marks the row of the level the player has, and none for a level the table lacks', () => {
    const marked = (level: number) =>
      tableOf(
        'rule-colonies',
        BY_LEVEL,
        limited(6, 2, 4, { research: { colonial: level } }),
      ).rows.flatMap((r, i) => (r.mark ? [i] : []));
    expect(marked(3)).toEqual([3]);
    expect(marked(0)).toEqual([0]);
    expect(marked(10)).toEqual([7]);
    expect(marked(6)).toEqual([]);
    expect(
      tableOf('rule-colonies', BY_LEVEL, limited(6, 2, 4)).rows.flatMap(
        (r, i) => (r.mark ? [i] : []),
      ),
    ).toEqual([0]);
  });

  it('has a formula that agrees with the rule in a round with and without a highest level', () => {
    for (const s of [limited(6, 2, 4), limited(6, 2, 0), limited(18, 5, 0)]) {
      const f = limit(s).find((b) => b.t === 'formula');
      if (f?.t !== 'formula') throw new Error('no formula');
      expect(f.lines).toEqual([
        'Planetengrenze = Grundgrenze + Planeten je Stufe · Stufe der Kolonialverwaltung, höchstens 20',
      ]);
      expect(f.of).toHaveLength(1);
      const [formula] = f.of!;
      expect(formula!.samples).toEqual([[0], [1], [3], [10], [30]]);
      for (const x of formula!.samples)
        expect(formula!.fn(...x)).toBe(formula!.rule(...x));
    }
    // The formula is the rule on a level the round caps, and above 20 planets.
    const [f] = (
      limit(limited(18, 5, 0)).find((b) => b.t === 'formula') as Extract<
        Block,
        { t: 'formula' }
      >
    ).of!;
    expect(f!.fn(10)).toBe(MOST_PLANETS);
    expect(f!.fn(0)).toBe(18);
  });

  it('shows the stand of the player: planets against the limit, and the level', () => {
    const stand = (s: LexState) => limit(s).find((b) => b.t === 'stand');
    expect(
      stand(
        limited(6, 2, 4, {
          own: own({ planets: 4 }),
          research: { colonial: 3 },
        }),
      ),
    ).toEqual({
      t: 'stand',
      text: 'Dein Stand: Planeten: 4 / 12 · Kolonialverwaltung Stufe 3',
    });
    expect(stand(limited(6, 2, 4))).toBeUndefined();
    expect(
      stand(state({}, { roundColonyBase: 0 }, { own: own({ planets: 2 }) })),
    ).toEqual({ t: 'stand', text: 'Dein Stand: Planeten: 2 · unbegrenzt' });
  });
});

describe('Deine erste Kolonie: the stand', () => {
  const stand = (s: LexState) =>
    blocks('guide-colony', 'steps', s).find((b) => b.t === 'stand');

  it('shows the planets against the limit and the level of the research', () => {
    const s = state(
      {},
      {
        roundColonyBase: 6,
        roundColonyResearch: 1,
        roundColonyPerLevel: 2,
        roundColonyMaxLevel: 4,
      },
      { own: own({ planets: 5 }), research: { colonial: 2 } },
    );
    expect(stand(s)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Planeten: 5 / 10 · Kolonialverwaltung Stufe 2',
    });
  });

  it('counts a level of 0 without the research, and says „unbegrenzt“ without a limit', () => {
    expect(stand({ ...defaultState(), own: own({ planets: 1 }) })).toEqual({
      t: 'stand',
      text: 'Dein Stand: Planeten: 1 · unbegrenzt',
    });
    const limited = state(
      {},
      { roundColonyBase: 6, roundColonyResearch: 1, roundColonyPerLevel: 2 },
      { own: own({ planets: 5 }) },
    );
    expect(stand(limited)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Planeten: 5 / 6 · Kolonialverwaltung Stufe 0',
    });
  });

  it('has no stand for a player without a planet', () => {
    expect(stand(defaultState())).toBeUndefined();
  });
});

describe('Wie bekomme ich mehr Informationen über den Gegner?', () => {
  const stand = (probes: number, level: number) =>
    blocks(
      'faq-intel',
      'values',
      state({}, {}, { ships: { probe: probes }, research: { spy: level } }),
    ).find((b) => b.t === 'stand');

  it('names the parts of the report in the table, with the Auspex-Wert and the skulls they need', () => {
    expect(
      cellsOf(
        'faq-intel',
        'Spähschädel bis zum Teil des Berichts, bei gleicher Auspex-Lehre',
      ),
    ).toEqual([
      ['Flotte', 2, 2],
      ['Verteidigung', 3, 3],
      ['Gebäude', 5, 5],
      ['Forschung', 7, 7],
    ]);
  });

  it('shows in the stand the parts the skulls of the player reach', () => {
    expect(stand(0, 0)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Stufe 0 der Auspex-Lehre und 0 Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe.',
    });
    expect(stand(2, 4)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Stufe 4 der Auspex-Lehre und 2 Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe, Flotte.',
    });
    expect(stand(5, 1)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Stufe 1 der Auspex-Lehre und 5 Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe, Flotte, Verteidigung, Gebäude.',
    });
    expect(stand(1000, 12)).toEqual({
      t: 'stand',
      text: 'Dein Stand: Stufe 12 der Auspex-Lehre und 1.000 Spähschädel. Gegen ein Ziel mit gleicher Auspex-Lehre zeigt dein Bericht: Rohstoffe, Flotte, Verteidigung, Gebäude, Forschung.',
    });
  });
});
