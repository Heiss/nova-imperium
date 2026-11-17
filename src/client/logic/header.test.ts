// The header line (#118, bundle 1): the shown place, the commander and the
// list „Aktiver Planet“ of the own places.
import { describe, expect, it } from 'vitest';
import { planet } from '../../test/fixtures.ts';
import { headerLine } from './header.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

const place = (id: string, over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id,
  kind: 'planet',
  name: id,
  g: 1,
  s: 1,
  p: 1,
  temp: 0,
  owner: 'u1',
  ...over,
});

const state = (galaxy: GalaxyPlanet[]): GameState =>
  ({ me: { id: 'u1', name: 'Kain' }, galaxy }) as unknown as GameState;

describe('headerLine', () => {
  it('names the shown planet, its position and the commander', () => {
    expect(headerLine(state([]), planet({ name: 'Heimat' }))).toEqual({
      name: 'Heimat',
      position: '[1:1:5]',
      commander: 'Kain',
      places: [],
    });
  });

  it('names a moon as a moon', () => {
    const moon = planet({ kind: 'moon', name: 'Luna' });
    expect(headerLine(state([]), moon).name).toBe('Luna (Mond)');
  });

  it('lists no places with only one own place', () => {
    const galaxy = [place('p1'), place('f1', { owner: 'u2' })];
    expect(headerLine(state(galaxy), planet({ id: 'p1' })).places).toEqual([]);
  });

  it('lists every own place, each moon after its planet, the shown one selected', () => {
    const galaxy = [
      place('m1', { kind: 'moon', name: 'Luna', s: 2 }),
      place('f1', { owner: 'u2', name: 'Fremd' }),
      place('p2', { name: 'Kolonie', s: 2 }),
      place('p1', { name: 'Heimat' }),
    ];
    expect(headerLine(state(galaxy), planet({ id: 'm1' })).places).toEqual([
      { id: 'p1', label: 'Heimat [1:1:1]', selected: false },
      { id: 'p2', label: 'Kolonie [1:2:1]', selected: false },
      { id: 'm1', label: 'Luna (Mond) [1:2:1]', selected: true },
    ]);
  });
});
