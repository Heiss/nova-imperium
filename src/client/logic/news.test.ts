import { describe, expect, it } from 'vitest';
import {
  latestNews,
  NEWS_SEEN_KEY,
  type NewsData,
  newsHint,
  newsHTML,
  updateMessageHTML,
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

  it('lists every version with date, kinds in order, all text escaped', () => {
    const html = newsHTML(news);
    expect(html).toContain('Diese Spielwelt läuft mit Version 26.11.1.');
    expect(html).toContain(
      '<div class="hd">Version 26.11.1 – 12.11.2026</div>',
    );
    expect(html).toContain(
      '<h3>Neu</h3><ul><li>Neuigkeiten im Menü.</li></ul><h3>Behoben</h3><ul><li>Fehler &lt;b&gt;weg&lt;/b&gt;.</li></ul>',
    );
    expect(html).not.toContain('<h3>Geändert</h3><ul><li>Neuigkeiten');
    expect(html.indexOf('26.11.1 –')).toBeLessThan(html.indexOf('26.11.0 –'));
    expect(html).toContain(
      '<h3>Geändert</h3><ul><li>Die Werft baut schneller.</li></ul>',
    );
  });

  it('joins entries and versions without anything in between', () => {
    expect(NEWS_SEEN_KEY).toBe('nova.news.seen');
    const html = newsHTML({
      version: null,
      versions: [
        {
          version: '26.11.1',
          date: '12.11.2026',
          entries: [
            { kind: 'neu', text: 'A.' },
            { kind: 'neu', text: 'B.' },
          ],
        },
        {
          version: '26.11.0',
          date: '01.11.2026',
          entries: [{ kind: 'behoben', text: 'C.' }],
        },
      ],
    });
    expect(html).toBe(
      '<div class="box news"><div class="hd">Version 26.11.1 – 12.11.2026</div><div class="bd"><h3>Neu</h3><ul><li>A.</li><li>B.</li></ul></div></div>' +
        '<div class="box news"><div class="hd">Version 26.11.0 – 01.11.2026</div><div class="bd"><h3>Behoben</h3><ul><li>C.</li></ul></div></div>',
    );
  });

  it('says when nothing is loaded or nothing is there', () => {
    expect(newsHTML(null)).toBe(
      '<p class="dim">Neuigkeiten werden geladen …</p>',
    );
    expect(newsHTML({ version: null, versions: [] })).toBe(
      '<p class="dim">Noch keine Neuigkeiten.</p>',
    );
    expect(newsHTML({ version: '26.11.1', versions: [] })).toContain(
      'Version 26.11.1.</p><p class="dim">Noch keine Neuigkeiten.</p>',
    );
  });

  it('turns the update message into lines and a link', () => {
    expect(updateMessageHTML('Neu:\n• <A>', '?view=news')).toBe(
      '<div>Neu:<br>• &lt;A&gt;</div><p><a href="?view=news" data-act="nav" data-v="news">Zu den Neuigkeiten</a></p>',
    );
  });
});
