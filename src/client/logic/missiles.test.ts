// The Raketenangriff on the Sternenkarte (#54): when it is offered, the
// choices of the main target and the launch the form asks for.
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import type { Planet } from '../../core/types.ts';
import {
  aimChoices,
  canLaunch,
  launchOrder,
  missilesHere,
  TEAR_DOWN_NOTE,
  tearDownMax,
  tearDownNote,
} from './missiles.ts';
import type { GalaxyPlanet } from './types.ts';

const here = (def: Planet['def'], s = 10) => ({
  owner: 'a',
  def,
  g: 1,
  s,
  p: 5,
});
const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p1_12_3',
  kind: 'planet',
  name: 'Beta',
  temp: 20,
  owner: 'b',
  g: 1,
  s: 12,
  p: 3,
  ...over,
});
const impulse = (level: number) => ({ research: { impulse: level } });

describe('the Raketenangriff: when it is offered', () => {
  it('counts the Orbitalraketen of the place only', () => {
    expect(missilesHere({ def: { ipm: 4, abm: 9 } })).toBe(4);
    expect(missilesHere({ def: { abm: 9 } })).toBe(0);
  });

  it('needs Orbitalraketen, a foreign target and the range of the impulse drive', () => {
    expect(canLaunch(here({ ipm: 1 }), impulse(1), target())).toBe(true);
    expect(
      canLaunch(here({ ipm: 1 }), impulse(1), target({ kind: 'moon' })),
    ).toBe(true);
    expect(canLaunch(here({ abm: 5 }), impulse(1), target())).toBe(false);
    expect(
      canLaunch(here({ ipm: 1 }), impulse(1), target({ owner: 'a' })),
    ).toBe(false);
    expect(canLaunch(here({ ipm: 1 }), { research: {} }, target())).toBe(false);
    expect(canLaunch(here({ ipm: 1 }, 7), impulse(1), target())).toBe(false);
    expect(canLaunch(here({ ipm: 1 }, 8), impulse(1), target())).toBe(true);
    expect(canLaunch(here({ ipm: 1 }), impulse(9), target({ g: 2 }))).toBe(
      false,
    );
  });
});

describe('the Raketenangriff: the form', () => {
  it('offers no main target first, then the defense a missile can hit, by name', () => {
    const choices = aimChoices();
    expect(choices[0]).toEqual({ key: '', name: 'Kein Hauptziel' });
    expect(choices.slice(1).map((c) => c.key)).toEqual([
      'rl',
      'll',
      'hl',
      'gauss',
      'ionc',
      'pt',
      'ssd',
      'lsd',
    ]);
    for (const c of choices.slice(1)) expect(c.name).toBe(text(c.key)!.n);
  });

  it('asks for the target with its kind, the count and the main target', () => {
    expect(launchOrder({ g: '1', s: '3', p: '6' }, '5', 'gauss')).toEqual({
      to: { g: 1, s: 3, p: 6, kind: 'planet' },
      n: 5,
      aim: 'gauss',
    });
    expect(launchOrder({ g: '2', s: '4', p: '1', k: 'moon' }, '1', '')).toEqual(
      {
        to: { g: 2, s: 4, p: 1, kind: 'moon' },
        n: 1,
        aim: null,
      },
    );
  });
});

describe('the tear-down of stored missiles (#54, 2026-11-21)', () => {
  const planet = { def: { abm: 4, ipm: 0, rl: 9 } };

  it('offers the stock of a missile and nothing else', () => {
    expect(tearDownMax(planet, 'abm')).toBe(4);
    expect(tearDownMax(planet, 'ipm')).toBe(0);
    expect(tearDownMax(planet, 'rl')).toBe(0);
    expect(tearDownMax({ def: {} }, 'abm')).toBe(0);
  });

  it('gives the note of the check of the server, or none', () => {
    expect(tearDownNote(planet, 'abm', 4)).toBeNull();
    expect(tearDownNote(planet, 'abm', 5)).toBe(
      'Nicht so viele Raketen vorhanden.',
    );
    expect(tearDownNote(planet, 'abm', 0)).toBe('Bitte eine Anzahl eingeben.');
    expect(tearDownNote(planet, 'abm', 1.5)).toBe(
      'Bitte eine Anzahl eingeben.',
    );
    expect(tearDownNote(planet, 'rl', 1)).toBe('Ungültig.');
    expect(Object.keys(TEAR_DOWN_NOTE)).toEqual(['unit', 'count', 'stock']);
  });
});
