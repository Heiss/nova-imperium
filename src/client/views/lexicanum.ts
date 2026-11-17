// The Lexicanum in the frame of the game (#285): the page as a view, the
// side panel that the „?“ of a list entry opens on a desktop, and the
// actions of its links. Only this small part is in the start bundle; the
// page, the panel and the articles load as their own chunk when first
// opened (#242), so src/client/main.ts and the start bundle do not grow.
import { mount, unmount } from 'svelte';
import { articleParam, LEXICANUM_VIEW, viewUrl } from '../logic/address.ts';
import { client } from '../logic/state.svelte.ts';
import { lex } from './lexicanum-state.svelte.ts';

type Go = (view: string, push?: boolean) => void;
let go: Go = () => undefined;

/** Below this width the „?“ opens the page instead of the side panel. */
const PHONE = '(max-width: 760px)';

const LOADING = '<div class="notice">Lade …</div>';

/** Opens an article on the page of the Lexicanum, with its address. */
export function openArticle(id: string): void {
  closePanel(false);
  history.pushState(null, '', viewUrl(location.href, LEXICANUM_VIEW, null, id));
  go(LEXICANUM_VIEW, false);
}

/** Marks the „?“ of the entry the panel shows, so the list updates it. */
function markOpen(key: string | null): void {
  client.ui.openEx = key ? { [key]: true } : {};
  if (client.shown) client.shown = { ...client.shown };
}

/** The entry whose „?“ opened the side panel; its links may lead elsewhere. */
let opener: string | null = null;

/** Closes the side panel; the focus goes back to the „?“ that opened it. */
export function closePanel(focus = true): void {
  const key = opener;
  if (!lex.panel) return;
  lex.panel = null;
  opener = null;
  markOpen(null);
  if (focus && key) document.getElementById(`exq_${key}`)?.focus();
}

let panel: Promise<unknown> | null = null;

/** Mounts the side panel once, on the first „?“ (#242). */
function loadPanel(): void {
  panel ??= import('./LexicanumPanel.svelte').then(({ default: Panel }) => {
    mount(Panel, { target: document.body });
    // The panel closes when its list is gone (another view).
    new MutationObserver(() => {
      if (opener && !document.getElementById(`exq_${opener}`))
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
  if (opener === key) return closePanel();
  opener = key;
  lex.panel = key;
  markOpen(key);
  loadPanel();
}

/** The actions of the Lexicanum for the click handler of main.ts. */
export function lexicanumActions(
  navigate: Go,
): Record<string, (d: Record<string, string | undefined>) => void> {
  go = navigate;
  return {
    // The menu entry opens the start page, also from an article.
    nav: (d) =>
      d.v === LEXICANUM_VIEW ? openArticle('') : go(d.v ?? 'overview'),
    explain: (d) => openEntry(d.k ?? ''),
    lex: (d) => openArticle(d.a ?? ''),
    lexPanel: (d) => {
      if (opener) lex.panel = d.a ?? opener;
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
