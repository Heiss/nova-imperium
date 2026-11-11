import { describe, expect, it } from 'vitest';
import { isProtected } from './protection.ts';

describe('noob protection', () => {
  it('protects a player with less than a fifth of your points', () => {
    expect(isProtected(5, 0.9)).toBe(true);
    expect(isProtected(5, 1)).toBe(false);
    expect(isProtected(6, 1)).toBe(true);
    expect(isProtected(0, 0)).toBe(false);
  });
});
