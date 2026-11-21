// Guard (#118, package 8, made stricter by #332): no client code sets the
// value, the tick or the chosen option of a form field, except `setField` of
// src/client/dom.ts, the one function that does. A form keeps its fields as
// the state of its component and the component shows them; a field written
// behind the back of that state is overwritten by the next render (the poll
// redraws every 4 s) and leaves the state wrong. There is no list of files
// that may write: only a field that holds its value in the page (the amounts
// of the lists, the settings of the universe) is written, and through
// `setField`. The scan reads the syntax trees (TypeScript, and the Svelte
// compiler for components), so comments and strings cannot fool it.
import { globSync, readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/** The properties of a field that hold what the player sees or chose. */
const PROPERTIES = new Set([
  'value',
  'checked',
  'selectedIndex',
  'selected',
  'defaultValue',
  'defaultChecked',
  'valueAsNumber',
]);

/** The one function that may write a field, and the file it is in. */
const WRITER = { file: 'src/client/dom.ts', name: 'setField' } as const;

const isWrite = (op: ts.SyntaxKind): boolean =>
  op >= ts.SyntaxKind.FirstAssignment && op <= ts.SyntaxKind.LastAssignment;

/** The name a property access or an element access with a string names. */
function nameOf(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression)
  )
    return node.argumentExpression.text;
  return undefined;
}

const ATTRIBUTES = ['value', 'checked', 'selected'];
const isField = (node: ts.Node): boolean => PROPERTIES.has(nameOf(node) ?? '');

const isStep = (node: ts.Node): boolean =>
  (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
  (node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken) &&
  isField(node.operand);

const isAttributeCall = (node: ts.Node): boolean => {
  if (!ts.isCallExpression(node) || nameOf(node.expression) !== 'setAttribute')
    return false;
  const first = node.arguments[0];
  return (
    first !== undefined &&
    ts.isStringLiteralLike(first) &&
    ATTRIBUTES.includes(first.text)
  );
};

/** Whether the node writes a field: `el.value = …`, `el.checked ||= …`, `el.selected++`, `setAttribute('value', …)`. */
const isFieldWrite = (node: ts.Node): boolean =>
  (ts.isBinaryExpression(node) &&
    isWrite(node.operatorToken.kind) &&
    isField(node.left)) ||
  isStep(node) ||
  isAttributeCall(node);

/** The writes to a field in TypeScript code, apart from those inside the function `except`. */
export function writesInTs(code: string, except?: string): string[] {
  const out: string[] = [];
  const source = ts.createSourceFile(
    'x.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
  );
  const visit = (node: ts.Node): void => {
    if (
      except !== undefined &&
      ts.isFunctionDeclaration(node) &&
      node.name?.text === except
    )
      return;
    if (isFieldWrite(node))
      out.push(
        `line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.getText().split('\n')[0]}`,
      );
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

type Tree = { [key: string]: unknown };
const SKIP = new Set(['parent', 'leadingComments', 'trailingComments', 'css']);

/** The name a member expression of the Svelte syntax tree names. */
function keyOf(m: Tree | undefined): string | undefined {
  const p = m?.type === 'MemberExpression' ? (m.property as Tree) : undefined;
  if (!p) return undefined;
  if (m!.computed) return p.type === 'Literal' ? String(p.value) : undefined;
  return p.type === 'Identifier' ? String(p.name) : undefined;
}

const isFieldKey = (m: Tree | undefined): boolean =>
  PROPERTIES.has(keyOf(m) ?? '');

function isSvelteWrite(t: Tree): boolean {
  if (t.type === 'AssignmentExpression') return isFieldKey(t.left as Tree);
  if (t.type === 'UpdateExpression') return isFieldKey(t.argument as Tree);
  if (t.type !== 'CallExpression') return false;
  const first = (t.arguments as Tree[])[0];
  return (
    keyOf(t.callee as Tree) === 'setAttribute' &&
    first?.type === 'Literal' &&
    ATTRIBUTES.includes(String(first.value))
  );
}

/** The same in a Svelte component: its script and the expressions of its markup. */
export function writesInSvelte(code: string): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== 'object') return;
    const t = n as Tree;
    if (isSvelteWrite(t)) out.push(`offset ${String(t.start)}`);
    for (const [key, child] of Object.entries(t))
      if (!SKIP.has(key)) visit(child);
  };
  const ast = parse(code, { modern: true });
  visit([ast.fragment, ast.instance, ast.module]);
  return out;
}

