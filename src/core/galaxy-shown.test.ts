import { describe, expect, it } from 'vitest';
import { protectionOf, shownParam, shownSystemOf } from './galaxy-shown.ts';

const U = { galaxies: 3, systems: 400 };

describe('the system the Sternenkarte shows (151a)', () => {
  it('reads „g:s“ with integers in the universe', () => {
    expect(shownSystemOf('1:2', U)).toEqual({ g: 1, s: 2 });
    expect(shownSystemOf('3:400', U)).toEqual({ g: 3, s: 400 });
    expect(shownParam({ g: 3, s: 400 })).toBe('3:400');
    expect(shownSystemOf('12:499', { galaxies: 12, systems: 499 })).toEqual({
      g: 12,
      s: 499,
    });
  });

  it('ignores anything else', () => {
    for (const raw of [
      undefined,
      null,
      12,
      ['1:2'],
      '',
      '1',
      '1:',
      ':2',
      '0:2',
      '4:2',
      '1:0',
      '1:401',
      '-1:2',
      '1.5:2',
      '1:2:3',
      ' 1:2',
      '1:2 ',
      'a:b',
      '1e1:2',
      '00001:2',
    ])
      expect(shownSystemOf(raw, U), String(raw)).toBeNull();
  });

  it('uses the list of the state only for its own system', () => {
    const list = { g: 1, s: 2, owners: ['u2'] };
    expect(protectionOf(list, { g: 1, s: 2 })).toEqual(['u2']);
    expect(protectionOf(list, { g: 1, s: 3 })).toBeNull();
    expect(protectionOf(list, { g: 2, s: 2 })).toBeNull();
    expect(protectionOf(undefined, { g: 1, s: 2 })).toBeNull();
  });
});
