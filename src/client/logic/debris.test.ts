// Trümmerfelder in the interface (#45, owner, 2026-11-13).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  debrisAt,
  debrisLine,
  debrisMark,
  debrisTip,
  harvestButton,
} from './debris.ts';

const FIELDS = [
  { id: 'd1_2_6', g: 1, s: 2, p: 6, m: 1800, c: 600.5 },
  { id: 'd1_3_6', g: 1, s: 3, p: 6, m: 12345.9, c: 0 },
];

describe('Trümmerfelder in the interface', () => {
  it('finds the field at a position', () => {
    expect(debrisAt(FIELDS, { g: 1, s: 2, p: 6 })).toBe(FIELDS[0]);
    expect(debrisAt(FIELDS, { g: 1, s: 3, p: 6 })).toBe(FIELDS[1]);
    for (const c of [
      { g: 2, s: 2, p: 6 },
      { g: 1, s: 4, p: 6 },
      { g: 1, s: 2, p: 7 },
    ])
      expect(debrisAt(FIELDS, c)).toBeUndefined();
    expect(debrisAt([], { g: 1, s: 2, p: 6 })).toBeUndefined();
    // A state of a server from before #45 has no list.
    expect(debrisAt(undefined, { g: 1, s: 2, p: 6 })).toBeUndefined();
  });

  it('says what lies there in the tooltip', () => {
    expect(debrisTip(FIELDS[0]!)).toBe(
      'Trümmerfeld: 1.800 Adamant, 600 Psikristall',
    );
    expect(debrisTip(FIELDS[1]!)).toBe(
      'Trümmerfeld: 12.345 Adamant, 0 Psikristall',
    );
  });

  it('shows a symbol with the tooltip as its title and text', () => {
    const tip = 'Trümmerfeld: 1.800 Adamant, 600 Psikristall';
    expect(debrisMark(FIELDS[0]!)).toBe(
      `<img class="debris" src="/icons/debris.svg" alt="${tip}" title="${tip}" width="20" height="20">`,
    );
    const file = path.resolve(
      import.meta.dirname,
      '../static/icons/debris.svg',
    );
    expect(existsSync(file)).toBe(true);
  });

  it('offers the button „Bergung“ to the position', () => {
    expect(harvestButton({ g: 1, s: 2, p: 6 })).toBe(
      '<button class="small" data-act="gfleet" data-m="harvest" data-g="1" data-s="2" data-p="6">Bergung</button>',
    );
  });

  it('says in the battle report that a field formed, and nothing without one', () => {
    expect(debrisLine({ m: 1800, c: 600.5 })).toBe(
      'Es entstand ein Trümmerfeld mit 1.800 Adamant und 600 Psikristall.',
    );
    expect(debrisLine({ m: 0, c: 300 })).toBe(
      'Es entstand ein Trümmerfeld mit 0 Adamant und 300 Psikristall.',
    );
    expect(debrisLine({ m: 0, c: 0 })).toBe('');
    // A battle report from before #45 has no debris.
    expect(debrisLine(undefined)).toBe('');
  });
});
