// The news of the game (formerly in main.ts): loaded once per version, again
// after a maintenance, and shown by the page „Neuigkeiten“.
import { api } from './api.ts';
import type { NewsData } from './logic/news.ts';
import { client } from './logic/state.svelte.ts';
import { render } from './render.ts';

let loading = false;
/** Counts the reloads of the news; an answer of an older load is dropped. */
let generation = 0;

export async function loadNews(): Promise<void> {
  const ui = client.ui;
  if (ui.news || loading) return;
  loading = true;
  const load = generation;
  try {
    const news = (await api('/api/news')) as unknown as NewsData;
    if (load !== generation) return;
    ui.news = news;
    if (client.game) render();
  } catch (e) {
    console.warn(e);
  } finally {
    loading = false;
  }
}

/** An update may have brought a new version: load its news again. */
export function forgetNews(): void {
  client.ui.news = null;
  loading = false;
  generation++;
}
