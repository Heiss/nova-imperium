// The level overview of the lists (#187): the table of the next levels and
// the big steps with cost, time, effect and the difference to today.
import { describe, expect, it } from 'vitest';
import { BUILD, RES } from '../../core/catalog.ts';
import { lvlCost } from '../../core/economy.ts';
import { levelSteps } from '../../core/level-overview.ts';
import { text } from '../../core/text.ts';
import { levelView } from '../../test/level-view.ts';
import { levelRow } from './level-table.ts';
import { overview } from './level-overview.ts';

const view = (b = {}, research = {}) => levelView({ temp: 30, b }, research);

describe('the level overview of a building', () => {
  const v = view({ metal: 3, robot: 2, solar: 20 });
  const table = overview(v, 'metal')!;

  it('has the rows of the rule: the next 3 levels and the big steps, not the own level', () => {
    expect(table.rows.map((r) => r.level)).toEqual(levelSteps(3));
    expect(table.rows.map((r) => r.level)).toEqual([4, 5, 6, 10, 15, 20]);
    expect(table.rows.some((r) => r.current)).toBe(false);
    expect(table.rows.filter((r) => r.big).map((r) => r.level)).toEqual([10]);
    expect(table.timeLabel).toBe('Bauzeit');
  });

  it('takes cost and time from the formulas of the core, as the list does', () => {
    for (const row of table.rows) {
      expect(row.cost).toEqual(lvlCost(BUILD.metal!, row.level));
      expect(row).toMatchObject(levelRow(v, 'metal', row.level)!);
    }
  });

  it('shows what the mine makes and needs, with the difference to today', () => {
    expect(table.effects).toEqual([
      { label: 'Adamant/h bei voller Energie' },
      { label: 'Energiebedarf', cost: true },
    ]);
    const [first, second] = table.rows;
    expect(first!.values[0]).toBeGreaterThan(0);
    expect(first!.deltas[0]).toBeGreaterThan(0);
    expect(second!.deltas[0]).toBeGreaterThan(first!.deltas[0]!);
    expect(first!.deltas[1]).toBeGreaterThan(0);
    // Today is the own level: its value minus the value of the row is the difference.
    const today = overview(view({ metal: 4, solar: 20 }), 'metal')!;
    expect(today.rows[0]!.level).toBe(5);
    expect(today.rows[0]!.values[0]! - first!.values[0]!).toBeCloseTo(
      second!.deltas[0]! - first!.deltas[0]!,
      6,
    );
  });

  it('says what the numbers assume', () => {
    expect(table.notes).toEqual([
      'Bauzeiten mit deiner heutigen Servitorenschmiede und Machina-Schwarmhalle.',
      'Die Förderung setzt genug Energie voraus; fehlt sie, sinkt sie mit dem Faktor der Energie.',
    ]);
  });

  it('has no column for what is opened: it has numbers', () => {
    for (const row of table.rows) expect(row.unlocks).toBeUndefined();
  });
});

describe('the level overview of a research', () => {
  it('shows the effect of its rule from its own file (the Lexicanum part), and the research time', () => {
    const v = view({ lab: 3 }, { computer: 3 });
    const table = overview(v, 'computer')!;
    expect(table.timeLabel).toBe('Forschungszeit');
    expect(table.effects).toEqual([{ label: 'Flottenslots' }]);
    expect(table.rows.map((r) => r.level)).toEqual([4, 5, 6, 10, 15, 20]);
    expect(table.rows.map((r) => r.values[0])).toEqual([5, 6, 7, 11, 16, 21]);
    expect(table.rows.map((r) => r.deltas[0])).toEqual([1, 2, 3, 7, 12, 17]);
    expect(table.rows[0]!.cost).toEqual(lvlCost(RES.computer!, 4));
    expect(table.notes).toEqual([
      'Forschungszeiten mit deinem heutigen Scholarium und dem Sternennetz der Gelehrten.',
    ]);
  });

  it('shows a weapon bonus as a percentage and a drive bonus as one', () => {
    const v = view({ lab: 4 }, { weapons: 3, comb: 2 });
    const weapons = overview(v, 'weapons')!;
    expect(weapons.effects).toEqual([{ label: 'Angriff', format: 'percent' }]);
    expect(weapons.rows[0]!.deltas[0]).toBeCloseTo(0.1, 9);
    expect(overview(v, 'comb')!.effects).toEqual([
      { label: 'Tempo', format: 'percent' },
    ]);
  });
});

