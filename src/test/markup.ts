// The markup as a browser shows it, for the reference tests of #118
// (src/test/catalog-list-reference.test.ts, overview-reference.test.ts):
// without Svelte's comments, with the attributes of a tag in order, without
// the <tbody> a table gets anyway and the white space next to a block or a
// line break, and with >, " and ' decoded. An escaped < and & stay escaped,
// so a name shown as text never equals the same name as markup (#209).
const ENTITY: Record<string, string> = {
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** The attributes of a tag in order, a boolean one without its empty value. */
function attributes(raw: string): string {
  const list = [...raw.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(
    ([, name, value]) =>
      value === undefined || (value === '' && /^(disabled|hidden)$/.test(name!))
        ? name!
        : `${name}="${value}"`,
  );
  return list.length ? ' ' + list.sort().join(' ') : '';
}

/** Removes comments until none is left, so no `<!--` can survive. */
function stripComments(html: string): string {
  let before: string;
  let after = html;
  do {
    before = after;
    after = before.replace(/<!--[\s\S]*?-->/g, '');
  } while (after !== before);
  return after;
}

/** The markup as a browser shows it. */
export function normalize(html: string): string {
  return (
    stripComments(html)
      .replace(/<\/?tbody>/g, '')
      .replace(
        /<([a-z][a-z0-9]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>/g,
        (_, tag: string, attrs: string) => `<${tag}${attributes(attrs)}>`,
      )
      .replace(/\s+/g, ' ')
      .replace(/ ?(<\/?(?:div|p|ul|li|h2|table|tr|td|br)\b[^>]*>) ?/g, '$1')
      // Only entities that cannot start a tag or another entity are decoded.
      .replace(/&(?:gt|quot|#39);/g, (e) => ENTITY[e]!)
      .trim()
  );
}
