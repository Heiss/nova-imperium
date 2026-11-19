// The Lexicanum in the frame of the game (#285): the page as a view, the
// side panel that the „?“ of a list entry opens on a desktop; the actions of
// its links are in features/lexicanum.ts. Only this small part is in the
// start bundle; the page, the panel and the articles load as their own chunk
// when first opened (#242), so src/client/main.ts and the start bundle do not
// grow.
import { mount, unmount } from 'svelte';
import { articleParam } from '../logic/address.ts';
import { closePanel, markOpen, openArticle } from './lexicanum-nav.ts';
import { lex } from './lexicanum-state.svelte.ts';

/** Below this width the „?“ opens the page instead of the side panel. */
const PHONE = '(max-width: 760px)';

const LOADING = '<div class="notice">Lade …</div>';

let panel: Promise<unknown> | null = null;

/** Mounts the side panel once, on the first „?“ (#242). */
function loadPanel(): void {
  panel ??= import('./LexicanumPanel.svelte').then(({ default: Panel }) => {
    mount(Panel, { target: document.body });
    // The panel closes when its list is gone (another view).
    new MutationObserver(() => {
      if (lex.opener && !document.getElementById(`exq_${lex.opener}`))
        closePanel(false);
    }).observe(document.getElementById('view')!, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * The „?“ of a list entry: on a desktop it opens or closes the article in
 * the side panel, on a phone it opens the page (#285).
 */
export function openEntry(key: string): void {
  if (matchMedia(PHONE).matches) return openArticle(key);
  if (lex.opener === key) return closePanel();
  lex.opener = key;
  lex.panel = key;
  markOpen(key);
  loadPanel();
}

/** The page of the Lexicanum as a view; it follows the address. */
export function mountLexicanum(target: HTMLElement) {
  lex.article = articleParam(location.search);
  target.innerHTML = LOADING;
  let component: ReturnType<typeof mount> | null = null;
  let gone = false;
  void import('./LexicanumPage.svelte').then(({ default: Page }) => {
    if (gone) return;
    target.replaceChildren();
    component = mount(Page, { target });
  });
  return {
    update: () => {
      lex.article = articleParam(location.search);
    },
    destroy: () => {
      gone = true;
      if (component) void unmount(component);
    },
  };
}
