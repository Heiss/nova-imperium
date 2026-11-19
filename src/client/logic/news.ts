// „Neuigkeiten“ in the browser (issue #81): the server sends the sections
// of CHANGELOG.md as data (GET /api/news); the dot on the menu item stays
// until the page was opened on this device (owner, 2026-11-12: stored in the
// browser, no migration).

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

/** One version of the page: its heading and, per kind with entries, the list. */
interface NewsVersion {
  title: string;
  groups: { label: string; items: string[] }[];
}

/** What the page shows: it is loading, or the running version and the versions, newest first. */
export interface NewsPage {
  /** Nothing is loaded yet. */
  loading: boolean;
  /** „Diese Spielwelt läuft mit Version …“, or empty in development. */
  running: string;
  versions: NewsVersion[];
}

/** The page: every version with its date, newest first. */
export function newsPage(news: NewsData | null): NewsPage {
  if (!news) return { loading: true, running: '', versions: [] };
  return {
    loading: false,
    running: news.version
      ? `Diese Spielwelt läuft mit Version ${news.version}.`
      : '',
    versions: news.versions.map((v) => ({
      title: `Version ${v.version} – ${v.date}`,
      groups: (Object.keys(LABELS) as NewsKind[])
        .map((kind) => ({
          label: LABELS[kind],
          items: v.entries.filter((e) => e.kind === kind).map((e) => e.text),
        }))
        .filter((group) => group.items.length),
    })),
  };
}

/** Where the link of an update message in the reports leads (#81). */
export const UPDATE_LINK = '?view=news';
