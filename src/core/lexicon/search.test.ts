import { describe, expect, it } from 'vitest';
import { searchDocs } from './docs.ts';
import { fold, score, search, type SearchDoc, words } from './search.ts';

const doc = (o: Partial<SearchDoc>): SearchDoc => ({
  id: 'x',
  kind: 'research',
  title: 'Titel',
  keywords: [],
  text: '',
  line: '',
  ...o,
});

describe('the search of the Lexicanum (#285, B6)', () => {
  it('folds case, accents and ß', () => {
    expect(fold('Spähschädel STRASSE Straße')).toBe(
      'spahschadel strasse strasse',
    );
    expect(words('  Auspex-Lehre, Stufe 4 ')).toEqual([
      'auspex',
      'lehre',
      'stufe',
      '4',
    ]);
    expect(words(' - ')).toEqual([]);
  });

  it('ranks abbreviation, title, keyword and text', () => {
    const d = doc({
      title: 'Auspex-Lehre',
      ab: 'AU',
      keywords: ['ausspähen'],
      text: 'Bessere Berichte',
    });
    expect(score('au', d)).toBe(90);
    expect(score('ausp', d)).toBe(80);
    expect(score('lehre', d)).toBe(70);
    expect(score('ehre', d)).toBe(60);
    expect(score('aussp', d)).toBe(50);
    expect(score('berichte', d)).toBe(10);
    expect(score('auspex berichte', d)).toBe(90);
    expect(score('auspex nichts', d)).toBe(0);
    expect(score('', d)).toBe(0);
    expect(score('au', doc({ title: 'Haus' }))).toBe(60);
  });

  it('groups the hits by kind, the best group first, ties in order', () => {
    const docs = [
      doc({ id: 'a', kind: 'building', title: 'Gewölbe', text: 'Lager' }),
      doc({ id: 'b', kind: 'research', title: 'Lager', ab: 'LG' }),
      doc({ id: 'c', kind: 'building', title: 'Halle', text: 'lager' }),
      doc({ id: 'd', kind: 'ship', title: 'Barke' }),
    ];
    expect(search('lager', docs)).toEqual([
      {
        kind: 'research',
        hits: [{ id: 'b', title: 'Lager', ab: 'LG', line: '' }],
      },
      {
        kind: 'building',
        hits: [
          { id: 'a', title: 'Gewölbe', line: '' },
          { id: 'c', title: 'Halle', line: '' },
        ],
      },
    ]);
    expect(search('zzz', docs)).toEqual([]);
  });

  it('finds the articles by name, abbreviation, a word of the text and a keyword', () => {
    const docs = searchDocs();
    const first = (q: string) => search(q, docs)[0]?.hits[0]?.id;
    expect(first('Auspex-Lehre')).toBe('spy');
    expect(first('AU')).toBe('spy');
    expect(first('ausspähen')).toBe('spy');
    expect(first('Gegner')).toBe('spy');
    expect(first('Flottenslot')).toBe('computer');
    expect(first('Sturmangriff')).toBe('mission-attack');
  });
});
