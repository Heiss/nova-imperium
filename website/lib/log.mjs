// The update log page (owner, 2026-11-15, #212): every entry is a file
// okf/log/<date>-<short-name>.md, and the page at the URL okf/log.md had
// (/decisions/log/) is built from the folder, newest first. The entries are
// read and checked by scripts/okf-log.ts, the same code as the check in
// `pnpm check` and the CI, so a malformed entry also stops the build.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logMarkdown, readLog } from '../../scripts/okf-log.ts';
import { LOG_DIR, REPO_ROOT } from './pages.mjs';

export { LOG_DIR, LOG_SLUG } from './pages.mjs';

/** The Markdown of a page: the built log page, else the file itself. */
export function sourceText(source) {
  if (source === LOG_DIR)
    return logMarkdown(readLog(path.join(REPO_ROOT, LOG_DIR)));
  return readFileSync(path.join(REPO_ROOT, source), 'utf8');
}
