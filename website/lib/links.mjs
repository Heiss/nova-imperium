// Rewrites a link of a page so that it works on the website.
//
// A link is first read the way GitHub reads it in the repository:
//   - in okf/, "/ops/testing.md" is absolute within the OKF bundle;
//   - everywhere else, "/okf/ops/testing.md" is absolute within the
//     repository, and "operations.md" or "../ci.md" are relative to the file.
// The repository path then becomes:
//   - the route of its page (html) or its raw Markdown (raw), when it is a page;
//   - a link to the file on GitHub, when it is any other file of the repository.
// A link to a file that does not exist stops the build.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  GITHUB,
  REPO,
  REPO_ROOT,
  SITE,
  pagePath,
  pageRegistry,
  rawPath,
} from './pages.mjs';

const EXTERNAL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

/** The repository path a link points to, with its hash, or null. */
export function repoTarget(url, source) {
  if (!url || url.startsWith('#') || EXTERNAL.test(url)) return null;
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
  const target = decodeURI(match[1]);
  if (!target) return null;
  let repoPath;
  if (target.startsWith('/'))
    repoPath = source.startsWith('okf/') ? `okf${target}` : target.slice(1);
  else repoPath = path.posix.join(path.posix.dirname(source), target);
  repoPath = path.posix.normalize(repoPath).replace(/\/$/, '');
  if (repoPath.startsWith('..'))
    throw new Error(`${source}: the link "${url}" leaves the repository.`);
  return { repoPath, hash: match[3] ?? '' };
}

/**
 * The new URL of a link or image of `source`, or null to keep it.
 * mode: 'html' for the rendered page, 'raw' for the raw Markdown copy.
 */
export function resolveLink(url, source, { mode, image = false }) {
  const target = repoTarget(url, source);
  if (!target) return null;
  const { repoPath, hash } = target;
  const slug = pageRegistry().get(repoPath);
  if (slug !== undefined) {
    if (mode === 'raw') return `${SITE}${rawPath(slug)}`;
    return `${pagePath(slug)}${hash}`;
  }
  const file = path.join(REPO_ROOT, repoPath);
  if (!existsSync(file))
    throw new Error(`${source}: the link "${url}" points to a missing file.`);
  // An image is copied next to its page (scripts/sync-content.mjs).
  if (image && mode === 'html') return null;
  if (image)
    return `https://raw.githubusercontent.com/${REPO}/main/${repoPath}`;
  const kind = statSync(file).isDirectory() ? 'tree' : 'blob';
  return `${GITHUB}/${kind}/main/${repoPath}${hash}`;
}
