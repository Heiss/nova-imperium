// The dot of „Neuigkeiten“ (issue #81; formerly in main.ts): what this device
// has seen of the news.
import { latestNews, NEWS_SEEN_KEY } from './logic/news.ts';
import { client } from './logic/state.svelte.ts';

export function readNewsSeen(): string | null {
  try {
    return localStorage.getItem(NEWS_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Opening „Neuigkeiten“ clears the dot on this device (issue #81). */
export function seeNews(): void {
  const ui = client.ui;
  const latest = latestNews(ui.news);
  if (!latest || latest === ui.newsSeen) return;
  ui.newsSeen = latest;
  try {
    localStorage.setItem(NEWS_SEEN_KEY, latest);
  } catch {
    // Without storage the dot comes back on the next visit.
  }
}
