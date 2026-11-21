// The amounts typed into the four lists (`q_<key>` to order, `td_<key>` to tear
// down) need no restore after a redraw (#332). The poll redraws the lists in
// place: the lists are mounted once and follow `client.shown`, and the two
// fields carry no value, no binding and no handler of the component, so the
// redraw never writes them and never replaces their nodes; the field drafts
// that once restored them had nothing to do and are gone. A fresh render
// (another view or planet) mounts the list again with empty fields. There is
// no DOM in the unit tests, so the proof is the two facts the redraw rests on,
// read from the registry and from the syntax tree of the component;
// e2e/redraw-drafts.spec.ts types into the fields, lets the poll redraw and
// reads them again.
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { catalogKind } from '../logic/catalog-list.ts';
import { ANEW, MOUNTED } from './mount.ts';

const LISTS = ['buildings', 'research', 'shipyard', 'defense'];

describe('the lists are redrawn in place by the poll', () => {
  it('are views of a catalog kind, mounted as components and not mounted anew', () => {
    for (const key of LISTS) {
      expect(catalogKind(key), key).toBeDefined();
      expect(MOUNTED.has(key), key).toBe(true);
      // render.ts mounts a view anew on every render only if it is listed here.
      expect(ANEW.has(key), key).toBe(false);
    }
  });

  it('are the only views of a catalog kind', () => {
    expect([...MOUNTED].filter((key) => catalogKind(key)).sort()).toEqual(
      [...LISTS].sort(),
    );
  });
});

type Node = { [key: string]: unknown };
const SKIP = new Set(['parent', 'leadingComments', 'trailingComments', 'css']);

/** Every node of the tree, each with the keys of the `{#each}` blocks above it. */
function walk(
  n: unknown,
  keyed: boolean,
  found: { node: Node; keyed: boolean }[],
): void {
  if (Array.isArray(n)) return n.forEach((c) => walk(c, keyed, found));
  if (!n || typeof n !== 'object') return;
  const node = n as Node;
  found.push({ node, keyed });
  const inside = node.type === 'EachBlock' ? node.key != null : keyed;
  for (const [key, child] of Object.entries(node))
    if (!SKIP.has(key)) walk(child, inside, found);
}

/** The id of an attribute list, as written (`q_{row.key}` has a text and an expression part). */
const idOf = (attributes: Node[]): string => {
  const id = attributes.find((a) => a.name === 'id');
  const value = id?.value as Node[] | undefined;
  return (value ?? [])
    .map((part) =>
      part.type === 'Text' ? String(part.data) : '{' + String(part.type) + '}',
    )
    .join('');
};

describe('the fields of the amounts hold no state of the component', () => {
  const ast = parse(
    readFileSync('src/client/views/CatalogList.svelte', 'utf8'),
    { modern: true },
  );
  const found: { node: Node; keyed: boolean }[] = [];
  walk(ast.fragment, false, found);
  const fields = found.filter(
    ({ node }) =>
      node.type === 'RegularElement' &&
      node.name === 'input' &&
      /^(q|td)_/.test(idOf(node.attributes as Node[])),
  );

  it('are there: one field to order and one to tear down', () => {
    expect(fields.map(({ node }) => idOf(node.attributes as Node[]))).toEqual([
      'q_{ExpressionTag}',
      'td_{ExpressionTag}',
    ]);
  });

  it('carry nothing a redraw could write: no value, no binding, no handler', () => {
    // A `value`, a `bind:value` (both are named `value`) or an `oninput` would not be in this list.
    const markup = ['aria-label', 'id', 'max', 'min', 'placeholder', 'type'];
    for (const { node } of fields)
      for (const attribute of node.attributes as Node[])
        expect(markup, String(attribute.name)).toContain(attribute.name);
  });

  it('stand in a keyed list of rows, so a redraw keeps the node of each row', () => {
    for (const { keyed } of fields) expect(keyed).toBe(true);
  });
});
