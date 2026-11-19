import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import {
  DEFAULT_LEVEL_MODE,
  isLevelMode,
  LEVEL_MODES,
  levelMode,
  levelSteps,
  opened,
} from './level-overview.ts';

describe('the modes of the option „Stufenübersicht“ (#187 D4, D5)', () => {
  it('are always, icon and hidden; the icon is the default', () => {
    expect(LEVEL_MODES).toEqual(['always', 'icon', 'hidden']);
    expect(DEFAULT_LEVEL_MODE).toBe('icon');
  });

  it('accept only these three', () => {
    for (const mode of LEVEL_MODES) expect(isLevelMode(mode)).toBe(true);
    for (const bad of ['', 'ICON', 'never', 'toString', 1, null, undefined])
      expect(isLevelMode(bad)).toBe(false);
  });

  it('read anything else as the default', () => {
    for (const mode of LEVEL_MODES) expect(levelMode(mode)).toBe(mode);
    for (const bad of ['', 'ICON', 'toString', 7, null, undefined])
      expect(levelMode(bad)).toBe('icon');
  });
});

describe('levelSteps: the rows of the table (#187 D1)', () => {
  it.each([
    [0, [1, 2, 3, 5, 10, 15, 20]],
    [3, [4, 5, 6, 10, 15, 20]],
    [16, [17, 18, 19, 20]],
    [17, [18, 19, 20, 25]],
    [19, [20, 21, 22, 25]],
    [20, [21, 22, 23, 25]],
    [21, [22, 23, 24, 25]],
    [22, [23, 24, 25, 30]],
    [47, [48, 49, 50, 55]],
  ])('level %i → %j', (level, steps) => {
    expect(levelSteps(level)).toEqual(steps);
  });

  it('starts with the next 3 levels and ends with a multiple of 5', () => {
    for (let level = 0; level < 120; level++) {
      const steps = levelSteps(level);
      expect(steps.slice(0, 3)).toEqual([level + 1, level + 2, level + 3]);
      expect(steps.at(-1)! % 5).toBe(0);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      expect(new Set(steps).size).toBe(steps.length);
    }
  });
});

describe('opened: what a level opens (#187)', () => {
  it('lists the entries whose requirement lies on the levels above `from` up to `to`', () => {
    // The Kogitator-Doktrin needs a Scholarium of level 1, the Waffensegnung of level 4.
    expect(RES.computer!.req.b).toEqual({ lab: 1 });
    expect(RES.weapons!.req.b).toEqual({ lab: 4 });
    expect(opened('lab', 0, 1)).toContain('computer');
    expect(opened('lab', 0, 1)).not.toContain('weapons');
    expect(opened('lab', 1, 4)).toContain('weapons');
    expect(opened('lab', 1, 4)).not.toContain('computer');
    expect(opened('lab', 3, 3)).toEqual([]);
    expect(opened('lab', 4, 99)).not.toContain('weapons');
  });

  it('reads the buildings for a building and the research for a research', () => {
    const fusion = BUILD.fusion!.req!;
    expect(
      opened('energy', fusion.r!.energy! - 1, fusion.r!.energy!),
    ).toContain('fusion');
    expect(opened('deut', fusion.b!.deut! - 1, fusion.b!.deut!)).toContain(
      'fusion',
    );
    // The key of a research is no building: its requirement is not read as one.
    expect(opened('energy', 0, 99)).not.toContain('energy');
  });

  it('gives each entry once, in the order of the catalog, over all levels', () => {
    for (const key of [...Object.keys(BUILD), ...Object.keys(RES)]) {
      const all = opened(key, 0, Infinity);
      expect(new Set(all).size).toBe(all.length);
      const side = Object.hasOwn(BUILD, key) ? 'b' : 'r';
      const needing = [BUILD, RES, SHIPS, DEF].flatMap((table) =>
        Object.entries(table)
          .filter(([, d]) => (d.req?.[side]?.[key] ?? 0) > 0)
          .map(([k]) => k),
      );
      expect(all).toEqual(needing);
    }
  });

  it('splits at every level: each entry is opened up to it or after it, never twice', () => {
    for (const key of Object.keys(BUILD))
      for (const mid of [0, 1, 3, 7])
        expect(
          [...opened(key, 0, mid), ...opened(key, mid, Infinity)].sort(),
        ).toEqual(opened(key, 0, Infinity).sort());
  });

  it('opens nothing for an unknown key or an inherited name', () => {
    for (const key of ['', 'nothing', 'toString', 'constructor', '__proto__'])
      expect(opened(key, 0, Infinity)).toEqual([]);
  });
});
