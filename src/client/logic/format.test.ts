import { describe, expect, it } from 'vitest';
import {
  clampInt,
  coords,
  dt,
  dur,
  esc,
  fmt,
  resLine,
  techLine,
} from './format.ts';

describe('format', () => {
  it('formats numbers the German way, rounded down', () => {
    expect(fmt(1234567.9)).toBe('1.234.567');
    expect(fmt(null)).toBe('0');
    expect(fmt(undefined)).toBe('0');
    expect(fmt(NaN)).toBe('0');
  });
  it('escapes HTML', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(esc(null)).toBe('');
    expect(esc(5)).toBe('5');
  });
  it('writes coordinates', () => {
    expect(coords({ g: 1, s: 22, p: 3 })).toBe('[1:22:3]');
    expect(coords(null)).toBe('[?]');
  });
  it('clamps whole numbers', () => {
    expect(clampInt('7.9', 1, 10)).toBe(7);
    expect(clampInt('x', 1, 10)).toBe(1);
    expect(clampInt(99, 1, 10)).toBe(10);
    expect(clampInt(-5, 0, 10)).toBe(0);
  });
  it('writes durations without leading zero units', () => {
    expect(dur(0)).toBe('00s');
    expect(dur(-5)).toBe('00s');
    expect(dur(1)).toBe('01s');
    expect(dur(61000)).toBe('1m 01s');
    expect(dur(3600000)).toBe('1h 00m 00s');
    expect(dur(3 * 86400000 + 5000)).toBe('3T 0h 00m 05s');
    expect(dur(86400000 + 2 * 3600000 + 3 * 60000 + 4000)).toBe(
      '1T 2h 03m 04s',
    );
  });
  it('writes a short date and time', () => {
    expect(dt(Date.UTC(2026, 10, 6, 12, 5, 9))).toMatch(
      /^06\.11\., \d\d:05:09$/,
    );
  });
  it('writes resources and technology', () => {
    expect(resLine({ m: 1000, c: 2.5, d: 0 })).toBe(
      'Adamant 1.000 · Psikristall 2 · Promethium 0',
    );
    expect(techLine({ weapons: 2, armor: 1 })).toBe(
      'Waffen 20% · Schilde 0% · Panzerung 10%',
    );
  });
});
