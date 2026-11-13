// Which file of the repository becomes which page of the site.
//
// okf/ and docs/ stay the only source of their pages (okf/ops/website.md):
// scripts/sync-content.mjs copies them into the generated folders below
// before every build, and the hand-written guide pages live in
// src/content/docs/*.md. Every page has one source path in the repository;
// links are resolved against it (lib/links.mjs).
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const REPO = 'Heiss/nova-imperium';
export const SITE = 'https://heiss.github.io';
export const BASE = '/nova-imperium';
export const SITE_URL = `${SITE}${BASE}/`;
export const GITHUB = `https://github.com/${REPO}`;

/**
 * The root of the repository: the nearest folder above the working directory
 * that holds okf/index.md. Not taken from import.meta.url, because Astro
 * bundles this module into dist/ for the prerendered routes.
 */
function findRepoRoot() {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, 'okf/index.md'))) return dir;
    if (path.dirname(dir) === dir)
      throw new Error('Run the website build inside the repository.');
  }
}
export const REPO_ROOT = findRepoRoot();
/** Where the hand-written pages live, relative to the repository. */
export const HAND_WRITTEN = 'website/src/content/docs';
/** Folders below src/content/docs that scripts/sync-content.mjs fills. */
export const GENERATED_DIRS = [
  'decisions',
  'getting-started',
  'contributing',
  'operations',
];

/**
 * The pages from docs/: slug, description (docs/ has no front matter, since
 * GitHub shows it as a table) and, where the first heading would repeat the
 * name of its section, a title of its own. A file of docs/ that is not here
 * and not a design draft stops the build, so every new page gets a place.
 */
const DOCS_PAGES = {
  'docs/getting-started.md': {
    slug: 'getting-started/installation',
    title: 'Install a server',
    description:
      'Install the game on a server with Docker Compose, invite the first player, make the first admin, or try the demo on your machine.',
  },
  'docs/development.md': {
    slug: 'getting-started/development',
    description:
      'Run the game from source with Node.js and pnpm: the layout of the repository, every check as a command, migrations and changelog fragments.',
  },
  'docs/operations.md': {
    slug: 'operations',
    description:
      'Run a server: reverse proxy, operator commands, maintenance, backup and restore, releases, updates and rollback, account security, hardening, diagnostics and the error log.',
  },
  'docs/configuration.md': {
    slug: 'operations/configuration',
    description:
      'Every setting of the game server, its default and range: environment variables in .env, secrets from files, Compose-only settings and the universe settings.',
  },
};
const DESIGN_DRAFT = /^docs\/design\/([^/]+)\/README\.md$/;

/** Slug, title and description overrides of a file of okf/ or docs/. */
export function generatedPage(source) {
  if (source === 'okf/index.md')
    return {
      slug: 'decisions',
      title: 'Decisions',
      description:
        'The decisions of the project as an OKF bundle: architecture, features, security and operations, each marked as decision, proposal or unverified.',
    };
  if (source.startsWith('okf/') && source.endsWith('.md'))
    return { slug: `decisions/${source.slice(4, -3)}` };
  if (DOCS_PAGES[source]) return DOCS_PAGES[source];
  const draft = DESIGN_DRAFT.exec(source);
  if (draft) return { slug: `contributing/design/${draft[1]}` };
  if (source.startsWith('docs/') && source.endsWith('.md'))
    throw new Error(
      `${source} has no place on the website: add it to DOCS_PAGES in website/lib/pages.mjs.`,
    );
  return null;
}

/** Every Markdown file below a folder of the repository, as repo paths. */
export function markdownFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(path.join(REPO_ROOT, rel)).sort()) {
      const child = `${rel}/${name}`;
      if (statSync(path.join(REPO_ROOT, child)).isDirectory()) walk(child);
      else if (name.endsWith('.md')) out.push(child);
    }
  };
  walk(dir);
  return out;
}

/** The slug of a hand-written page from its repo path. */
function handWrittenSlug(source) {
  const rel = source.slice(HAND_WRITTEN.length + 1).replace(/\.mdx?$/, '');
  return rel === 'index' ? '' : rel.replace(/\/index$/, '');
}

let registry;
/** Map of repo path → slug ('' is the home page) of every page of the site. */
export function pageRegistry() {
  if (registry) return registry;
  registry = new Map();
  for (const source of [...markdownFiles('okf'), ...markdownFiles('docs')])
    registry.set(source, generatedPage(source).slug);
  for (const name of readdirSync(path.join(REPO_ROOT, HAND_WRITTEN)).sort()) {
    if (GENERATED_DIRS.includes(name) || !/\.mdx?$/.test(name)) continue;
    const source = `${HAND_WRITTEN}/${name}`;
    registry.set(source, handWrittenSlug(source));
  }
  return registry;
}

/** The URL path of a page: /nova-imperium/<slug>/ */
export const pagePath = (slug) => (slug ? `${BASE}/${slug}/` : `${BASE}/`);
/** The raw Markdown of a page: /nova-imperium/<slug>.md, index.md for home. */
export const rawPath = (slug) => `${BASE}/${slug || 'index'}.md`;
