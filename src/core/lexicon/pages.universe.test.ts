// The table of settings on „Dieses Universum“ (#288): how a value is shown
// (a named choice, yes or no, a number, a dash for none) and which settings
// are in the table of those that only a new round sets. The registry is
// extended by a setting made for the test: no real setting that only a new
// round sets has named choices.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../round.ts', async (original) => {
  const real = await original<typeof import('../round.ts')>();
  const made = {
    kind: 'number',
    key: 'roundMadeUp',
    name: 'madeUp',
    label: 'Erfundene Einstellung',
    order: 99999,
    min: 0,
    max: 5,
    def: 2,
    choices: [
      { value: 0, label: 'Aus' },
      { value: 2, label: 'Mittel' },
    ],
  };
  return { ...real, ROUND_SETTINGS: [...real.ROUND_SETTINGS, made] };
});

const { PAGES } = await import('./pages/index.ts');
const { defaultState } = await import('./state.ts');
const { UNIVERSE_SPECS } = await import('../universe.ts');

import type { LexState } from './types.ts';

const universe = PAGES.find((p) => p.id === 'rule-universe')!;

/** The rows of the table with this caption, by their first cell. */
function rows(caption: string, s: LexState): Map<string, unknown[]> {
  const t = universe
    .sections(s)
    .flatMap((x) => x.blocks)
    .find((b) => b.t === 'table' && b.caption === caption);
  if (t?.t !== 'table') throw new Error(`no table ${caption}`);
  return new Map(t.rows.map((r) => [String(r.cells[0]), r.cells]));
}

const ROUND_ONLY = 'Einstellungen, die nur eine neue Runde setzt';
const UNIVERSE = 'Einstellungen des Universums';

const withRound = (over: Record<string, number | boolean>): LexState => {
  const s = defaultState();
  return { ...s, round: { ...s.round, ...over } };
};

describe('the settings only a new round sets', () => {
  it('has the switches and the numbers that are not changed during the round, not the live ones', () => {
    const labels = [...rows(ROUND_ONLY, defaultState()).keys()];
    expect(labels).toContain('Achievements aktivieren');
    expect(labels).toContain('Erfundene Einstellung');
    expect(labels).not.toContain('Tempo (Faktor)');
    // A live setting is a row of the universe settings, not of this table.
    expect(labels).not.toContain('Kolonieforschung aktivieren');
    expect(rows(UNIVERSE, defaultState()).has('Tempo (Faktor)')).toBe(true);
  });

  it('shows a named choice by its label, a value without a name as a number', () => {
    expect(
      rows(ROUND_ONLY, withRound({ madeUp: 0 })).get('Erfundene Einstellung'),
    ).toEqual(['Erfundene Einstellung', 'Aus', 'Mittel']);
    expect(
      rows(ROUND_ONLY, withRound({ madeUp: 5 })).get('Erfundene Einstellung'),
    ).toEqual(['Erfundene Einstellung', '5', 'Mittel']);
  });

  it('shows a dash for a setting the round has no value for', () => {
    expect(
      rows(ROUND_ONLY, defaultState()).get('Erfundene Einstellung'),
    ).toEqual(['Erfundene Einstellung', '–', 'Mittel']);
  });
});

describe('the settings of the universe', () => {
  const allies = UNIVERSE_SPECS.find((s) => s.key === 'roundAllies')!;
  const row = (value: number | undefined) => {
    const s = defaultState();
    return rows(UNIVERSE, {
      ...s,
      u: { ...s.u, roundAllies: value } as never,
    }).get(allies.label);
  };

  it('names a choice, and shows a number that is none of them as it is', () => {
    expect(row(2)).toEqual([allies.label, 'Freunde', 'Gilde und Freunde']);
    expect(row(9)).toEqual([allies.label, '9', 'Gilde und Freunde']);
  });

  it('shows a dash for a setting without a value', () => {
    expect(row(undefined)).toEqual([allies.label, '–', 'Gilde und Freunde']);
  });
});
