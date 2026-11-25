// Links and values in the texts of the Lexicanum (#285, B7): [[id]] or
// [[id|text]] points to an article, {name} is a value from the rules.

/** A piece of a text: plain words, or a link to an article. */
export type Segment = { text: string } | { text: string; link: string };

const VALUE = /\{(\w+)\}/g;

/** A link of a text: where it starts and ends, its id and its own text. */
interface Link {
  start: number;
  end: number;
  id: string;
  text?: string;
}

/**
 * Where the leftmost link of <part> starts, or -1. <part> holds no „]“ and
 * a „]]“ follows it: the link is „[[“, then the id, neither empty nor
 * starting with „|“, and then perhaps „|“ and a text that is not empty
 * (#285).
 */
function linkStart(part: string): number {
  // The id starts before the end of <part>; when <part> ends with „|“, it
  // starts before another „|“, or the text after the id would be empty.
  const limit = part.endsWith('|')
    ? part.lastIndexOf('|', part.length - 2)
    : part.length;
  for (
    let at = part.indexOf('[[');
    at >= 0 && at + 2 < limit;
    at = part.indexOf('[[', at + 1)
  )
    if (part[at + 2] !== '|') return at;
  return -1;
}

/**
 * The links of a text in order, as /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
 * finds them: a link ends at the first „]“ after its „[[“, and a second „]“
 * must follow. The text is read once from the left; that expression tried
 * every „[[“ up to the next „]“ again and took quadratic time on a text of
 * many „[[“ without „]]“ (#367).
 */
function links(text: string): Link[] {
  const out: Link[] = [];
  let from = 0;
  for (let close = text.indexOf(']'); close >= 0;) {
    const part = text.slice(from, close);
    const at = text[close + 1] === ']' ? linkStart(part) : -1;
    if (at >= 0) {
      const [id, ...rest] = part.slice(at + 2).split('|');
      const own = rest.length > 0 ? { text: rest.join('|') } : {};
      out.push({ start: from + at, end: close + 2, id: id!, ...own });
    }
    // After a link its second „]“ starts the next part, which is empty.
    from = close + 1;
    close = text.indexOf(']', from);
  }
  return out;
}

/** The ids of the articles a text links to, in order. */
export const linkTargets = (text: string): string[] =>
  links(text).map((l) => l.id);

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
  for (const l of links(text)) {
    if (l.start > at) out.push({ text: text.slice(at, l.start) });
    out.push({ text: l.text ?? title(l.id) ?? l.id, link: l.id });
    at = l.end;
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