describe('the level overview of the other kinds', () => {
  it('shows the time factors of the Servitorenschmiede as factors that cost', () => {
    const table = overview(view({ robot: 1 }), 'robot')!;
    expect(table.effects).toEqual([
      { label: 'Gebäude-Bauzeit', format: 'factor', cost: true },
    ]);
    // The next level is 2: the time divided by 1 + 2, against 1 + 1 today.
    expect(table.rows[0]!.level).toBe(2);
    expect(table.rows[0]!.values[0]).toBeCloseTo(1 / 3, 9);
    expect(table.rows[0]!.deltas[0]).toBeCloseTo(1 / 3 - 1 / 2, 9);
    expect(table.notes!.at(-1)).toBe(
      '×1 ist die Zeit ohne diese Gebäudestufe.',
    );
  });

  it('shows a store’s capacity, and the fields of the Weltenschmiede', () => {
    expect(overview(view({ smetal: 1 }), 'smetal')!.effects).toEqual([
      { label: 'Lagerkapazität' },
    ]);
    const forge = overview(view({ terraformer: 2 }), 'terraformer')!;
    expect(forge.effects).toEqual([{ label: 'Zusätzliche Felder' }]);
    expect(forge.rows[0]!.deltas[0]).toBe(BUILD.terraformer!.fields!);
  });

  it('shows the Promethium use of the Fusionskraftwerk beside its energy', () => {
    const table = overview(view({ fusion: 2, deut: 10 }), 'fusion')!;
    expect(table.effects.map((e) => e.label)).toEqual([
      'Energie',
      'Promethiumverbrauch/h',
    ]);
    expect(table.notes).toHaveLength(1);
  });
});

describe('the level overview of an entry without a number', () => {
  const v = view({}, { energy: 1 });

  it('says what the levels open, since the level before', () => {
    const table = overview(v, 'energy')!;
    expect(table.effects).toEqual([]);
    expect(table.rows.map((r) => r.level)).toEqual([2, 3, 4, 5, 10, 15, 20]);
    const names = (level: number) =>
      table.rows.find((r) => r.level === level)!.unlocks!;
    // The Fusionskraftwerk needs Energietechnik 3: it opens with the rows 2 and 3.
    const fusion = text('fusion')!.n;
    expect(names(2).concat(names(3))).toContain(fusion);
    expect(names(2)).not.toContain(fusion);
    for (const row of table.rows) expect(Array.isArray(row.unlocks)).toBe(true);
  });

  it('counts what a big step skips: the row of level 10 opens all of 6 to 10', () => {
    const table = overview(view({}, { spy: 3 }), 'spy')!;
    const opening = (key: string) => {
      const need = [BUILD, RES].flatMap((t) =>
        Object.values(t).map((d) => d.req?.r?.[key] ?? 0),
      );
      return need.filter((l) => l > 6 && l <= 10).length;
    };
    const names = table.rows.find((r) => r.level === 10)!.unlocks!;
    expect(names.length).toBeGreaterThanOrEqual(opening('spy'));
  });

  it('has no column when nothing is opened on any row', () => {
    const table = overview(view({ market: 1 }), 'market')!;
    expect(table.effects).toEqual([]);
    for (const row of table.rows) expect(row.unlocks).toBeUndefined();
  });
});

describe('an entry without levels', () => {
  it('has no overview', () => {
    expect(overview(view(), 'probe')).toBeNull();
    expect(overview(view(), 'nothing')).toBeNull();
  });
});
