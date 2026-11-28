// The explanations of the admin panel (#358): every setting has one, beside
// its registry entry; a table shows the minimum, two values in between, the
// maximum and the current value, each cell computed with src/core.
import { describe, expect, it } from 'vitest';
import {
  cellText,
  columnValues,
  explainedSettings,
  explainTable,
  NONE,
  NOW,
  valueLabel,
  type Explained,
} from './admin-explain.ts';
import { BUILD } from './catalog.ts';
import { buildTime, lvlCost } from './economy.ts';
import { duration, nameOf } from './lexicon/say.ts';
import {
  ROUND_SETTINGS,
  storedValues,
  type RoundRules,
  type RoundSetting,
} from './round.ts';
import type { Universe } from './types.ts';
import {
  DEFAULT_UNIVERSE,
  UNIVERSE_SPECS,
  type UniverseSpec,
} from './universe.ts';

const u = DEFAULT_UNIVERSE;
const round = {
  number: 1,
  ...storedValues((k) => (u as unknown as Record<string, number>)[k]),
} as RoundRules;
const ALL = explainedSettings();
const byKey = (key: string): Explained => ALL.find((s) => s.key === key)!;
const OFF_AT_DEFAULTS = [
  'roundColonyResearch',
  'roundColonyPerLevel',
  'roundColonyMaxLevel',
];

describe('every setting of the admin panel (#358)', () => {
  it('is listed once: the rows of „Universum“ and the switches of „Neue Runde“', () => {
    const keys = ALL.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      ...UNIVERSE_SPECS.map((s) => s.key),
      ...ROUND_SETTINGS.filter(
        (s) => !UNIVERSE_SPECS.some((x) => x.key === s.key),
      ).map((s) => s.key),
    ]);
    expect(keys).toEqual(expect.arrayContaining(['roundGuilds', 'speed']));
  });

  it('has an explanation in words, without a typed number (the tables give them)', () => {
    for (const s of ALL) {
      expect(s.explain?.text.length, s.key).toBeGreaterThan(40);
      expect(s.explain!.text, s.key).not.toMatch(/\d/);
      expect(s.explain!.text, s.key).toMatch(/[.!]$/);
    }
  });

  it('brings a new setting without an explanation into the list, so the test above fails for it', () => {
    const spec: UniverseSpec = {
      key: 'speed',
      label: 'X',
      min: 1,
      max: 2,
      def: 1,
    };
    const extra = {
      kind: 'switch',
      key: 'roundNew',
      name: 'neu',
      label: 'Neu',
      order: 1,
      def: true,
      refusal: 'r',
    } as const satisfies RoundSetting;
    const listed = explainedSettings([spec], [extra]);
    expect(listed).toEqual([
      { key: 'speed', label: 'X', min: 1, max: 2 },
      { key: 'roundNew', label: 'Neu', name: 'neu' },
    ]);
  });

  it('builds every table: a row per entry, a cell per value and one for the current value', () => {
    for (const s of ALL) {
      const t = explainTable(s, u, round);
      if (!s.explain?.rows) {
        expect(t, s.key).toBeNull();
        continue;
      }
      // The limit of planets is off at the defaults: those tables say nothing.
      if (!t) {
        expect(OFF_AT_DEFAULTS, s.key).toContain(s.key);
        continue;
      }
      const values = columnValues(s.min!, s.max!);
      expect(t!.head, s.key).toHaveLength(values.length + 2);
      expect(t!.head[0]).toBe(s.label);
      expect(t!.head.at(-1)!.endsWith(` (${NOW})`), s.key).toBe(true);
      expect(t!.rows, s.key).toHaveLength(s.explain.rows.length);
      for (const row of t!.rows) {
        expect(row.cells, s.key).toHaveLength(values.length + 2);
        for (const cell of row.cells)
          expect(String(cell).length, s.key).toBeGreaterThan(0);
      }
    }
  });
});

