// The markup as a browser shows it, for the reference tests of #118
// (src/test/catalog-list-reference.test.ts, overview-reference.test.ts,
// frame-reference.test.ts): without Svelte's comments (and the empty marker
// `<!>` it writes for `{@html}` in a select) and an empty class,
// with the attributes of a tag in order, without
// the <tbody> a table gets anyway and the white space next to a block or a
// line break, and with >, " and ' decoded. An escaped < and & stay escaped,
// so a name shown as text never equals the same name as markup (#209). In an
// attribute value an escaped " stays escaped, so it never looks like the end
// of the value and the start of another attribute (CodeRabbit on #210).
const ENTITY: Record<string, string> = {
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** A value of an attribute with > and ' decoded; an escaped " stays. */
const value = (raw: string): string =>
  raw.replace(/&(?:gt|#39);/g, (e) => ENTITY[e]!);

/**
 * The attributes that count by their presence: the boolean ones, `data-nokeep`
 * (which main.ts reads) and the marks of the achievements (features/
 * achievements.ts and the phone layout of style.css select them), written
 * without a value in the HTML views and with an empty one by Svelte (#118,
 * bundle 5).
 */
const BOOLEAN =
  /^(disabled|hidden|selected|checked|required|data-nokeep|data-achievement|data-achievement-group|data-later|data-all|data-daily-reward)$/;

/**
 * The attributes of a tag in order, a boolean one and `data-nokeep` (which
 * main.ts reads by its presence) without their empty value, and without an
 * empty `class`, which Svelte leaves out (#118, bundles 1 and 2).
 */
function attributes(raw: string): string {
  const list = [...raw.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)]
    .filter(([, name, quoted]) => !(name === 'class' && quoted === ''))
    .map(([, name, quoted]) =>
      quoted === undefined || (quoted === '' && BOOLEAN.test(name!))
        ? name!
        : `${name}="${value(quoted)}"`,
    );
  return list.length ? ' ' + list.sort().join(' ') : '';
}

/** Removes comments until none is left, so no `<!--` can survive. */
export function stripComments(html: string): string {
  let before: string;
  let after = html;
  do {
    before = after;
    after = before.replace(/<!--[\s\S]*?-->/g, '');
  } while (after !== before);
  return after;
}

/**
 * Decodes >, " and ' in the text between the tags. A tag, its attributes
 * already in order (a value may hold a >), is passed over as it is.
 */
const decodeText = (html: string): string =>
  html.replace(
    /(<\/?[a-z][a-z0-9]*(?:\s+[^\s=>"]+(?:="[^"]*")?)*\s*>)|&(?:gt|quot|#39);/gi,
    (match, tag?: string) => tag ?? ENTITY[match]!,
  );

const VOID = new Set([
  'area',
  'br',
  'col',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'wbr',
]);

/** The end of the tag that starts at `from`; a `>` inside a quoted value does not end it. */
function tagEnd(html: string, from: number): number {
  let quote = '';
  for (let i = from + 1; i < html.length; i++) {
    const c = html[i]!;
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
  }
  return html.length - 1;
}

/** The text between the tags with the entities of the markup decoded (& last). */
const decodeEntities = (text: string): string =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

/** The elements that hold others in blocks: the white space between them is layout. */
const BLOCK = /^(div|p|ul|ol|li|table|tr|td|th|h[1-6]|form|section|fieldset)$/;

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'open'; tag: string; closed: boolean }
  | { kind: 'close'; tag: string }
  | { kind: 'skip' };

/** A tag without its brackets: an end tag, a start tag, or what is no element (`<!>`). */
function tagToken(raw: string): Token {
  if (raw.startsWith('/'))
    return { kind: 'close', tag: raw.slice(1).trim().toLowerCase() };
  const tag = /^[a-z][a-z0-9]*/i.exec(raw)?.[0]?.toLowerCase();
  if (tag === undefined) return { kind: 'skip' };
  return { kind: 'open', tag, closed: VOID.has(tag) || raw.endsWith('/') };
}

/** The token at `from` and where the next one starts; a comment gives none. */
function tokenAt(html: string, from: number): [Token | null, number] {
  if (html[from] !== '<') {
    const lt = html.indexOf('<', from);
    const stop = lt < 0 ? html.length : lt;
    return [{ kind: 'text', text: html.slice(from, stop) }, stop];
  }
  if (html.startsWith('<!--', from)) {
    const comment = html.indexOf('-->', from);
    return [null, comment < 0 ? html.length : comment + 3];
  }
  const end = tagEnd(html, from);
  return [tagToken(html.slice(from + 1, end)), end + 1];
}

/** The text and the tags of the markup in order; a comment is dropped. */
function tokens(html: string): Token[] {
  const found: Token[] = [];
  for (let i = 0; i < html.length;) {
    const [token, next] = tokenAt(html, i);
    if (token) found.push(token);
    i = next;
  }
  return found;
}

interface Element {
  tag: string;
  text: string;
  leaf: boolean;
}

/** The elements of the markup in order, with those still open. */
class Elements {
  readonly all: Element[] = [];
  private readonly open: Element[] = [];

  text(raw: string): void {
    const text = decodeEntities(raw).replace(/\s+/g, ' ');
    for (const o of this.open) o.text += text;
  }

  close(tag: string): void {
    const from = this.open.map((o) => o.tag).lastIndexOf(tag);
    if (from >= 0) this.open.length = from;
  }

  start(tag: string, closed: boolean): void {
    if (BLOCK.test(tag)) for (const o of this.open) o.leaf = false;
    const element = { tag, text: '', leaf: true };
    this.all.push(element);
    if (!closed) this.open.push(element);
  }
}

/**
 * What a script that reads `textContent` sees (#118, bundles 1 to 6): one
 * entry `tag: text` per element in document order, the text of the element
 * and all below it, entities decoded, a run of white space as one space (the
 * indentation of a template is no text a person sees), but nothing trimmed.
 * normalize() drops the white space next to a block tag, so it cannot see a
 * space at the end of an `<li>` or a `<td>`; this does. Only elements without
 * a block below them are listed (a text field, a cell, a line, a heading,
 * a button): what lies between two blocks is layout, and a test reads the
 * elements. A `<br>` adds nothing, as in the DOM.
 */
export function textContents(html: string): string[] {
  const elements = new Elements();
  for (const token of tokens(html)) {
    if (token.kind === 'text') elements.text(token.text);
    else if (token.kind === 'close') elements.close(token.tag);
    else if (token.kind === 'open') elements.start(token.tag, token.closed);
  }
  return elements.all.filter((e) => e.leaf).map((e) => `${e.tag}: ${e.text}`);
}

/** The markup as a browser shows it. */
export function normalize(html: string): string {
  const tags = stripComments(html)
    .replace(/<\/?tbody>/g, '')
    .replaceAll('<!>', '')
    .replace(
      /<([a-z][a-z0-9]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>/g,
      (_, tag: string, attrs: string) => `<${tag}${attributes(attrs)}>`,
    )
    .replace(/\s+/g, ' ')
    .replace(
      / ?(<\/?(?:div|p|ul|li|h2|h3|table|tr|td|br|form|fieldset|legend)\b(?:"[^"]*"|[^">])*>) ?/g,
      '$1',
    );
  // Only entities that cannot start a tag or another entity are decoded.
  return decodeText(tags).trim();
}
