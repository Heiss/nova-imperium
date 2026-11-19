// Builders for the pages of stages 2 and 3 of the Lexicanum (#288, #289):
// a text with its values, a formula that a test compares with its rule, a
// table, the facts of a rule. A page names no number in its words: a value
// comes in through a `{name}` that its values fill from the rules, so a
// setting the admin changes per round changes the page.
import { BUILD, DEF, RES, SHIPS } from '../catalog.ts';
import { text as entryText } from '../text.ts';
import { fill } from './links.ts';
import { number, percent } from './parts.ts';
import type { Block, Cell, Formula, PageSection } from './types.ts';

export { number, percent };

/** A paragraph; `values` fill its `{name}` placeholders. */
export const say = (
  text: string,
  values?: Readonly<Record<string, string>>,
): Block => (values ? { t: 'text', text, values } : { t: 'text', text });

/** A formula block; every formula is compared with its rule by the guards (B8). */
export const formulas = (...list: Formula[]): Block => ({
  t: 'formula',
  lines: list.map((f) => fill(f.text, f.values)),
  of: list,
});

/** A computed table. */
export const table = (
  caption: string,
  head: string[],
  rows: readonly (readonly Cell[])[],
  mark?: (i: number) => boolean,
): Block => ({
  t: 'table',
  caption,
  head,
  rows: rows.map((cells, i) =>
    mark?.(i) ? { cells: [...cells], mark: true } : { cells: [...cells] },
  ),
});

/** Labelled facts, each with a value computed from the rules. */
export const facts = (items: readonly [string, string][]): Block => ({
  t: 'facts',
  items: items.map(([label, text]) => ({ label, text })),
});

/** The name of a catalog entry, for a table or a text. */
export const nameOf = (key: string): string => entryText(key)?.n ?? key;

/** A section of a page. */
export const section = (
  id: string,
  title: string,
  ...blocks: Block[]
): PageSection => ({ id, title, blocks });

/** A number with its unit in the singular or the plural: „1 Stunde“, „48 Stunden“. */
export const count = (n: number, one: string, many: string): string =>
  `${number(n)} ${n === 1 ? one : many}`;

/** „1 Stunde“, „48 Stunden“: a value of a text with its unit. */
export const hours = (n: number): string => count(n, 'Stunde', 'Stunden');
export const days = (n: number): string => count(n, 'Tag', 'Tage');
export const minutes = (n: number): string => count(n, 'Minute', 'Minuten');

/** A duration as the pages show it: „1 Std. 5 Min.“, „4 Min. 10 Sek.“, „12 Sek.“. */
export function duration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${number(h)} Std. ${m} Min.`;
  if (m > 0) return `${m} Min. ${sec} Sek.`;
  return `${sec} Sek.`;
}

/** The steps of a question or a guide: one fact each, „Schritt 1“ and so on. */
export const steps = (...texts: string[]): Block => ({
  t: 'facts',
  items: texts.map((step, i) => ({ label: `Schritt ${i + 1}`, text: step })),
});

/**
 * What an entry of the catalog needs, as a link list for a text: „[[lab]]
 * Stufe 3“; empty for an entry without requirements.
 */
export const requires = (key: string): string => {
  const req = (BUILD[key] ?? RES[key] ?? SHIPS[key] ?? DEF[key])?.req;
  const link = (id: string, level: number): string =>
    `[[${id}|${entryText(id)?.n ?? id}]] Stufe ${level}`;
  return [
    ...Object.entries(req?.b ?? {}).map(([id, l]) => link(id, l)),
    ...Object.entries(req?.r ?? {}).map(([id, l]) => link(id, l)),
  ].join(', ');
};
