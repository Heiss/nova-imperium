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
 * The attributes of a tag in order, a boolean one and `data-nokeep` (which
 * main.ts reads by its presence) without their empty value, and without an
 * empty `class`, which Svelte leaves out (#118, bundles 1 and 2).
 */
function attributes(raw: string): string {
  const list = [...raw.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)]
    .filter(([, name, quoted]) => !(name === 'class' && quoted === ''))
    .map(([, name, quoted]) =>
      quoted === undefined ||
      (quoted === '' && /^(disabled|hidden|selected|data-nokeep)$/.test(name!))
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
      / ?(<\/?(?:div|p|ul|li|h2|table|tr|td|br)\b(?:"[^"]*"|[^">])*>) ?/g,
      '$1',
    );
  // Only entities that cannot start a tag or another entity are decoded.
  return decodeText(tags).trim();
}
