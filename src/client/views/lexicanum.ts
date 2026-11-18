// The Lexicanum in the frame of the game (#285): the page as a view, the
// side panel that the „?“ of a list entry opens on a desktop, and the
// actions of its links. Only this small part is in the start bundle; the
// page, the panel and the articles load as their own chunk when first
// opened (#242), so src/client/main.ts and the start bundle do not grow.
import { mount, unmount } from 'svelte';
import { articleParam, LEXICANUM_VIEW } from '../logic/address.ts';
import {
  closePanel,
  goTo,
  markOpen,
  openArticle,
  useNavigation,
} from './lexicanum-nav.ts';
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
function openEntry(key: string): void {
  if (matchMedia(PHONE).matches) return openArticle(key);
  if (lex.opener === key) return closePanel();
  lex.opener = key;
  lex.panel = key;
  markOpen(key);
  loadPanel();
}

/** The actions of the Lexicanum for the click handler of main.ts. */
export function lexicanumActions(
  navigate: (view: string, push?: boolean) => void,
): Record<string, (d: Record<string, string | undefined>) => void> {
  useNavigation(navigate);
  return {
    // The navigation of main.ts; the menu entry of the Lexicanum opens its
    // start page, also from an article.
    nav: (d) =>
      d.v === LEXICANUM_VIEW ? openArticle('') : goTo(d.v ?? 'overview'),
    explain: (d) => openEntry(d.k ?? ''),
    lex: (d) => openArticle(d.a ?? ''),
    lexPanel: (d) => {
      if (lex.opener) lex.panel = d.a ?? lex.opener;
    },
    lexClose: () => closePanel(),
  };
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