describe('the columns of a table (owner E3)', () => {
  it('are the minimum, a third and two thirds of the range, and the maximum, each once', () => {
    expect(columnValues(1, 100)).toEqual([1, 34, 67, 100]);
    expect(columnValues(0, 1)).toEqual([0, 1]);
    expect(columnValues(-100, 100)).toEqual([-100, -33, 33, 100]);
    expect(columnValues(5, 5)).toEqual([5]);
  });

  it('name a value by its choice where the setting has choices', () => {
    const s = byKey('roundAllies');
    expect(valueLabel(s, 1)).toBe(s.choices!.find((c) => c.value === 1)!.label);
    expect(valueLabel(byKey('speed'), 12345)).toBe('12.345');
  });

  it('write a cell: a number in German, a duration, a word, none', () => {
    expect(cellText(12345)).toBe('12.345');
    expect(cellText({ ms: 65_000 })).toBe(duration(65_000));
    expect(cellText('aktiv')).toBe('aktiv');
    expect(cellText(null)).toBe(NONE);
  });
});

describe('a table computes each cell with src/core at its value', () => {
  it('shows the build time of the mine at every speed and at the current one', () => {
    const t = explainTable(byKey('speed'), u, round)!;
    const at = (speed: number) =>
      duration(
        buildTime(lvlCost(BUILD.metal!, 10), { b: {} }, { ...u, speed }),
      );
    expect(t.head).toEqual([
      'Tempo (Faktor)',
      '1',
      '34',
      '67',
      '100',
      `${u.speed} (jetzt)`,
    ]);
    expect(t.rows[0]!.cells).toEqual([
      `${nameOf('metal')} Stufe 10: Bauzeit`,
      at(1),
      at(34),
      at(67),
      at(100),
      at(u.speed),
    ]);
  });

  it('takes the current value from the universe, and a value of the round by its name', () => {
    const fast = { ...u, speed: 7 } as Universe;
    expect(explainTable(byKey('speed'), fast, round)!.head.at(-1)).toBe(
      '7 (jetzt)',
    );
    const off = { ...round, holdOn: 0 } as RoundRules;
    const held = explainTable(
      byKey('roundHeldSpy'),
      { ...u, roundHeldSpy: 5 } as Universe,
      off,
    )!;
    expect(held.head.at(-1)).toBe('5 (jetzt)');
    // The level of the spy against the setting at each column.
    expect(held.rows.map((r) => r.cells[1])).toEqual(
      held.rows.map(() => 'getrennt'),
    );
    expect(held.rows[0]!.cells.at(-1)).toBe('in der Flotte');
  });

  it('reads a switch of the round as 1 or 0 for its cells', () => {
    const s = { ...byKey('roundMarketFee') };
    const t = explainTable(s, u, { ...round, guilds: true } as RoundRules)!;
    expect(t.rows).toHaveLength(6);
  });

  it('takes a value only the round has by its name, a switch as 1 or 0', () => {
    const rows = [
      {
        label: () => 'Wert',
        cell: ({ round: r }: { round: Readonly<Record<string, number>> }) =>
          r.only!,
      },
    ];
    const only: Explained = {
      key: 'roundOnly',
      label: 'Nur in der Runde',
      name: 'only',
      min: 0,
      max: 3,
      explain: { text: 'x', rows },
    };
    const at = (value: number | boolean) =>
      explainTable(only, u, { ...round, only: value } as never)!;
    expect(at(2).head.at(-1)).toBe('2 (jetzt)');
    expect(at(true).head.at(-1)).toBe('1 (jetzt)');
    expect(at(false).head.at(-1)).toBe('0 (jetzt)');
    // Each column has the setting at its value, in the round too.
    expect(at(2).rows[0]!.cells).toEqual(['Wert', '0', '1', '2', '3', '2']);
    // Neither in the universe nor in the round: the current value is 0.
    const unnamed: Explained = {
      ...only,
      name: undefined,
      explain: {
        text: 'x',
        rows: [
          {
            label: () => 'Wert',
            cell: ({ u: at }) =>
              (at as unknown as Record<string, number>).roundOnly!,
          },
        ],
      },
    };
    expect(explainTable(unnamed, u, round)!.head.at(-1)).toBe('0 (jetzt)');
  });

  it('names a value without its choice by its number, and the table by its kind', () => {
    const s = byKey('roundAllies');
    const last = s.choices!.at(-1)!;
    expect(valueLabel(s, last.value)).toBe(last.label);
    expect(valueLabel(s, 99)).toBe('99');
    expect(explainTable(byKey('speed'), u, round)!.t).toBe('table');
  });

  it('is none for a setting without rows or without a range', () => {
    expect(
      explainTable({ ...byKey('speed'), explain: undefined }, u, round),
    ).toBeNull();
    expect(
      explainTable({ ...byKey('speed'), max: undefined }, u, round),
    ).toBeNull();
    expect(explainTable(byKey('galaxies'), u, round)).toBeNull();
    expect(explainTable(byKey('roundGuilds'), u, round)).toBeNull();
    expect(
      explainTable({ ...byKey('speed'), min: undefined }, u, round),
    ).toBeNull();
  });
});

