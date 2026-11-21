import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_PLANET_NAME, planetNameError } from './planet-name.ts';

// The check of the action `rename` (#214).

describe('the name of a planet or moon', () => {
  it('is cut at 20 characters', () => {
    expect(MAX_PLANET_NAME).toBe(20);
  });

  it('is refused only when empty', () => {
    expect(planetNameError('')).toBe('empty');
    expect(planetNameError('a')).toBeNull();
    expect(planetNameError('Neue Welt')).toBeNull();
    expect(planetNameError('x'.repeat(MAX_PLANET_NAME))).toBeNull();
  });

  it('takes every name that is not empty', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        expect(planetNameError(name)).toBeNull();
      }),
    );
  });
});
