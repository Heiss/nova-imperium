import { describe, expect, it } from 'vitest';
import {
  latestNews,
  NEWS_SEEN_KEY,
  type NewsData,
  newsHint,
  newsPage,
  UPDATE_LINK,
} from './news.ts';

const news: NewsData = {
  version: '26.11.1',
  versions: [
    {
      version: '26.11.1',
      date: '12.11.2026',
      entries: [
        { kind: 'neu', text: 'Neuigkeiten im Menü.' },
        { kind: 'behoben', text: 'Fehler <b>weg</b>.' },
      ],
    },
    {
      version: '26.11.0',
      date: '01.11.2026',
      entries: [{ kind: 'geändert', text: 'Die Werft baut schneller.' }],
    },
  ],
};

describe('news', () => {
  it('shows the dot until the newest version was opened here', () => {
    expect(latestNews(null)).toBeNull();
    expect(latestNews({ version: null, versions: [] })).toBeNull();
    expect(latestNews(news)).toBe('26.11.1');
    expect(newsHint(news, null)).toBe('Neu in Version 26.11.1');
    expect(newsHint(news, '26.11.0')).toBe('Neu in Version 26.11.1');
    expect(newsHint(news, '26.11.1')).toBeUndefined();
    expect(newsHint(null, null)).toBeUndefined();
  });

  it('lists every version with date, kinds in order, newest first', () => {
    const page = newsPage(news);
    expect(page.loading).toBe(false);
    expect(page.running).toBe('Diese Spielwelt läuft mit Version 26.11.1.');
    expect(page.versions.map((v) => v.title)).toEqual([
      'Version 26.11.1 – 12.11.2026',
      'Version 26.11.0 – 01.11.2026',
    ]);
    expect(page.versions[0]!.groups).toEqual([
      { label: 'Neu', items: ['Neuigkeiten im Menü.'] },
      { label: 'Behoben', items: ['Fehler <b>weg</b>.'] },
    ]);
    expect(page.versions[1]!.groups).toEqual([
      { label: 'Geändert', items: ['Die Werft baut schneller.'] },
    ]);
  });

  it('keeps the entries of a kind together and leaves out a kind without entries', () => {
    expect(NEWS_SEEN_KEY).toBe('nova.news.seen');
    const page = newsPage({
      version: null,
      versions: [
        {
          version: '26.11.1',
          date: '12.11.2026',
          entries: [
            { kind: 'neu', text: 'A.' },
            { kind: 'behoben', text: 'C.' },
            { kind: 'neu', text: 'B.' },
          ],
        },
      ],
    });
    expect(page.running).toBe('');
    expect(page.versions[0]!.groups).toEqual([
      { label: 'Neu', items: ['A.', 'B.'] },
      { label: 'Behoben', items: ['C.'] },
    ]);
  });

  it('says when nothing is loaded or nothing is there', () => {
    expect(newsPage(null)).toEqual({
      loading: true,
      running: '',
      versions: [],
    });
    expect(newsPage({ version: null, versions: [] })).toEqual({
      loading: false,
      running: '',
      versions: [],
    });
    expect(newsPage({ version: '26.11.1', versions: [] }).running).toBe(
      'Diese Spielwelt läuft mit Version 26.11.1.',
    );
  });

  it('links an update message to the page', () => {
    expect(UPDATE_LINK).toBe('?view=news');
  });
});
