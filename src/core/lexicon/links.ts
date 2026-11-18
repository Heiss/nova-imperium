// Links and values in the texts of the Lexicanum (#285, B7): [[id]] or
// [[id|text]] points to an article, {name} is a value from the rules.

/** A piece of a text: plain words, or a link to an article. */
export type Segment = { text: string } | { text: string; link: string };

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const VALUE = /\{(\w+)\}/g;

/** The ids of the articles a text links to, in order. */
export const linkTargets = (text: string): string[] =>
  [...text.matchAll(LINK)].map((m) => m[1]!);

/** The names of the values a text holds, in order. */
export const valueNames = (text: string): string[] =>
  [...text.matchAll(VALUE)].map((m) => m[1]!);

/**
 * The text with its values filled in; a value without an entry stays as it
 * is, so the guard finds it.
 */
export const fill = (
  text: string,
  values: Readonly<Record<string, string>> = {},
): string =>
  text.replace(VALUE, (all, name: string) =>
    Object.hasOwn(values, name) ? values[name]! : all,
  );

/**
 * The pieces of a text; a link without its own text shows the title of its
 * target, or its id when there is none.
 */
export function segments(
  text: string,
  title: (id: string) => string | undefined,
): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    const id = m[1]!;
    out.push({ text: m[2] ?? title(id) ?? id, link: id });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The text as it reads, without the link marks (for the search). */
export const plain = (
  text: string,
  title: (id: string) => string | undefined,
): string =>
  segments(text, title)
    .map((s) => s.text)
    .join('');
