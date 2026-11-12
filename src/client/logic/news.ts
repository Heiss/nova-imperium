// „Neuigkeiten“ in the browser (issue #81): the server sends the sections
// of CHANGELOG.md as data (GET /api/news); the dot on the menu item stays
// until the page was opened on this device (owner, 2026-11-12: stored in the
// browser, no migration).
import { esc } from './format.ts';

type NewsKind = 'neu' | 'geändert' | 'behoben';

export interface NewsData {
  /** The running version; null in development. */
  version: string | null;
  versions: {
    version: string;
    date: string;
    entries: { kind: NewsKind; text: string }[];
  }[];
}

export const NEWS_SEEN_KEY = 'nova.news.seen';

const LABELS: Record<NewsKind, string> = {
  neu: 'Neu',
  geändert: 'Geändert',
  behoben: 'Behoben',
};

/** The newest version that has entries, or null. */
export const latestNews = (news: NewsData | null): string | null =>
  news?.versions[0]?.version ?? null;

/** The menu hint until the newest version was seen on this device. */
export function newsHint(
  news: NewsData | null,
  seen: string | null,
): string | undefined {
  const latest = latestNews(news);
  return latest && latest !== seen ? `Neu in Version ${latest}` : undefined;
}

/** The page: every version with its date, newest first. */
export function newsHTML(news: NewsData | null): string {
  if (!news) return '<p class="dim">Neuigkeiten werden geladen …</p>';
  const running = news.version
    ? `<p class="dim">Diese Spielwelt läuft mit Version ${esc(news.version)}.</p>`
    : '';
  if (!news.versions.length)
    return `${running}<p class="dim">Noch keine Neuigkeiten.</p>`;
  const sections = news.versions.map((v) => {
    const groups = (Object.keys(LABELS) as NewsKind[])
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

/** The text of an update message: one line each, then the link. */
export function updateMessageHTML(text: string, link: string): string {
  const lines = text
    .split('\n')
    .map((line) => esc(line))
    .join('<br>');
  return `<div>${lines}</div><p><a href="${esc(link)}" data-act="nav" data-v="news">Zu den Neuigkeiten</a></p>`;
}
