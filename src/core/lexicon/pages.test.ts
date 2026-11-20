// The guards of the rule pages, the questions and the guides (#288, #289):
// no number is typed into a text, every value is filled from the rules for
// every state, every link has a target, every formula agrees with its rule,
// every setting of the universe and of the round has its row, and no classic
// name appears. A page that is not listed or a number that is typed turns the
// CI red.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STATES } from '../../test/lexicon-states.ts';
import { classicIn } from '../../test/naming.ts';
import { ROUND_SETTINGS } from '../round.ts';
import { UNIVERSE_SPECS } from '../universe.ts';
import { article, ARTICLES } from './articles.ts';
import { pageParts } from './docs.ts';
import { fill, linkTargets, valueNames } from './links.ts';
import { PAGES } from './pages/index.ts';
import type { Block, Cell, Formula, LexState, PageDef } from './types.ts';

const blocksOf = (p: PageDef, s: LexState): Block[] =>
  p.sections(s).flatMap((x) => x.blocks);

/** Every (page, state) pair the guards run on. */
const CASES = PAGES.flatMap((p) =>
  [...STATES, ...(p.review ?? [])].map((s) => ({ p, s })),
);

const cellLinks = (c: Cell): string[] =>
  typeof c === 'object' ? [c.link] : [];

/** The articles a block links to. */
function targetsOf(b: Block): string[] {
  if (b.t === 'text') return linkTargets(fill(b.text, b.values));
  if (b.t === 'links') return b.items.map((i) => i.id);
  if (b.t === 'table') return b.rows.flatMap((r) => r.cells.flatMap(cellLinks));
  return [];
}

/** Checks a formula against its rule on every sample, and its shown line. */
function checkFormula(id: string, f: Formula, line: string | undefined): void {
  expect(line, id).toBe(fill(f.text, f.values));
  expect(line, id).not.toMatch(/\{\w+\}/);
  // At least one sample, each with at least a value for every parameter of the function.
  expect(f.samples.length, `${id}: ${f.text}`).toBeGreaterThan(0);
  for (const x of f.samples) {
    expect(x.length, `${id}: ${f.text}`).toBeGreaterThanOrEqual(f.fn.length);
    expect(f.fn(...x), `${id}: ${f.text} at ${x}`).toBeCloseTo(f.rule(...x), 9);
  }
}

/** A text block holds no digit, and its values fill every placeholder. */
function checkText(id: string, b: Block): void {
  if (b.t !== 'text') return;
  expect(b.text, id).not.toMatch(/\d/);
  for (const name of valueNames(b.text))
    expect(b.values?.[name], `${id}: {${name}}`).toBeDefined();
  expect(fill(b.text, b.values), id).not.toMatch(/\{\w+\}/);
}

/** The words of a block that a player reads, each one apart. */
function wordsOf(b: Block): string[] {
  switch (b.t) {
    case 'text':
      return [fill(b.text, b.values)];
    case 'formula':
      return b.lines;
    case 'stand':
      return [b.text];
    case 'chips':
    case 'facts':
      return b.items.flatMap((i) => [i.label, i.text]);
    case 'table':
      return [
        ...(b.caption === undefined ? [] : [b.caption]),
        ...b.head,
        ...b.rows.flatMap((r) =>
          r.cells.flatMap((c) =>
            typeof c === 'number' ? [] : [typeof c === 'string' ? c : c.text],
          ),
        ),
      ];
    case 'links':
      return [];
  }
}

const rank = (kind: PageDef['kind']): number =>
  ({ rule: 0, question: 1, guide: 2 })[kind];

