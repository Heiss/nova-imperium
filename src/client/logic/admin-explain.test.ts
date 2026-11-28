// The explanation of a setting as the panel shows it (#358).
import { describe, expect, it } from 'vitest';
import {
  explainedSettings,
  explainTable,
  NONE,
  OWN,
  OWN_LABEL,
} from '../../core/admin-explain.ts';
import { rangeError, ROUND_SETTINGS } from '../../core/round.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  EXPLAIN_PANEL_ID,
  explainButtonId,
  explainPage,
  openedAt,
  OWN_FIELD_ID,
} from './admin-explain.ts';
import type { GameState } from './types.ts';

const s = {
  cfg: DEFAULT_UNIVERSE,
  round: roundDefaults(),
} as unknown as Pick<GameState, 'cfg' | 'round'>;

describe('the explanation of a setting (#358)', () => {
  it('has the label, the text and the table of its registry entry', () => {
    const speed = explainedSettings().find((x) => x.key === 'speed')!;
    const page = explainPage('speed', s)!;
    expect(page.key).toBe('speed');
    expect(page.label).toBe(speed.label);
    expect(page.text).toBe(speed.explain!.text);
    const table = explainTable(speed, s.cfg, s.round)!;
    expect(page.table).toEqual({
      head: table.head,
      rows: table.rows.map((r) => r.cells.map(String)),
    });
  });

  it('has no table for a setting that has none, and is none for an unknown key', () => {
    expect(explainPage('galaxies', s)).toMatchObject({ table: null });
    expect(explainPage('roundGuilds', s)?.text).toMatch(/Gilden/);
    expect(explainPage('nope', s)).toBeNull();
  });

  it('names the panel and each „?“ apart in the tab and in the dialog', () => {
    expect(EXPLAIN_PANEL_ID).toBe('admin-explain-panel');
    expect(explainButtonId('speed', 'u')).toBe('axqu_speed');
    expect(explainButtonId('speed', 'r')).toBe('axqr_speed');
  });

  it('knows where a „?“ stands, and none for no „?“ (PR #471)', () => {
    expect(openedAt('axqu_speed', 'u')).toBe(true);
    expect(openedAt('axqu_speed', 'r')).toBe(false);
    expect(openedAt('axqr_roundGuilds', 'r')).toBe(true);
    expect(openedAt('x_axqr_roundGuilds', 'r')).toBe(false);
    expect(openedAt(null, 'u')).toBe(false);
  });
});

describe('the field „Eigener Wert“ (#358, part 2)', () => {
  it('stands under the table of a setting with a formula, with the rules of its field', () => {
    const page = explainPage('speed', s)!;
    expect(OWN_FIELD_ID).toBe('axp-own');
    expect(page.own).toEqual({
      label: OWN_LABEL,
      min: 1,
      max: 100,
      step: 1,
      error: null,
    });
    // The step of the moon's setting (#433).
    expect(explainPage('roundMoonPerPercent', s)!.own!.step).toBe(10_000);
  });

  it('is missing for a setting without a formula, without a table or without a range', () => {
    expect(explainPage('positions', s)!.own).toBeNull();
    expect(explainPage('galaxies', s)!.own).toBeNull();
    expect(explainPage('roundGuilds', s)!.own).toBeNull();
    // The limit of planets is off at the defaults: no table, no field.
    expect(explainPage('roundColonyPerLevel', s)!.own).toBeNull();
  });

  it('adds the column of a typed value of the setting, nothing for an empty field', () => {
    const plain = explainPage('speed', s)!;
    expect(explainPage('speed', s, '')).toEqual(plain);
    const typed = explainPage('speed', s, '7')!;
    expect(typed.table!.head).toEqual([...plain.table!.head, `7 (${OWN})`]);
    expect(
      typed.table!.rows.every(
        (r) => r.length === plain.table!.rows[0]!.length + 1,
      ),
    ).toBe(true);
    expect(typed.own!.error).toBeNull();
  });

  it('refuses a value outside the range with the words of the server, and adds no column', () => {
    const plain = explainPage('speed', s)!;
    const wrong = explainPage('speed', s, '0')!;
    const speed = explainedSettings().find((x) => x.key === 'speed')!;
    expect(wrong.own!.error).toBe(rangeError(speed as never));
    expect(wrong.table).toEqual(plain.table);
  });

  it('shows none and the refusal of a rule between settings', () => {
    const on = {
      ...s,
      cfg: { ...s.cfg, roundColonyBase: 5, roundColonyResearch: 1 },
    } as typeof s;
    const page = explainPage('roundColonyBase', on, '0')!;
    expect(page.table!.rows.map((r) => r.at(-1))).toEqual(
      page.table!.rows.map(() => NONE),
    );
    expect(page.own!.error).toBe(
      ROUND_SETTINGS.find((r) => r.key === 'roundColonyResearch')!.refusal,
    );
  });
});
