// The colours of the marks „klassisch“ and „neu“ of the round settings (#441,
// owner, 2026-11-28: a coloured tag, bronze and blue [V]): readable on every
// background they stand on, at least 4.5:1 for the small text (WCAG AA).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync('src/client/static/style.css', 'utf8');
const ROOT = CSS.slice(
  CSS.indexOf(':root {'),
  CSS.indexOf('}', CSS.indexOf(':root {')),
);

/** The colour of a token of `:root`. */
const token = (name: string): string =>
  new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(ROOT)![1]!;

/** The relative luminance of a colour (WCAG 2). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('the colours of the marks (#441)', () => {
  it('are bronze and blue, each readable on the page, the box and the head of a table', () => {
    expect(token('mark-classic')).toBe('#cd8a4b');
    expect(token('mark-new')).toBe('#7fb2f0');
    for (const mark of ['mark-classic', 'mark-new'])
      for (const bg of ['bg', 'box', 'box-2'])
        expect(
          contrast(token(mark), token(bg)),
          `${mark} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
  });

  it('colour the tag by its kind, the border with the text', () => {
    expect(CSS).toMatch(/\.mark-classic \{\s*color: var\(--mark-classic\);/);
    expect(CSS).toMatch(/\.mark-new \{\s*color: var\(--mark-new\);/);
    expect(CSS).toMatch(/\.mark \{[^}]*border: 1px solid currentColor;/);
  });
});
