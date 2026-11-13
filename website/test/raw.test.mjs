// The raw Markdown copies (lib/raw.mjs) and the images copied next to the
// pages (scripts/sync-content.mjs). Uses real files of the repository:
// okf/ops/branching-release.md shows okf/ops/release-flow.svg and links
// okf/ops/testing.md.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { imageUrls, rewriteRaw } from '../lib/raw.mjs';

const SOURCE = 'okf/ops/branching-release.md';
const PAGE = 'https://heiss.github.io/nova-imperium/decisions/ops/testing.md';
const IMAGE =
  'https://raw.githubusercontent.com/Heiss/nova-imperium/main/okf/ops/release-flow.svg';

describe('rewriteRaw', () => {
  it('rewrites an image inside a link and the link itself', () => {
    assert.equal(
      rewriteRaw('See [![Flow](release-flow.svg)](testing.md).\n', SOURCE),
      `See [![Flow](${IMAGE})](${PAGE}).\n`,
    );
  });

  it('rewrites several links of a line from the last to the first', () => {
    assert.equal(
      rewriteRaw('[a](testing.md) and [b](/ops/testing.md#x)\n', SOURCE),
      `[a](${PAGE}) and [b](${PAGE})\n`,
    );
  });

  it('finds destinations in angle brackets and after whitespace', () => {
    assert.equal(
      rewriteRaw('[a](<testing.md>) [b]( testing.md "T")\n', SOURCE),
      `[a](<${PAGE}>) [b]( ${PAGE} "T")\n`,
    );
  });

  it('rewrites definitions, also in angle brackets', () => {
    assert.equal(
      rewriteRaw(
        '[a][t] ![f][i]\n\n[t]: <testing.md>\n[i]: release-flow.svg\n',
        SOURCE,
      ),
      `[a][t] ![f][i]\n\n[t]: <${PAGE}>\n[i]: ${IMAGE}\n`,
    );
  });

  it('keeps external links, anchors and code unchanged', () => {
    const text =
      '[a](https://example.org/x.md) [b](#top)\n\n```md\n[c](testing.md)\n```\n';
    assert.equal(rewriteRaw(text, SOURCE), text);
  });
});

describe('imageUrls', () => {
  it('lists inline images and full, collapsed and shortcut references', () => {
    const text = [
      '![inline](a.svg) ![full][f] ![collapsed][] ![shortcut]',
      '',
      '[f]: ./full.png',
      '[collapsed]: <collapsed.svg>',
      '[shortcut]: shortcut.webp "Title"',
      '[link]: testing.md',
    ].join('\n');
    assert.deepEqual(imageUrls(text).sort(), [
      './full.png',
      'a.svg',
      'collapsed.svg',
      'shortcut.webp',
    ]);
  });

  it('counts a definition used by an image reference whatever its name', () => {
    assert.deepEqual(imageUrls('![x][d]\n\n[d]: diagram\n'), ['diagram']);
  });
});
