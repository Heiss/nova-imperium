// The keyed lists of the fleet page draw each key once (#362): a key twice
// makes Svelte throw `each_key_duplicate` and the view does not finish
// drawing. The „Schnellwahl“ is tested in fleet-quick.test.ts, the fleets in
// flight on the server (state.test.ts); here are the lists whose keys come
// from constants and the catalog.
import { describe, expect, it } from 'vitest';
import { HOLD_HOURS } from '../../core/holding.ts';
import { FLEET_MISSIONS } from '../../core/missions.ts';
import { CARGO_FIELDS, SPEEDS } from './fleet.ts';
import { missionChoices } from './fleet-target.ts';

const unique = (keys: readonly unknown[]): boolean =>
  new Set(keys).size === keys.length;

describe('the keys of the lists of the fleet page (#362)', () => {
  it('are unique in the lists of the form that come from constants', () => {
    expect(unique(HOLD_HOURS)).toBe(true);
    expect(unique(SPEEDS.map((s) => s.value))).toBe(true);
    expect(unique(CARGO_FIELDS.map((f) => f.key))).toBe(true);
  });

  it('are unique among the missions, whatever fits', () => {
    expect(unique(FLEET_MISSIONS)).toBe(true);
    const { options } = missionChoices(FLEET_MISSIONS, null);
    expect(unique(options.map((o) => o.value))).toBe(true);
  });
});
