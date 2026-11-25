import { describe, expect, it } from 'vitest';
import { fill, linkTargets, plain, segments, valueNames } from './links.ts';
import { fast, HOSTILE, sameOn } from '../../test/redos.ts';

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

describe('the links of a text, read in linear time (#367)', () => {
  // The expression the links were found with before (quadratic).
  const OLD = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const before = (text: string) => {
    const out: { text: string; link?: string }[] = [];
    let at = 0;
    for (const m of text.matchAll(OLD)) {
      if (m.index > at) out.push({ text: text.slice(at, m.index) });
      out.push({ text: m[2] ?? title(m[1]!) ?? m[1]!, link: m[1]! });
      at = m.index + m[0].length;
    }
    if (at < text.length) out.push({ text: text.slice(at) });
    return out;
  };

  it('finds the links the expression found', () => {
    for (const text of [
      '[[a|b|c]]',
      '[[a|]]',
      '[[|a]]',
      '[[]]',
      '[[[a]]',
      '[[a[[b]]',
      '[[a|[[b]]',
      '[[|[[a]]',
      '[[a|]x[[b]]',
      '[[a]x]]',
      '[[a]]]]',
      '[[a]][[probe|x]]',
      ']][[a]',
    ])
      expect(segments(text, title)).toEqual(before(text));
    sameOn(['[', ']', '|', 'a', 'probe', '[[', ']]'], (text) => {
      expect(segments(text, title)).toEqual(before(text));
      expect(linkTargets(text)).toEqual(
        [...text.matchAll(OLD)].map((m) => m[1]),
      );
    });
  });

  it('reads many „[[“ without „]]“ fast (the expression: about 2 s)', () => {
    const text = `${'[[['.repeat(HOSTILE / 3)}|]][[[]]`;
    expect(fast(() => linkTargets(text))).toEqual(['[']);
    expect(
      fast(() => segments(`${'[[a'.repeat(HOSTILE / 3)}|]]`, title)),
    ).toHaveLength(1);
  });
});
