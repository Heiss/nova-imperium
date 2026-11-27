// The guard that a key of a generated list is declared by one file (#426).
import { describe, expect, it } from 'vitest';
import { ownedOnce } from './owned-once.ts';

describe('ownedOnce (#426)', () => {
  it('accepts every key once per field, and the same key in another field', () => {
    const once = ownedOnce('Thing');
    expect(() => {
      once('key', 'a', 'x.ts');
      once('key', 'b', 'y.ts');
      once('order', 'a', 'x.ts');
    }).not.toThrow();
  });

  it('stops at a key declared twice and names both files', () => {
    const once = ownedOnce('Thing');
    once('key', 'a', 'x.ts');
    expect(() => once('key', 'a', 'y.ts')).toThrow(
      'Thing key a is defined twice: in x.ts and in y.ts.',
    );
  });

  it('keeps the keys of one check apart from another', () => {
    ownedOnce('Thing')('key', 'a', 'x.ts');
    expect(() => ownedOnce('Thing')('key', 'a', 'y.ts')).not.toThrow();
  });
});
