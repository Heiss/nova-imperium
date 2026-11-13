// Sätteri plugin (the Markdown processor of Astro 7) for every page:
//   - links and images are rewritten to the routes of the site (lib/links.mjs);
//   - placeholders such as <version> in running text stay visible as text
//     instead of becoming an unknown HTML element;
//   - the OKF markers **[E]**, **[V]** and **[U]** become small badges.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLink } from './links.mjs';
import { REPO_ROOT } from './pages.mjs';

/** The repository path of the page being rendered. */
function sourceOf(ctx) {
  const fromCopy = ctx.data?.astro?.frontmatter?.source;
  if (typeof fromCopy === 'string') return fromCopy;
  if (!ctx.fileURL) return null;
  return path
    .relative(REPO_ROOT, fileURLToPath(ctx.fileURL))
    .split(path.sep)
    .join('/');
}

function rewrite(node, ctx, image) {
  const source = sourceOf(ctx);
  if (!source) return;
  const url = resolveLink(node.url, source, { mode: 'html', image });
  if (url !== null) ctx.setField(node, 'url', url);
}

const HTML_TAGS = new Set(
  (
    'a abbr address area article aside audio b bdi bdo blockquote br button ' +
    'canvas caption cite code col colgroup data dd del details dfn dialog div ' +
    'dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 ' +
    'header hr i iframe img input ins kbd label legend li link main mark meta ' +
    'meter nav noscript object ol optgroup option output p picture pre ' +
    'progress q rp rt ruby s samp section select small source span strong sub ' +
    'summary sup table tbody td template textarea tfoot th thead time tr ' +
    'track u ul var video wbr'
  ).split(' '),
);
const PLACEHOLDER = /^<\/?([a-z][a-z\d-]*)>$/i;

const MARKERS = {
  E: 'Decision: explicitly confirmed by the owner',
  V: 'Proposal: added by the assistant, not confirmed',
  U: 'Unverified: not proven yet, must be checked',
};

export const novaMarkdown = {
  name: 'nova-imperium-site',
  link(node, ctx) {
    rewrite(node, ctx, false);
  },
  definition(node, ctx) {
    rewrite(node, ctx, false);
  },
  image(node, ctx) {
    rewrite(node, ctx, true);
  },
  html(node) {
    const tag = PLACEHOLDER.exec(node.value.trim());
    if (tag && !HTML_TAGS.has(tag[1].toLowerCase()))
      return { type: 'text', value: node.value };
  },
  strong(node, ctx) {
    const marker = /^\[([EVU])\]$/.exec(ctx.textContent(node).trim());
    if (!marker) return;
    const [, m] = marker;
    return {
      type: 'html',
      value: `<strong class="okf-marker okf-marker-${m.toLowerCase()}" title="${MARKERS[m]}">[${m}]</strong>`,
    };
  },
};