describe('a table and the rules between settings (PR #471)', () => {
  const on = (base: number) =>
    ({
      ...u,
      roundColonyBase: base,
      roundColonyResearch: 1,
    }) as unknown as Universe;

  it('shows no values in a column the rules refuse: no research without a base', () => {
    const t = explainTable(byKey('roundColonyBase'), on(5), round)!;
    expect(t.head.slice(1, 3)).toEqual(['0', '7']);
    // Base 0 with the research on is refused (`agrees`).
    expect(t.rows.map((r) => r.cells[1])).toEqual(t.rows.map(() => NONE));
    expect(t.rows.map((r) => r.cells[2])).not.toContain(NONE);
    expect(t.head.at(-1)).toBe('5 (jetzt)');
  });

  it('leaves out a table whose other cells are all the same, and shows it once the limit is on', () => {
    expect(explainTable(byKey('roundColonyPerLevel'), u, round)).toBeNull();
    const t = explainTable(byKey('roundColonyPerLevel'), on(5), round)!;
    expect(
      new Set(t.rows.flatMap((r) => r.cells.slice(1))).size,
    ).toBeGreaterThan(1);
    const research = explainTable(byKey('roundColonyResearch'), on(5), round)!;
    expect(research.head).toEqual([
      'Kolonieforschung aktivieren',
      'Nein',
      'Ja',
      'Ja (jetzt)',
    ]);
    expect(research.rows.flatMap((r) => r.cells)).not.toContain(NONE);
  });

  it('asks every rule of the given settings, and a table of one value is left out', () => {
    const only: Explained = {
      key: 'roundOnly',
      label: 'Nur',
      name: 'only',
      min: 0,
      max: 2,
      explain: {
        text: 'x',
        rows: [{ label: () => 'Wert', cell: ({ round: r }) => r.only! }],
      },
    };
    const never = {
      kind: 'number',
      key: 'roundOnly',
      name: 'only',
      label: 'Nur',
      order: 1,
      min: 0,
      max: 2,
      def: 0,
      agrees: (value: number) => value !== 1,
    } as const satisfies RoundSetting;
    const t = explainTable(only, u, round, [never])!;
    expect(t.rows[0]!.cells).toEqual(['Wert', '0', NONE, '2', '0']);
    expect(explainTable({ ...only, max: 0 }, u, round, [never])).toBeNull();
  });
});

describe('the tables of every setting at the defaults (#358)', () => {
  it('are as written down, cell by cell, for the owner to read', async () => {
    const text = ALL.flatMap((s) => {
      const t = explainTable(s, u, round);
      if (!t) return [];
      return [
        `## ${s.key}`,
        t.head.join(' | '),
        ...t.rows.map((r) => r.cells.join(' | ')),
        '',
      ];
    }).join('\n');
    await expect(text).toMatchFileSnapshot('admin-explain.tables.txt');
  });
});
