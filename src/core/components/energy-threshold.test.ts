// Contract of the component `energyThreshold` (okf/architecture/patterns.md,
// section 12; #114): it runs for every entry that has it, so a new entry with
// an energy threshold is checked without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import { planet, U } from '../../test/fixtures.ts';
import { production } from '../economy.ts';
import {
  type EnergyThreshold,
  energyNeed,
  energyShort,
} from './energy-threshold.ts';

const THRESHOLDS = ENTRIES.flatMap(([key, e]) =>
  'energyThreshold' in e
    ? [[key, e.energyThreshold as EnergyThreshold] as const]
    : [],
);

describe('energyThreshold: contract for every entry that has it', () => {
  it('is only on entries with levels, buildings and research', () => {
    expect(THRESHOLDS.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES)
      if ('energyThreshold' in e)
        expect(['building', 'research'], key).toContain(e.kind);
  });

  it.each(THRESHOLDS)(
    '%s: needs a base above 0 and a factor of at least 1',
    (_, t) => {
      expect(t.base).toBeGreaterThan(0);
      expect(t.f).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(THRESHOLDS)(
    '%s: the need is finite and never falls for levels 1 to 60',
    (_, t) => {
      let last = 0;
      for (let level = 1; level <= 60; level++) {
        const need = energyNeed({ energy: t }, level);
        expect(Number.isFinite(need), `level ${level}`).toBe(true);
        expect(need, `level ${level}`).toBeGreaterThanOrEqual(last);
        last = need;
      }
    },
  );
});

describe('energyThreshold: the rule', () => {
  const t: EnergyThreshold = { base: 1000, f: 2 };
  const solar = (level: number) => planet({ b: { solar: level } });

  it('needs base at level 1, times f for each further level', () => {
    expect(energyNeed({ energy: t }, 1)).toBe(1000);
    expect(energyNeed({ energy: t }, 2)).toBe(2000);
    expect(energyNeed({ energy: t }, 5)).toBe(16000);
    expect(energyNeed({ energy: { base: 300000, f: 3 } }, 3)).toBe(2700000);
  });

  it('needs nothing without a threshold', () => {
    expect(energyNeed({}, 1)).toBe(0);
    expect(energyNeed({}, 12)).toBe(0);
    expect(energyShort({}, 3, planet(), U)).toBe(0);
  });

  it('lacks the need minus the production, rounded up', () => {
    // Solarkraftwerk 10 makes 518.75, 12 makes 753.22.
    expect(production(solar(10), U).eProd).toBeCloseTo(518.748, 3);
    expect(energyShort({ energy: t }, 1, solar(10), U)).toBe(482);
    expect(energyShort({ energy: t }, 1, solar(12), U)).toBe(247);
    expect(energyShort({ energy: t }, 2, solar(12), U)).toBe(1247);
  });

  it('lacks nothing when the production is enough', () => {
    expect(energyShort({ energy: t }, 1, solar(14), U)).toBe(0);
    expect(energyShort({ energy: t }, 2, solar(14), U)).toBeGreaterThan(0);
  });

  it('counts the Fusionskraftwerk with Energietechnik from the research levels', () => {
    const p = planet({ b: { fusion: 5 }, res: { m: 0, c: 0, d: 1e6 } });
    const small: EnergyThreshold = { base: 200, f: 2 };
    expect(energyShort({ energy: small }, 1, p, U)).toBe(9);
    expect(energyShort({ energy: small }, 1, p, U, { energy: 3 })).toBe(0);
  });
});
