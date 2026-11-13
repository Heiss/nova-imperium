// The raw Markdown of a page, as it is in the repository, with its links
// pointing to the raw Markdown of the other pages (or to GitHub), so that an
// agent can follow them. Only the URLs change; every other byte stays.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { imageDefinition, imageReferences, resolveLink } from './links.mjs';
import { REPO_ROOT } from './pages.mjs';

const LINKS = new Set(['link', 'image', 'definition']);

function collect(node, out) {
  if (LINKS.has(node.type)) out.push(node);
  for (const child of node.children ?? []) collect(child, out);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Offset of the destination of a link node in the source, or null. The
 * destination may be wrapped in angle brackets and follow whitespace:
 * `[x](<a.md>)`, `[x]( a.md)` and `[x]: <a.md>` are valid CommonMark.
 */
export function urlOffset(text, node) {
  const { start, end } = node.position;
  const slice = text.slice(start.offset, end.offset);
  const url = escape(node.url);
  const opener = node.type === 'definition' ? '\\]:' : '\\]\\(';
  const pattern = new RegExp(`${opener}\\s*<?(?=${url}(?:>|\\s|\\)|$))`, 'g');
  const matches = [...slice.matchAll(pattern)];
  if (!matches.length) return null;
  // A definition's destination follows its first "]:"; a link's follows
  // the last "](" with that URL, after any image or link in its text.
  const m = node.type === 'definition' ? matches[0] : matches.at(-1);
  const last = m.index + m[0].length;
  return start.offset + last;
}

/**
 * The URLs of every image of a Markdown text: inline images and the
 * definitions of full, collapsed and shortcut image references.
 */
export function imageUrls(text) {
  const tree = fromMarkdown(text);
  const refs = imageReferences(tree);
  const nodes = [];
  collect(tree, nodes);
  return nodes
    .filter(
      (n) =>
        n.type === 'image' ||
        (n.type === 'definition' && imageDefinition(n, refs)),
    )
    .map((n) => n.url);
}

/** A Markdown text of `source` with its links rewritten for raw use. */
export function rewriteRaw(text, source) {
  const tree = fromMarkdown(text);
  const refs = imageReferences(tree);
  const nodes = [];
  collect(tree, nodes);
  const edits = [];
  for (const node of nodes) {
    const image =
      node.type === 'image' ||
      (node.type === 'definition' && imageDefinition(node, refs));
    const url = resolveLink(node.url, source, { mode: 'raw', image });
    const at = url === null ? null : urlOffset(text, node);
    if (at !== null) edits.push({ at, length: node.url.length, url });
  }
  // From the last destination to the first, so earlier offsets stay valid:
  // an image inside a link comes before the link's own destination.
  let out = text;
  for (const { at, length, url } of edits.sort((a, b) => b.at - a.at))
    out = out.slice(0, at) + url + out.slice(at + length);
  return out;
}

/** The Markdown of a repository file with its links rewritten for raw use. */
export function rawMarkdown(source) {
  return rewriteRaw(readFileSync(path.join(REPO_ROOT, source), 'utf8'), source);
}
