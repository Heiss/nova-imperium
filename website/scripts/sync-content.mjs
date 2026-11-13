// Copies okf/ and docs/ into the generated folders of src/content/docs before
// every build (okf/ops/website.md: okf/ and docs/ stay the only source; the
// copies are not committed, see website/.gitignore).
//
// Each copy gets the front matter Starlight needs: the title (front matter,
// else the first heading), the description (front matter, else the first
// sentence), the link to edit the source on GitHub and the source path,
// which lib/markdown.mjs uses to resolve the links of the page.
//
//   node scripts/sync-content.mjs
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { repoTarget } from '../lib/links.mjs';
import { imageUrls } from '../lib/raw.mjs';
import {
  GENERATED_DIRS,
  GITHUB,
  HAND_WRITTEN,
  REPO_ROOT,
  generatedPage,
  markdownFiles,
} from '../lib/pages.mjs';

/** Front matter and body of a Markdown file. */
export function splitFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: parse(m[1]) ?? {}, body: text.slice(m[0].length) };
}

/** Text of inline Markdown without links, code and emphasis marks. */
export function plain(text) {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first paragraph of plain prose, cut after its first sentence. */
export function firstSentence(body) {
  const blocks = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim());
  const prose = blocks.find((b) => b && !/^([#*>|`!<-]|\d+\.)/.test(b));
  if (!prose) return undefined;
  const text = plain(prose);
  const end = /^.+?[.!?](?=\s|$)/.exec(text);
  return end ? end[0] : text;
}

/**
 * Title and body of a page: the first heading becomes the title when the
 * front matter has none, and is dropped when it only repeats the title. In
 * okf/ a first heading such as "# Decisions" is a section and stays.
 */
export function titleAndBody(source, data, body, override) {
  const h1 = /^\s*# (.+)\r?\n/.exec(body);
  const heading = h1 ? plain(h1[1]) : undefined;
  const title = override ?? data.title ?? heading;
  if (!title) throw new Error(`${source} has neither a title nor a heading.`);
  const isTitle = heading === title || !source.startsWith('okf/');
  return { title, body: h1 && isTitle ? body.slice(h1[0].length) : body };
}

/**
 * Copies the images a page shows next to its copy: inline images and the
 * definitions of full, collapsed and shortcut image references.
 */
function copyImages(source, body, outFile) {
  for (const url of imageUrls(body)) {
    const target = repoTarget(url, source);
    if (!target || url.startsWith('/')) continue;
    const dest = path.resolve(path.dirname(outFile), url);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, target.repoPath), dest);
  }
}

function syncPage(source, outRoot) {
  const page = generatedPage(source);
  const text = readFileSync(path.join(REPO_ROOT, source), 'utf8');
  const { data, body: raw } = splitFrontMatter(text);
  const { title, body } = titleAndBody(source, data, raw, page.title);
  const description =
    page.description ?? data.description ?? firstSentence(body);
  const front = {
    title,
    ...(description ? { description } : {}),
    editUrl: `${GITHUB}/edit/main/${source}`,
    source,
  };
  const outFile = path.join(
    outRoot,
    page.slug.includes('/') ? `${page.slug}.md` : `${page.slug}/index.md`,
  );
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `---\n${stringify(front)}---\n${body}`);
  copyImages(source, body, outFile);
}

function main() {
  const outRoot = path.join(REPO_ROOT, HAND_WRITTEN);
  for (const dir of GENERATED_DIRS)
    rmSync(path.join(outRoot, dir), { recursive: true, force: true });
  const sources = [...markdownFiles('okf'), ...markdownFiles('docs')];
  for (const source of sources) syncPage(source, outRoot);
  console.log(`Synced ${sources.length} pages from okf/ and docs/.`);
}

main();
