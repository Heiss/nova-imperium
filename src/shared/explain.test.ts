import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import {
  DEFAULT_EXPLAIN,
  EXPLAIN_MODES,
  isExplainMode,
  longText,
} from './explain.ts';

describe('explanation display modes (issue #63)', () => {
  it('are always, the (?) icon and hidden; the icon is the default (D2)', () => {
    expect(EXPLAIN_MODES).toEqual(['always', 'icon', 'hidden']);
    expect(DEFAULT_EXPLAIN).toBe('icon');
  });

  it('accept only the three modes', () => {
    for (const mode of EXPLAIN_MODES) expect(isExplainMode(mode)).toBe(true);
    for (const bad of ['', 'ICON', 'never', 'toString', 1, null, undefined])
      expect(isExplainMode(bad)).toBe(false);
  });
});

describe('long text of a catalog entry', () => {
  it('is the long text when an entry has one', () => {
    expect(longText({ lt: 'Lang.', ds: 'Kurz.' })).toBe('Lang.');
  });

  it('falls back to the short ds until the texts of #94 arrive (D4)', () => {
    expect(longText({ ds: 'Kurz.' })).toBe('Kurz.');
    expect(longText({ lt: '', ds: 'Kurz.' })).toBe('Kurz.');
    expect(longText(BUILD.metal!)).toBe(BUILD.metal!.ds);
    expect(longText(RES.spy!)).toBe(RES.spy!.ds);
  });

  it('is missing for an entry without any text', () => {
    expect(longText({})).toBeNull();
    expect(longText({ ds: '' })).toBeNull();
    expect(longText(SHIPS.probe!)).toBeNull();
    expect(longText(DEF.rl!)).toBeNull();
  });
});
