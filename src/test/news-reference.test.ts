// „Neuigkeiten“ renders as before #118, bundle 4 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: newsHTML() of src/client/logic/news.ts and the
// title of src/client/views/index.ts. On generated news (fixed fast-check
// seed 118) both render the same markup, up to what a browser does not show
// (normalize() of markup.ts); hand-built cases cover the empty states.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { esc } from '../client/logic/format.ts';
import { type NewsData, newsPage } from '../client/logic/news.ts';
import News from '../client/views/News.svelte';
import { normalize } from './markup.ts';

// ----- frozen: newsHTML() before #118, bundle 4 -----

type Kind = 'neu' | 'geändert' | 'behoben';

const LABELS: Record<Kind, string> = {
  neu: 'Neu',
  geändert: 'Geändert',
  behoben: 'Behoben',
};

function newsHTML(news: NewsData | null): string {
  if (!news) return '<p class="dim">Neuigkeiten werden geladen …</p>';
  const running = news.version
    ? `<p class="dim">Diese Spielwelt läuft mit Version ${esc(news.version)}.</p>`
    : '';
  if (!news.versions.length)
    return `${running}<p class="dim">Noch keine Neuigkeiten.</p>`;
  const sections = news.versions.map((v) => {
    const groups = (Object.keys(LABELS) as Kind[])
      .map((kind) => {
        const items = v.entries.filter((e) => e.kind === kind);
        return items.length
          ? `<h3>${LABELS[kind]}</h3><ul>${items.map((e) => `<li>${esc(e.text)}</li>`).join('')}</ul>`
          : '';
      })
      .join('');
    return `<div class="box news"><div class="hd">Version ${esc(v.version)} – ${esc(v.date)}</div><div class="bd">${groups}</div></div>`;
  });
  return `${running}${sections.join('')}`;
}

const oldView = (news: NewsData | null): string =>
  `<h2>Neuigkeiten</h2>${newsHTML(news)}`;

// ----- the comparison -----

const newView = (news: NewsData | null): string =>
  render(News, { props: { page: newsPage(news) } }).body;

/** What a changelog entry or a version may hold that is not plain text. */
const TEXTS = [
  'Die Werft baut schneller.',
  'Fehler <b>weg</b> & "gut".',
  "Ein 'Apostroph' > 3",
  'Mehrere   Leerzeichen',
] as const;
const VERSIONS = ['26.11.1', '26.11.0', '<26.10>', 'a&b'] as const;

const news: fc.Arbitrary<NewsData | null> = fc.option(
  fc.record({
    version: fc.option(fc.constantFrom(...VERSIONS), { nil: null }),
    versions: fc.array(
      fc.record({
        version: fc.constantFrom(...VERSIONS),
        date: fc.constantFrom('12.11.2026', '01.11.2026', '<date>'),
        entries: fc.array(
          fc.record({
            kind: fc.constantFrom('neu', 'geändert', 'behoben'),
            text: fc.constantFrom(...TEXTS),
          }),
          { maxLength: 6 },
        ),
      }),
      { maxLength: 3 },
    ),
  }),
  { nil: null },
);

/** The cases the sample reaches rarely: no news yet, none in the changelog, a version without entries. */
const HAND_BUILT: [string, NewsData | null][] = [
  ['not loaded', null],
  ['no versions, no running version', { version: null, versions: [] }],
  ['no versions, a running version', { version: '26.11.1', versions: [] }],
  [
    'a version without entries',
    {
      version: null,
      versions: [{ version: '26.11.1', date: '12.11.2026', entries: [] }],
    },
  ],
];

describe('News against the view before #118, bundle 4', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(news, (data) => {
        expect(normalize(newView(data))).toBe(normalize(oldView(data)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, data] of HAND_BUILT)
      expect(normalize(newView(data)), name).toBe(normalize(oldView(data)));
  });
});
