import { describe, expect, it } from 'vitest';
import { levelChoices, levelsRow } from './level-mode.ts';

describe('the ▤ of an entry per mode of „Stufenübersicht“ (#187 D4, D5)', () => {
  it('„Als ▤-Symbol“: a button that unfolds the table', () => {
    expect(levelsRow('metal', 'Adamant-Tiefbohrung', 'icon', {})).toEqual({
      key: 'metal',
      button: 'lvq_metal',
      panel: 'lv_metal',
      name: 'Adamant-Tiefbohrung',
      open: false,
      show: false,
    });
    expect(
      levelsRow('metal', 'Adamant-Tiefbohrung', 'icon', { metal: true }),
    ).toMatchObject({ open: true, show: true });
    expect(
      levelsRow('metal', 'Adamant-Tiefbohrung', 'icon', { crystal: true }),
    ).toMatchObject({ open: false, show: false });
  });

  it('„Immer anzeigen“: the table is there and there is no button', () => {
    expect(levelsRow('metal', 'A', 'always', {})).toMatchObject({
      button: null,
      open: false,
      show: true,
    });
    expect(levelsRow('metal', 'A', 'always', { metal: true })).toMatchObject({
      button: null,
      show: true,
    });
  });

  it('„Ausblenden“: nothing, whatever was unfolded', () => {
    expect(levelsRow('metal', 'A', 'hidden', { metal: true })).toBeNull();
  });

  it('is the ▤ for a missing or unknown mode, and for nothing unfolded yet (D5)', () => {
    for (const mode of [undefined, null, '', 'never', 3])
      expect(levelsRow('metal', 'A', mode, undefined)).toMatchObject({
        button: 'lvq_metal',
        show: false,
      });
  });
});

describe('the choices of the option „Stufenübersicht“', () => {
  const selected = (mode: unknown): string[] =>
    levelChoices(mode)
      .filter((c) => c.selected)
      .map((c) => c.value);

  it('list the three modes with the current one selected', () => {
    expect(levelChoices('icon')).toEqual([
      { value: 'always', label: 'Immer anzeigen', selected: false },
      { value: 'icon', label: 'Als ▤-Symbol', selected: true },
      { value: 'hidden', label: 'Ausblenden', selected: false },
    ]);
    expect(selected('hidden')).toEqual(['hidden']);
    expect(selected('always')).toEqual(['always']);
  });

  it('select the ▤ for a missing mode', () => {
    expect(selected(undefined)).toEqual(['icon']);
  });
});