describe('the written pages of the Lexicanum (#288, #289)', () => {
  it('lists every file of the folder once, with its own address', () => {
    const files = readdirSync('src/core/lexicon/pages').filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'),
    );
    expect(PAGES).toHaveLength(files.length);
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    const prefix = { rule: 'rule-', question: 'faq-', guide: 'guide-' };
    for (const p of PAGES) {
      expect(p.id.startsWith(prefix[p.kind]), p.id).toBe(true);
      expect(article(p.id)?.page, p.id).toBe(p);
    }
    // Rules first, then the questions, then the guides, as the review list has them.
    const order = PAGES.map((p) => p.kind);
    expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
  });

  it('types no number into a text, a heading or a line, and fills every value', () => {
    for (const { p, s } of CASES) {
      expect(p.line, p.id).not.toMatch(/\d/);
      for (const x of p.sections(s)) expect(x.title, p.id).not.toMatch(/\d/);
      for (const b of blocksOf(p, s)) checkText(p.id, b);
    }
  });

  it('has no empty name: every page has an address, a title, a line and keywords', () => {
    for (const p of PAGES) {
      for (const text of [p.id, p.title, p.line])
        expect(text.trim(), p.id).not.toBe('');
      expect(p.keywords.length, p.id).toBeGreaterThan(0);
      for (const k of p.keywords) expect(k.trim(), p.id).not.toBe('');
    }
  });

  it('has no empty word: every section, section address, heading, caption, label and cell says something', () => {
    for (const { p, s } of CASES)
      for (const x of p.sections(s)) {
        expect(x.id.trim(), p.id).not.toBe('');
        expect(x.title.trim(), p.id).not.toBe('');
        expect(x.blocks.length, `${p.id}: ${x.id}`).toBeGreaterThan(0);
        for (const b of x.blocks)
          for (const w of wordsOf(b))
            expect(w.trim(), `${p.id}: ${x.id}`).not.toBe('');
      }
  });

  it('links only to articles that exist', () => {
    let n = 0;
    for (const { p, s } of CASES) {
      const targets = [
        ...(p.seeAlso ?? []),
        ...blocksOf(p, s).flatMap(targetsOf),
      ];
      for (const id of targets) {
        expect(article(id), `${p.id} → ${id}`).toBeDefined();
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('agrees with the rule in every formula (B8) and shows it as it is', () => {
    let n = 0;
    for (const { p, s } of CASES)
      for (const b of blocksOf(p, s)) {
        if (b.t !== 'formula') continue;
        expect(b.of, p.id).toHaveLength(b.lines.length);
        b.of!.forEach((f, i) => checkFormula(p.id, f, b.lines[i]));
        n += b.of!.length;
      }
    expect(n).toBeGreaterThan(40);
  });

  it('has tables whose rows fit their head and sections with an address each', () => {
    for (const { p, s } of CASES) {
      const ids = p.sections(s).map((x) => x.id);
      expect(new Set(ids).size, p.id).toBe(ids.length);
      for (const b of blocksOf(p, s)) {
        if (b.t !== 'table') continue;
        expect(b.rows.length, `${p.id}: ${b.caption}`).toBeGreaterThan(0);
        for (const r of b.rows)
          expect(r.cells.length, `${p.id}: ${b.caption}`).toBe(b.head.length);
      }
    }
  });

  it('says no classic name in its words and keywords', () => {
    for (const p of PAGES)
      for (const k of p.keywords) {
        expect(k, p.id).toMatch(/^\p{L}+$/u);
        expect(classicIn(k), `${p.id}: ${k}`).toEqual([]);
      }
    for (const { p, s } of CASES)
      for (const part of pageParts(p, s))
        expect(classicIn(part.text), `${p.id}: ${part.text}`).toEqual([]);
  });

  it('is found as an article of its kind, below the entries and missions', () => {
    for (const p of PAGES) {
      const a = ARTICLES.find((x) => x.id === p.id)!;
      expect(a.kind).toBe(p.kind);
      expect(a.title).toBe(p.title);
      expect(a.ds).toBe(p.line);
    }
    const first = ARTICLES.findIndex((a) => a.page);
    expect(ARTICLES.slice(first).every((a) => a.page)).toBe(true);
  });
});

/** The table cells of every table of a page, as text. */
const cellsOf = (p: PageDef, s: LexState): string[] =>
  blocksOf(p, s).flatMap((b) =>
    b.t === 'table'
      ? b.rows.flatMap((r) =>
          r.cells.map((c) => (typeof c === 'object' ? c.text : String(c))),
        )
      : [],
  );

/** The cell `at` places after the first cell with this text. */
const after = (all: string[], label: string, at: number): string =>
  all[all.indexOf(label) + at]!;

describe('„Dieses Universum“ lists every setting (#288)', () => {
  const universe = PAGES.find((p) => p.id === 'rule-universe')!;

  it('has a row for every setting of the universe and of the round', () => {
    const cells = new Set(cellsOf(universe, STATES[0]!));
    for (const spec of UNIVERSE_SPECS) expect(cells.has(spec.label)).toBe(true);
    for (const setting of ROUND_SETTINGS)
      expect(cells.has(setting.label), setting.name).toBe(true);
  });

  it('shows the value of this universe and of this round, and the default', () => {
    const [defaults, other] = STATES;
    const a = cellsOf(universe, defaults!);
    const b = cellsOf(universe, other!);
    // The speed of the other state is 40, the default 5.
    expect(after(a, 'Tempo (Faktor)', 1)).toBe('5');
    expect(after(b, 'Tempo (Faktor)', 1)).toBe('40');
    expect(after(b, 'Tempo (Faktor)', 2)).toBe('5');
    // A switch of the round is shown as yes or no, the other way round in the other state.
    expect(after(a, 'Achievements aktivieren', 1)).toBe('ja');
    expect(after(b, 'Achievements aktivieren', 1)).toBe('nein');
    expect(after(b, 'Achievements aktivieren', 2)).toBe('ja');
  });
});
