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

  it('is none for a setting without rows or without a range', () => {
    expect(explainTable(byKey('galaxies'), u, round)).toBeNull();
    expect(explainTable(byKey('roundGuilds'), u, round)).toBeNull();
    expect(
      explainTable({ ...byKey('speed'), min: undefined }, u, round),
    ).toBeNull();
  });
});
