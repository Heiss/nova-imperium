// The rules that hold for every setting of a round (#283, #310). The test
// names no feature and no count: a feature adds its settings in its own file
// (`roundSettings`), and each feature tests its own entries there.
import { describe, expect, it } from 'vitest';
import {
  ROUND_SETTINGS,
  type RoundNumber,
  type RoundSetting,
  roundFieldId,
} from './round.ts';
import { DEFAULT_UNIVERSE, liveSpecs, UNIVERSE_SPECS } from './universe.ts';

const settings: readonly RoundSetting[] = ROUND_SETTINGS;
const unique = (values: readonly unknown[]): boolean =>
  new Set(values).size === values.length;
const isLive = (s: RoundSetting): s is RoundNumber & { live: true } =>
  s.kind === 'number' && s.live === true;

describe('the registry of the round settings', () => {
  it('has unique keys, names and field ids, each named as the stored setting and the field', () => {
    expect(settings.length).toBeGreaterThan(0);
    expect(unique(settings.map((s) => s.key))).toBe(true);
    expect(unique(settings.map((s) => s.name))).toBe(true);
    expect(unique(settings.map(roundFieldId))).toBe(true);
    for (const s of settings) {
      expect(s.key).toMatch(/^round[A-Z][a-zA-Z]*$/);
      expect(s.name).toMatch(/^[a-z][a-zA-Z]*$/);
      expect(s.label.length).toBeGreaterThan(0);
      expect(roundFieldId(s)).toMatch(/^round-[a-z]+(-[a-z]+)*$/);
      expect(roundFieldId(s).replaceAll('-', '')).toBe(
        `round${s.name.toLowerCase()}`,
      );
    }
  });

  it('has unique positive whole order numbers and is sorted by them (owner, 2026-11-17)', () => {
    const orders = settings.map((s) => s.order);
    expect(orders.every((o) => Number.isInteger(o) && o > 0)).toBe(true);
    expect(unique(orders)).toBe(true);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('keeps the members of a group together under one name, one legend (or none) and one group object', () => {
    const names = [...new Set(settings.flatMap((s) => s.group?.name ?? []))];
    for (const name of names) {
      const members = settings.filter((s) => s.group?.name === name);
      expect(new Set(members.map((s) => s.group)).size, name).toBe(1);
      const first = settings.indexOf(members[0]!);
      expect(settings.slice(first, first + members.length), name).toEqual(
        members,
      );
      const legend = members[0]!.group!.legend;
      expect(legend === undefined || legend.length > 0, name).toBe(true);
    }
    // A group name is never the name of a single setting: the request would clash.
    for (const name of names)
      expect(settings.map((s) => s.name)).not.toContain(name);
  });

  it('keeps a default and every choice in the range of a number', () => {
    for (const s of settings) {
      if (s.kind !== 'number') continue;
      expect(Number.isInteger(s.min) && Number.isInteger(s.max), s.key).toBe(
        true,
      );
      expect(s.min, s.key).toBeLessThanOrEqual(s.max);
      expect(Number.isInteger(s.def), s.key).toBe(true);
      expect(s.def, s.key).toBeGreaterThanOrEqual(s.min);
      expect(s.def, s.key).toBeLessThanOrEqual(s.max);
      for (const c of s.choices ?? []) {
        expect(c.value, s.key).toBeGreaterThanOrEqual(s.min);
        expect(c.value, s.key).toBeLessThanOrEqual(s.max);
      }
    }
  });

  it('gives a switch its own refusal, and a number its own or the range wording', () => {
    for (const s of settings)
      if (s.kind === 'switch' || s.refusal !== undefined)
        expect(s.refusal?.length, s.key).toBeGreaterThan(0);
  });

  /** The value of a running round without a stored one: `unstored`, else the default (#237). */
  const unstoredOr = (s: { def: number; unstored?: number }): number =>
    s.unstored ?? s.def;

  it('makes every live entry a row of the universe settings, after the others and in the registry order (X1)', () => {
    const live = settings.filter(isLive);
    expect(liveSpecs().map((s) => s.key)).toEqual(live.map((s) => s.key));
    for (const s of live) {
      expect(
        UNIVERSE_SPECS.find((u) => u.key === s.key),
        s.key,
      ).toMatchObject({
        label: s.label,
        min: s.min,
        max: s.max,
        def: unstoredOr(s),
      });
      expect(DEFAULT_UNIVERSE[s.key as keyof typeof DEFAULT_UNIVERSE]).toBe(
        unstoredOr(s),
      );
    }
    const rows = UNIVERSE_SPECS.filter((u) => u.key.startsWith('round'));
    expect(rows).toEqual(liveSpecs());
    expect(UNIVERSE_SPECS.slice(UNIVERSE_SPECS.length - rows.length)).toEqual(
      rows,
    );
    expect(unique(UNIVERSE_SPECS.map((u) => u.key))).toBe(true);
  });

  it('makes no entry without live a row of the universe settings', () => {
    const keys = UNIVERSE_SPECS.map((u) => u.key);
    for (const s of settings.filter((x) => !isLive(x)))
      expect(keys, s.key).not.toContain(s.key);
  });
});
