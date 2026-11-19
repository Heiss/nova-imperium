// The phone view of the lists (#189, D2 to D4): the phase of a row, what each
// filter shows, the short button label and the switch between the lists.
import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { V } from '../views/common.ts';
import {
  type CatalogAction,
  CATALOG_VIEWS,
  LOCKED,
  type CatalogRow,
  catalogPage,
} from './catalog-list.ts';
import {
  DEFAULT_FILTER,
  EMPTY,
  filterCounts,
  FILTERS,
  isTimeLine,
  rowPhase,
  SEGMENTS,
  shortLabel,
} from './phone-build.ts';
import type { GameState } from './types.ts';

const row = (key: string, action: CatalogAction): CatalogRow =>
  ({ key, action }) as unknown as CatalogRow;

const START: CatalogAction = {
  kind: 'start',
  act: 'build',
  label: 'Bauen',
  disabled: false,
};
const BUSY: CatalogAction = {
  kind: 'note',
  cls: 'dim',
  text: 'Bauschleife belegt',
};
const UPGRADING: CatalogAction = {
  kind: 'upgrading',
  down: false,
  level: 3,
  end: 10,
  left: '1m',
  max: 10,
  value: 5,
};
const RESEARCHING: CatalogAction = {
  kind: 'researching',
  level: 2,
  place: 'Heimat',
  end: 10,
  left: '1m',
};
const ORDER: CatalogAction = {
  kind: 'order',
  max: 5,
  once: false,
  disabled: false,
};

function view(P: Partial<V['P']> = {}): V {
  return {
    s: {
      cfg: U,
      me: { id: 'u1', explain: 'icon' },
      labs: [],
      galaxy: [],
      homePlanet: 'p1_1_5',
    } as unknown as GameState,
    P: planet({ b: { lab: 1, yard: 1 }, ...P }),
    R: { research: {}, rq: null },
    now: 0,
    ui: { openEx: {} },
  } as unknown as V;
}

describe('the phase of a row (#189)', () => {
  const none = new Set<string>();

  it('is running for an upgrade or a research that runs', () => {
    expect(rowPhase(row('metal', UPGRADING), none)).toBe('running');
    expect(rowPhase(row('energy', RESEARCHING), none)).toBe('running');
  });

  it('is running for a unit with an order in the queue only', () => {
    expect(rowPhase(row('sat', ORDER), new Set(['sat']))).toBe('running');
    expect(rowPhase(row('sat', ORDER), new Set(['lc']))).toBe('open');
    expect(rowPhase(row('sat', ORDER), none)).toBe('open');
  });

  it('is locked for missing requirements, and only for them', () => {
    expect(rowPhase(row('metal', LOCKED), none)).toBe('locked');
    // The real list of a fresh planet has such entries, and their note is that one.
    const page = catalogPage(view(), 'building');
    if (page.blocked) throw new Error('the list is blocked');
    expect(page.rows.map((r) => rowPhase(r, none))).toContain('locked');
  });

  it('is open for everything that can be started, also while it waits', () => {
    expect(rowPhase(row('metal', START), none)).toBe('open');
    expect(rowPhase(row('metal', { ...START, disabled: true }), none)).toBe(
      'open',
    );
    expect(rowPhase(row('metal', BUSY), none)).toBe('open');
  });

  it('counts what each filter shows', () => {
    const rows = [
      row('a', START),
      row('b', START),
      row('c', UPGRADING),
      row('d', BUSY),
    ];
    expect(filterCounts(rows, new Set())).toEqual({
      open: 3,
      all: 4,
      running: 1,
    });
    expect(filterCounts([], new Set())).toEqual({
      open: 0,
      all: 0,
      running: 0,
    });
  });

  it('counts the real list: a fresh planet has locked entries and none running', () => {
    const page = catalogPage(view(), 'building');
    if (page.blocked) throw new Error('the list is blocked');
    const count = filterCounts(page.rows, new Set());
    expect(count.all).toBe(page.rows.length);
    expect(count.running).toBe(0);
    expect(count.open).toBeGreaterThan(0);
    expect(count.open).toBeLessThan(count.all);
  });
});

describe('the choices of the phone view (#189)', () => {
  it('starts with „Baubar“ (D4) and names the filters as the owner did', () => {
    expect(DEFAULT_FILTER).toBe('open');
    expect(FILTERS.map((f) => f.label)).toEqual(['Baubar', 'Alle', 'Läuft']);
    expect(FILTERS[0]!.key).toBe(DEFAULT_FILTER);
  });

  it('switches between exactly the four lists (D2)', () => {
    expect(SEGMENTS.map((s) => s.label)).toEqual([
      'Gebäude',
      'Forschung',
      'Schiffsschmiede',
      'Abwehr',
    ]);
    expect(SEGMENTS.map((s) => s.view)).toEqual(Object.keys(CATALOG_VIEWS));
  });

  it('says something for a filter that shows nothing, except „Alle“', () => {
    expect(EMPTY.open).not.toBe('');
    expect(EMPTY.running).not.toBe('');
    expect(EMPTY.all).toBe('');
  });

  it('shortens a button that names a level to „▲ 6“', () => {
    expect(shortLabel('Ausbauen auf Stufe 6')).toBe('▲ 6');
    expect(shortLabel('Forschen (Stufe 12)')).toBe('▲ 12');
    expect(shortLabel('Bauen')).toBeNull();
    expect(shortLabel('Forschen')).toBeNull();
  });

  it('keeps the time line of a row in the compact row', () => {
    expect(isTimeLine('Bauzeit: 2m 56s')).toBe(true);
    expect(isTimeLine('Forschungszeit: 1h (Scholarien zusammen Stufe 5)')).toBe(
      true,
    );
    expect(isTimeLine('Energie auf Stufe 13: 72,18 mehr Verbrauch')).toBe(
      false,
    );
  });
});
