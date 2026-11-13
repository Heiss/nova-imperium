// The rendered pages: the Markdown plugin of the site (lib/markdown.mjs) run
// through the same Sätteri as Astro uses.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { novaMarkdown } from '../lib/markdown.mjs';
import { REPO_ROOT } from '../lib/pages.mjs';

// satteri is a dependency of @astrojs/markdown-satteri, not of the site.
const require = createRequire(import.meta.resolve('@astrojs/markdown-satteri'));
const { markdownToHtml } = await import(
  pathToFileURL(require.resolve('satteri')).href
);

// A page in docs/; LICENSE is a file of the repository without an extension.
const fileURL = pathToFileURL(path.join(REPO_ROOT, 'docs', 'page.md'));
const render = async (markdown) =>
  (await markdownToHtml(markdown, { mdastPlugins: [novaMarkdown], fileURL }))
    .html;

test('an image reference keeps a definition without an extension relative', async () => {
  for (const ref of ['![x][d]', '![d][]', '![d]'])
    assert.match(
      await render(`${ref}\n\n[d]: ../LICENSE\n`),
      /<img src="\.\.\/LICENSE"/,
      ref,
    );
});

test('a link reference to the same file goes to GitHub', async () => {
  assert.match(
    await render('[x][d]\n\n[d]: ../LICENSE\n'),
    /<a href="https:\/\/github\.com\/[^"]+\/blob\/main\/LICENSE">/,
  );
});

test('an inline image without an extension stays relative', async () => {
  assert.match(await render('![x](../LICENSE)\n'), /<img src="\.\.\/LICENSE"/);
});
