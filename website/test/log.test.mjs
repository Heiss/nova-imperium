// The update log page (#212): built from the entries in okf/log/, one file
// per entry, at the URL okf/log.md had (/decisions/log/), newest first.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { resolveLink } from '../lib/links.mjs';
import { LOG_DIR, LOG_SLUG, sourceText } from '../lib/log.mjs';
import { REPO_ROOT, generatedPage, pageRegistry } from '../lib/pages.mjs';
import { rawMarkdown } from '../lib/raw.mjs';

const PAGE = '/nova-imperium/decisions/log/';
const RAW = 'https://heiss.github.io/nova-imperium/decisions/log.md';
const entries = readdirSync(path.join(REPO_ROOT, LOG_DIR));

describe('the log page', () => {
  it('keeps the URL of okf/log.md', () => {
    assert.equal(LOG_DIR, 'okf/log');
    assert.equal(LOG_SLUG, 'decisions/log');
    assert.equal(generatedPage(LOG_DIR).slug, LOG_SLUG);
  });

  it('is one page: every entry belongs to it, none is a page of its own', () => {
    assert.ok(entries.length > 0);
    const registry = pageRegistry();
    assert.equal(registry.get(LOG_DIR), LOG_SLUG);
    for (const name of entries)
      assert.equal(registry.get(`${LOG_DIR}/${name}`), LOG_SLUG, name);
    const slugs = [...registry.values()].filter((s) =>
      s.startsWith(`${LOG_SLUG}/`),
    );
    assert.deepEqual(slugs, []);
  });

  it('is linked from the bundle, the entries and the guide pages', () => {
    const html = { mode: 'html' };
    assert.equal(resolveLink('/log/', 'okf/index.md', html), PAGE);
    assert.equal(resolveLink('/log', 'okf/index.md', html), PAGE);
    assert.equal(
      resolveLink('/log/#2026-11-14', 'okf/ops/loop.md', html),
      `${PAGE}#2026-11-14`,
    );
    assert.equal(resolveLink(`/log/${entries[0]}`, 'okf/index.md', html), PAGE);
    assert.equal(
      resolveLink(
        '/okf/log/',
        'website/src/content/docs/contributing.md',
        html,
      ),
      PAGE,
    );
    assert.equal(resolveLink('/log/', 'okf/index.md', { mode: 'raw' }), RAW);
  });

  it('shows the entries newest first under one heading per date', () => {
    const text = sourceText(LOG_DIR);
    assert.match(text, /^# Update log\n\n## \d{4}-\d{2}-\d{2}\n\n\* \*\*/);
    const dates = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(dates, [...dates].sort().reverse());
    assert.equal(new Set(dates).size, dates.length);
    assert.equal(text.match(/^\* /gm).length, entries.length);
  });

  it('resolves the links of the entries like those of okf/log.md', () => {
    const raw = rawMarkdown(LOG_DIR);
    assert.match(
      raw,
      /\]\(https:\/\/heiss\.github\.io\/nova-imperium\/decisions\/ops\/testing\.md\)/,
    );
    assert.doesNotMatch(raw, /\]\(\/[a-z]/);
  });

  it('reads every other page from its file', () => {
    assert.match(sourceText('okf/index.md'), /^---\nokf_version/);
  });
});
