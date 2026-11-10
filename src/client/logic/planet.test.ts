import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANIMATION_KEY, animationsOn, planetLook } from './planet.ts';

const STATIC = path.resolve(import.meta.dirname, '../static');

describe('planet look', () => {
  it('follows type and variant of the coordinates', () => {
    expect(planetLook({ g: 1, s: 50, p: 7 })).toEqual({
      type: 'normal',
      variant: (1 + 50 + 7 - 3) % 3,
      name: 'Normaler Planet',
      surface: `/planets/normal-${(1 + 50 + 7 - 3) % 3}-surface.svg`,
      clouds: `/planets/normal-${(1 + 50 + 7 - 3) % 3}-clouds.svg`,
    });
    expect(planetLook({ g: 2, s: 3, p: 13 }).type).toBe('gas');
  });
  it('has textures for every type and variant', () => {
    for (let s = 1; s <= 2; s++)
      for (let p = 1; p <= 16; p++)
        for (let g = 1; g <= 3; g++) {
          const look = planetLook({ g, s, p });
          expect(
            existsSync(path.join(STATIC, look.surface)),
            look.surface,
          ).toBe(true);
          expect(existsSync(path.join(STATIC, look.clouds)), look.clouds).toBe(
            true,
          );
        }
  });
});

describe('animation setting', () => {
  it('is on unless turned off', () => {
    expect(ANIMATION_KEY).toBe('nova.animations');
    expect(animationsOn(() => null)).toBe(true);
    expect(animationsOn(() => 'on')).toBe(true);
    expect(animationsOn(() => 'off')).toBe(false);
  });
  it('stays on when the storage cannot be read', () => {
    expect(
      animationsOn(() => {
        throw new Error('blocked');
      }),
    ).toBe(true);
  });
});
