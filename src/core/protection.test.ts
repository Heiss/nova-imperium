import { describe, expect, it } from 'vitest';
import {
  isProtected,
  PROTECTION_RATIO,
  unprotectedFrom,
} from './protection.ts';

describe('noob protection', () => {
  it('protects a player with less than a fifth of your points', () => {
    expect(isProtected(5, 0.9)).toBe(true);
    expect(isProtected(5, 1)).toBe(false);
    expect(isProtected(6, 1)).toBe(true);
    expect(isProtected(0, 0)).toBe(false);
  });
});

describe('the border of the noob protection (#288)', () => {
  it('is a fifth, and names the fewest points that are not protected', () => {
    expect(PROTECTION_RATIO).toBe(5);
    expect(unprotectedFrom(0)).toBe(0);
    expect(unprotectedFrom(1)).toBe(1);
    expect(unprotectedFrom(5)).toBe(1);
    expect(unprotectedFrom(6)).toBe(2);
    expect(unprotectedFrom(1000)).toBe(200);
    expect(unprotectedFrom(1001)).toBe(201);
    expect(unprotectedFrom(4.5)).toBe(1);
    expect(unprotectedFrom(-5)).toBe(0);
    for (const mine of [0, 1, 4, 5, 6, 99, 1000, 123457]) {
      const border = unprotectedFrom(mine);
      expect(isProtected(mine, border)).toBe(false);
      if (border > 0) expect(isProtected(mine, border - 1)).toBe(true);
    }
  });
});
