import { mount, unmount } from 'svelte';
import { newsPage } from '../logic/news.ts';
import type { V } from './common.ts';
import News from './News.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Neuigkeiten“ (#118, bundle 4), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew; main.ts renders
 * again when the news have loaded.
 */
function mountNews(target: HTMLElement, v: V) {
  const component = mount(News, {
    target,
    props: { page: newsPage(v.ui.news) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'news',
    mount: mountNews,
    anew: true,
    menu: { order: 150, label: 'Neuigkeiten', divider: true },
  },
] satisfies readonly ClientView[];
