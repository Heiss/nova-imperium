// The raw Markdown of a page, as it is in the repository, with its links
// pointing to the raw Markdown of the other pages (or to GitHub), so that an
// agent can follow them. Only the URLs change; every other byte stays.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { resolveLink } from './links.mjs';
import { REPO_ROOT } from './pages.mjs';

const LINKS = new Set(['link', 'image', 'definition']);

function collect(node, out) {
  if (LINKS.has(node.type)) out.push(node);
  for (const child of node.children ?? []) collect(child, out);
}

/** Start and end of the URL of a link node in the source, or null. */
function urlRange(text, node) {
  const { start, end } = node.position;
  const slice = text.slice(start.offset, end.offset);
  if (node.type === 'definition') {
    const at = slice.indexOf(node.url, slice.indexOf(']:'));
    return at < 0 ? null : start.offset + at;
  }
  const at = slice.lastIndexOf(`](${node.url}`);
  return at < 0 ? null : start.offset + at + 2;
}

/** The Markdown of a repository file with its links rewritten for raw use. */
export function rawMarkdown(source) {
  const text = readFileSync(path.join(REPO_ROOT, source), 'utf8');
  const nodes = [];
  collect(fromMarkdown(text), nodes);
  let out = text;
  // From the end, so earlier offsets stay valid.
  for (const node of nodes.reverse()) {
    const url = resolveLink(node.url, source, {
      mode: 'raw',
      image: node.type === 'image',
    });
    const at = url === null ? null : urlRange(text, node);
    if (at === null) continue;
    out = out.slice(0, at) + url + out.slice(at + node.url.length);
  }
  return out;
}
