// The groups of settings in the admin panel (#357): open at the start, folded
// and unfolded by the admin, and unfolded with the fields marked when a value
// in them fails its check.
import { afterEach, describe, expect, it } from 'vitest';
import { type RoundRules, roundRequest } from '../../core/round.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  forgetGroups,
  isInvalid,
  isOpen,
  roundWrong,
  setOpen,
  showInvalid,
  universeWrong,
} from './admin-groups.svelte.ts';

afterEach(forgetGroups);

describe('the groups of settings in the admin panel (#357)', () => {
  it('are open at the start, in both places', () => {
    expect(isOpen('round', 'Marktplatz')).toBe(true);
    expect(isOpen('universe', 'Universum')).toBe(true);
  });

  it('fold and unfold one group of one place only', () => {
    setOpen('universe', 'Marktplatz', false);
    expect(isOpen('universe', 'Marktplatz')).toBe(false);
    expect(isOpen('round', 'Marktplatz')).toBe(true);
    expect(isOpen('universe', 'Urlaubsmodus')).toBe(true);
    setOpen('universe', 'Marktplatz', true);
    expect(isOpen('universe', 'Marktplatz')).toBe(true);
  });

  it('are all open and unmarked again after forgetGroups', () => {
    setOpen('round', 'Marktplatz', false);
    showInvalid('round', [{ heading: 'Marktplatz', id: 'round-market-fee' }]);
    setOpen('round', 'Marktplatz', false);
    forgetGroups();
    expect(isOpen('round', 'Marktplatz')).toBe(true);
    expect(isInvalid('round-market-fee')).toBe(false);
    expect(isInvalid('Stryker was here')).toBe(false);
  });

  it('unfold the group of a value that fails its check and mark its field, until the next check', () => {
    setOpen('round', 'Marktplatz', false);
    setOpen('round', 'Urlaubsmodus', false);
    showInvalid('round', [{ heading: 'Marktplatz', id: 'round-market-fee' }]);
    expect(isOpen('round', 'Marktplatz')).toBe(true);
    expect(isOpen('round', 'Urlaubsmodus')).toBe(false);
    expect(isInvalid('round-market-fee')).toBe(true);
    expect(isInvalid('round-market-on')).toBe(false);
    showInvalid('round', []);
    expect(isInvalid('round-market-fee')).toBe(false);
    // A value without a heading of its group marks only its field.
    showInvalid('round', [{ heading: null, id: 'round-x' }]);
    expect(isInvalid('round-x')).toBe(true);
  });
});

describe('the values that fail their check, with the heading of their group (#357)', () => {
  const round = { number: 1, ...roundDefaults() } as unknown as RoundRules;
  const values = (over: Record<string, number | boolean> = {}) =>
    roundRequest({ ...roundDefaults(), ...over });

  it('none in „Neue Runde“ while every value holds', () => {
    expect(roundWrong(round, values())).toEqual([]);
  });

  it('in „Neue Runde“: the field and the heading of its feature, as the server refuses it', () => {
    expect(roundWrong(round, values({ marketFee: -1 }))).toEqual([
      { heading: 'Marktplatz', id: 'round-market-fee' },
    ]);
    expect(roundWrong(round, values({ vacationHours: Number.NaN }))).toEqual([
      { heading: 'Urlaubsmodus', id: 'round-vacation-hours' },
    ]);
  });

  const universe = (over: Record<string, string> = {}) =>
    Object.fromEntries(
      Object.entries({ ...DEFAULT_UNIVERSE, ...over }).map(([k, v]) => [
        k,
        String(v),
      ]),
    );

  it('none in „Universum“ while every value holds', () => {
    expect(universeWrong(universe())).toEqual([]);
  });

  it('in „Universum“: only the settings the tab sends are checked', () => {
    expect(universeWrong({ speed: '5' })).toEqual([]);
    expect(universeWrong({ speed: '0' })).toEqual([
      { heading: 'Universum', id: 'set_speed' },
    ]);
  });

  it('in „Universum“: the field and its heading, a base value under „Universum“', () => {
    expect(universeWrong(universe({ speed: '0' }))).toEqual([
      { heading: 'Universum', id: 'set_speed' },
    ]);
    expect(universeWrong(universe({ roundVacationHours: '' }))).toEqual([
      { heading: 'Urlaubsmodus', id: 'set_roundVacationHours' },
    ]);
  });
});
