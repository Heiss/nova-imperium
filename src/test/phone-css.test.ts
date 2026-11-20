// The phone layout of style.css (#189, D7): rules a browser test found missing.
// The E2E spec e2e/phone-lists.spec.ts measures the page at 360 px; this keeps
// the rule that fixed it where a unit test sees it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../client/static/style.css', import.meta.url),
  'utf8',
);

/** The text between the braces of the block that starts at `open`. */
function block(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('a block is not closed');
}

/** The text of every `@media (max-width: 760px)` block, the phone layout. */
function phoneBlocks(text: string): string[] {
  const head = '@media (max-width: 760px)';
  const found: string[] = [];
  for (let at = text.indexOf(head); at >= 0; at = text.indexOf(head, at + 1))
    found.push(block(text, text.indexOf('{', at)));
  return found;
}

/** The declarations of the rule with exactly this selector in the text, or null. */
function rule(text: string, selector: string): string | null {
  for (
    let at = text.indexOf(selector);
    at >= 0;
    at = text.indexOf(selector, at + 1)
  ) {
    const before = text.slice(0, at).trimEnd();
    const start = text.indexOf('{', at);
    const between = text.slice(at + selector.length, start).trim();
    if (between === '' && (before === '' || /[};]$|\*\/$/.test(before)))
      return block(text, start);
  }
  return null;
}

describe('the ship table of the fleet form on a phone (#189)', () => {
  it('has a count field no wider than 56 px, so four columns fit a 360 px phone', () => {
    const declarations = phoneBlocks(css)
      .map((text) => rule(text, 'input.fs'))
      .find((found) => found !== null);
    expect(declarations, 'a rule `input.fs` in a phone block').toBeDefined();
    const width = /width:\s*(\d+)px/.exec(declarations!);
    expect(width, 'a width in px').not.toBeNull();
    expect(Number(width![1])).toBeLessThanOrEqual(56);
  });
});
