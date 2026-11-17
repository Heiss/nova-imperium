import { describe, expect, it } from 'vitest';
import { fill, linkTargets, plain, segments, valueNames } from './links.ts';

const title = (id: string): string | undefined =>
  ({ probe: 'Spähschädel' })[id];

describe('links and values of the Lexicanum (#285, B7)', () => {
  it('finds the targets and the names of the values', () => {
    expect(linkTargets('a [[probe]] b [[spy|Lehre]] c')).toEqual([
      'probe',
      'spy',
    ]);
    expect(linkTargets('none')).toEqual([]);
    expect(valueNames('{one} and {two_2} but not { x }')).toEqual([
      'one',
      'two_2',
    ]);
  });

  it('fills the values and keeps a missing one', () => {
    expect(fill('{a} + {b}', { a: '1' })).toBe('1 + {b}');
    expect(fill('{a}')).toBe('{a}');
    expect(fill('{toString}', {})).toBe('{toString}');
  });

  it('splits a text into words and links with their titles', () => {
    expect(segments('Jeder [[probe]] zählt.', title)).toEqual([
      { text: 'Jeder ' },
      { text: 'Spähschädel', link: 'probe' },
      { text: ' zählt.' },
    ]);
    expect(segments('[[probe|Schädel]]', title)).toEqual([
      { text: 'Schädel', link: 'probe' },
    ]);
    expect(segments('[[nope]]', title)).toEqual([
      { text: 'nope', link: 'nope' },
    ]);
    expect(segments('', title)).toEqual([]);
    expect(plain('Mit [[probe]] und [[x|Text]].', title)).toBe(
      'Mit Spähschädel und Text.',
    );
  });
});
