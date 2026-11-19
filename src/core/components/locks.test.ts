// Contract of the component `locks` (okf/architecture/patterns.md, section
// 12; #183): it runs for every entry that has it, so a new building that
// stops the shipyard or the research is checked without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import { homeOf, type Lock, type Locks, stoppers, stops } from './locks.ts';

const LOCKS = ENTRIES.flatMap(([key, e]) =>
  'locks' in e ? [[key, e.locks as Locks] as const] : [],
);
const TABLE: Readonly<Record<string, Locks>> = Object.fromEntries(LOCKS);

const KINDS: readonly Lock[] = ['shipyard', 'research'];

describe('locks: contract for every entry that has it', () => {
  it('is only on buildings, the entries that are upgraded', () => {
    expect(LOCKS.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES)
      if ('locks' in e) expect(e.kind, key).toBe('building');
  });

  it.each(LOCKS)('%s: stops a known kind', (_, l) => {
    expect(KINDS).toContain(l.stops);
    for (const field of Object.keys(l))
      expect(['stops', 'home']).toContain(field);
    if ('home' in l) expect(l.home).toBe(true);
  });

  it.each(KINDS)(
    '%s: has exactly one place, which is among its stoppers',
    (kind) => {
      const homes = LOCKS.filter(([, l]) => l.stops === kind && l.home);
      expect(homes).toHaveLength(1);
      expect(homeOf(TABLE, kind)).toBe(homes[0]![0]);
      expect(stoppers(TABLE, kind)).toContain(homes[0]![0]);
    },
  );

  it('is shared by at least two entries (a component needs two, patterns section 1)', () => {
    expect(LOCKS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('locks: the rule', () => {
  const table: Readonly<Record<string, Locks>> = {
    forge: { stops: 'shipyard', home: true },
    hall: { stops: 'shipyard' },
    study: { stops: 'research', home: true },
  };

  it('says what an upgrade of a building stops', () => {
    expect(stops(table, 'forge', 'shipyard')).toBe(true);
    expect(stops(table, 'hall', 'shipyard')).toBe(true);
    expect(stops(table, 'study', 'research')).toBe(true);
    expect(stops(table, 'forge', 'research')).toBe(false);
    expect(stops(table, 'study', 'shipyard')).toBe(false);
  });

  it('stops nothing for a building without the component, an unknown key or an inherited name', () => {
    for (const key of ['mine', '', 'toString', 'constructor', '__proto__'])
      for (const kind of KINDS)
        expect(stops(table, key, kind), key).toBe(false);
  });

  it('lists the stoppers of a kind in the order of the table', () => {
    expect(stoppers(table, 'shipyard')).toEqual(['forge', 'hall']);
    expect(stoppers(table, 'research')).toEqual(['study']);
    expect(stoppers({}, 'research')).toEqual([]);
  });

  it('finds the building that is the place of a kind, or none', () => {
    expect(homeOf(table, 'shipyard')).toBe('forge');
    expect(homeOf(table, 'research')).toBe('study');
    expect(homeOf({ hall: { stops: 'shipyard' } }, 'shipyard')).toBeUndefined();
    expect(homeOf({}, 'research')).toBeUndefined();
  });
});