const norm = (f: string): string => f.split('\\').join('/');
const files = (): string[] =>
  globSync('src/client/**/*.{ts,svelte}')
    .map(norm)
    .filter((f) => !/\.test\.ts$/.test(f) && !f.includes('/test-'))
    .sort();

describe('writes to the fields of the page', () => {
  it('go through setField of dom.ts', () => {
    const found: string[] = [];
    for (const file of files()) {
      const code = readFileSync(file, 'utf8');
      const hits = file.endsWith('.svelte')
        ? writesInSvelte(code)
        : writesInTs(code, file === WRITER.file ? WRITER.name : undefined);
      for (const hit of hits) found.push(`${file} ${hit}`);
    }
    expect(
      found,
      'set a field of the page through setField (src/client/dom.ts); the field of a form with state is shown by its component (value= with oninput, or bind:), and the handler writes the state',
    ).toEqual([]);
  });

  it('has the one writer, and it writes a field', () => {
    expect(files()).toContain(WRITER.file);
    const code = readFileSync(WRITER.file, 'utf8');
    // Only the writer writes a field in its file: take it out and nothing is left.
    expect(writesInTs(code)).toHaveLength(1);
    expect(writesInTs(code, WRITER.name)).toEqual([]);
  });
});

describe('the scan', () => {
  it('finds each way to write a field in TypeScript', () => {
    for (const code of [
      'el.value = "1";',
      'el.value += "1";',
      '(el as HTMLInputElement).checked = true;',
      'el.checked ||= x;',
      'select.selectedIndex = 0;',
      'option.selected = true;',
      'el["value"] = "1";',
      'el.setAttribute("value", "1");',
      'el.valueAsNumber++;',
    ])
      expect(writesInTs(code), code).toHaveLength(1);
  });

  it('does not take reads, comparisons, comments and strings for writes', () => {
    for (const code of [
      'const v = el.value;',
      'if (el.value === "moon") x();',
      '// el.value = "1";\n/* el.checked = true; */',
      'const s = "el.value = 1";',
      'const t = `a.checked = ${b}`;',
      'const o = { value: 1, selected: true };',
      'el.setAttribute("id", "x");',
      'el.title = "x";',
    ])
      expect(writesInTs(code), code).toEqual([]);
  });

  it('leaves the function it is told to leave alone, and finds the writes of every other', () => {
    const code =
      'function setField(el: X, v: string) { el.value = v; }\nfunction other(el: X) { el.value = "1"; }\nconst arrow = (el: X) => { el.value = "2"; };';
    expect(writesInTs(code)).toHaveLength(3);
    expect(writesInTs(code, 'setField')).toHaveLength(2);
    expect(writesInTs(code, 'other')).toHaveLength(2);
  });

  it('finds a write in a component and leaves bind: and value= alone', () => {
    const write =
      '<script lang="ts">function f(el: HTMLInputElement) { el.value = "1"; }</script><button onclick={(e) => (e.currentTarget.checked = true)}>x</button>';
    expect(writesInSvelte(write)).toHaveLength(2);
    const fine =
      '<script lang="ts">let a = $state(""); const b = a.length;</script><input bind:value={a} /><input value={b} /><!-- el.value = 1 -->';
    expect(writesInSvelte(fine)).toEqual([]);
  });
});
