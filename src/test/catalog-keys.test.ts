// No comparison with a catalog key outside src/features (#114, owner,
// 2026-11-14): a rule asks the components of an entry, never its key. The
// scan reads the code with the TypeScript and Svelte parsers, as the naming
// test does, and flags only comparisons with a key: `===`, `!==` (and
// `==`, `!=`), `case` and `includes` on a fixed list, an array literal or a
// const bound to one. The keys are the folder names under src/features,
// without the missions. The entries themselves, the tests and version 1 are
// not scanned.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

/** The catalog keys: the folder names under src/features, without the missions. */
const KEYS: ReadonlySet<string> = new Set(
  readdirSync(path.join(ROOT, 'features'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'missions')
    .map((d) => d.name),
);

/** A comparison with a key that may stay for now, and the issue that removes it. */
interface Allowed {
  file: string;
  key: string;
  issue: string;
}

/**
 * The comparisons with a key that are still allowed. The list may only
 * shrink: an entry that is no longer hit fails the test, so it goes once
 * its issue made the rule generic.
 */
const ALLOWED: readonly Allowed[] = [
  // When the next Solarsatellit is finished (nextSatellite) and when
  // Energietechnik changes a Fusionskraftwerk (techChange): the generic
  // events of settle.
  { file: 'core/settle.ts', key: 'sat', issue: '#115' },
  { file: 'core/settle.ts', key: 'energy', issue: '#115' },
  // The reactors settle when Energietechnik finishes (settleReactors).
  { file: 'server/game/actions.ts', key: 'energy', issue: '#115' },
  { file: 'server/game/actions.ts', key: 'fusion', issue: '#115' },
  // Auspex-Erkundung only with Spähschädeln: the missions as strategies.
  { file: 'server/game/fleet-actions.ts', key: 'probe', issue: '#116' },
  // The lab lock and the shipyard lock.
  { file: 'core/lab.ts', key: 'lab', issue: 'TODO-issue' },
  { file: 'client/views/yard.ts', key: 'yard', issue: 'TODO-issue' },
  // Not a catalog key but an equal word: the mission and report type „spy“
  // and the state „energy“ (not enough energy) of a building or research.
  { file: 'server/game/fleet-actions.ts', key: 'spy', issue: 'TODO-owner' },
  { file: 'server/game/arrival.ts', key: 'spy', issue: 'TODO-owner' },
  { file: 'client/views/messages.ts', key: 'spy', issue: 'TODO-owner' },
  { file: 'client/views/Buildings.svelte', key: 'energy', issue: 'TODO-owner' },
  { file: 'client/views/economy.ts', key: 'energy', issue: 'TODO-owner' },
];

/** The source files of the game, without the entries, tests and version 1. */
function sources(): string[] {
  return readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|svelte)$/.test(f))
    .filter((f) => !/\.test\.ts$/.test(f) && !f.endsWith('test-helpers.ts'))
    .filter((f) => !f.startsWith(`features${path.sep}`))
    .filter((f) => !f.startsWith(path.join('test', 'legacy')));
}

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** The keys among the string literals of `nodes`. */
const tsLiterals = (nodes: readonly (ts.Node | undefined)[]): string[] =>
  nodes.flatMap((n) =>
    n && ts.isStringLiteralLike(n) && KEYS.has(n.text) ? [n.text] : [],
  );

type Consts = Map<string, ts.Expression>;

/** The elements of a fixed list: an array literal, or a const bound to one. */
function tsList(node: ts.Expression, consts: Consts): ts.Node[] {
  let list = ts.isIdentifier(node) ? consts.get(node.text) : node;
  while (
    list &&
    (ts.isAsExpression(list) || ts.isParenthesizedExpression(list))
  )
    list = list.expression;
  return list && ts.isArrayLiteralExpression(list) ? [...list.elements] : [];
}

/** The keys a node of TypeScript code compares with. */
function tsCompared(node: ts.Node, consts: Consts): string[] {
  if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind))
    return tsLiterals([node.left, node.right]);
  if (ts.isCaseClause(node)) return tsLiterals([node.expression]);
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'includes'
  )
    return tsLiterals(tsList(node.expression.expression, consts));
  return [];
}

/** The consts of a file bound to an expression, by name. */
function tsConsts(file: ts.SourceFile): Consts {
  const consts: Consts = new Map();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const
    )
      consts.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return consts;
}

/** The keys TypeScript code compares with, read by its parser. */
function tsKeys(code: string): string[] {
  const file = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const consts = tsConsts(file);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    out.push(...tsCompared(node, consts));
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** A node of the syntax tree of the Svelte parser (ESTree in scripts and expressions). */
type Node = Record<string, unknown>;
type Lists = Map<string, Node>;

/** The keys among the string literals of `nodes`. */
const esLiterals = (nodes: readonly unknown[]): string[] =>
  nodes.flatMap((n) => {
    const value = (n as Node | null)?.value;
    return typeof value === 'string' && KEYS.has(value) ? [value] : [];
  });

/** The elements of a fixed list: an array literal, or a const bound to one. */
function esList(node: Node, lists: Lists): unknown[] {
  let list: Node | undefined =
    node.type === 'Identifier' ? lists.get(String(node.name)) : node;
  while (list?.type === 'TSAsExpression') list = list.expression as Node;
  return list?.type === 'ArrayExpression' ? (list.elements as unknown[]) : [];
}

/** The keys a node of the Svelte syntax tree compares with. */
function esCompared(n: Node, lists: Lists): string[] {
  if (n.type === 'BinaryExpression' && /^[!=]==?$/.test(String(n.operator)))
    return esLiterals([n.left, n.right]);
  if (n.type === 'SwitchCase') return esLiterals([n.test]);
  const callee = n.callee as Node | undefined;
  if (
    n.type === 'CallExpression' &&
    callee?.type === 'MemberExpression' &&
    (callee.property as Node).name === 'includes'
  )
    return esLiterals(esList(callee.object as Node, lists));
  return [];
}

const SKIP = new Set(['parent', 'leadingComments', 'trailingComments', 'css']);

/** Calls `fn` on every node of a Svelte syntax tree. */
function walk(node: unknown, fn: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((x) => walk(x, fn));
  const n = node as Node;
  fn(n);
  for (const [key, child] of Object.entries(n))
    if (!SKIP.has(key)) walk(child, fn);
}

/** The keys a Svelte component compares with, in its scripts and markup. */
function svelteKeys(code: string): string[] {
  const ast = parse(code, { modern: true });
  const root = [ast.fragment, ast.instance, ast.module];
  const lists: Lists = new Map();
  walk(root, (n) => {
    if (n.type !== 'VariableDeclaration' || n.kind !== 'const') return;
    for (const d of n.declarations as Node[])
      if ((d.id as Node).type === 'Identifier' && d.init)
        lists.set(String((d.id as Node).name), d.init as Node);
  });
  const out: string[] = [];
  walk(root, (n) => out.push(...esCompared(n, lists)));
  return out;
}

/** Every comparison with a key in the code of `file`, as „file: key“. */
const found = (file: string, code: string): string[] =>
  (file.endsWith('.svelte') ? svelteKeys(code) : tsKeys(code)).map(
    (k) => `${file}: ${k}`,
  );

const allowed = (a: Allowed): string => `${a.file}: ${a.key}`;

describe('no comparison with a catalog key outside src/features (#114)', () => {
  it('reads the keys from the feature folders', () => {
    expect(KEYS.size).toBe(49);
    expect(KEYS).toContain('metal');
    expect(KEYS).toContain('sat');
    expect(KEYS).not.toContain('missions');
  });

  it('finds no comparison with a key but the allowed ones', () => {
    const files = sources();
    const hits = files.flatMap((f) =>
      found(f, readFileSync(path.join(ROOT, f), 'utf8')),
    );
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('.svelte'))).toBe(true);
    expect(files.filter((f) => f.startsWith('features'))).toEqual([]);
    const names = ALLOWED.map(allowed);
    expect(hits.filter((h) => !names.includes(h))).toEqual([]);
    // Each allowed comparison is still there; remove it once it is not.
    expect(names.filter((a) => !hits.includes(a))).toEqual([]);
  });

  it('names each allowed comparison once, with its issue', () => {
    const names = ALLOWED.map(allowed);
    expect(new Set(names).size).toBe(names.length);
    for (const a of ALLOWED) {
      expect(KEYS, a.key).toContain(a.key);
      expect(a.issue, allowed(a)).toMatch(/^(#\d+|TODO-issue|TODO-owner)$/);
    }
  });

  it('notices a comparison with a key in TypeScript (self-test)', () => {
    const code = [
      "if (k === 'metal' || 'sat' !== k || k == 'lab' || k != 'yard') {}",
      "switch (k) { case 'fusion': break; case 'other': break; }",
      "['probe', 'x'].includes(k);",
      "const LIST = ['deut', 'y'] as const; LIST.includes(k);",
      "const A = 'crystal'; A.includes(k);",
      "x.b.metal; ({ solar: 1 }); text('energy'); k === 'attack';",
      "// k === 'spy'\nconst t = `${k === 'lab'}`;",
      "k < 'metal'; [k].includes('sat');",
    ].join('\n');
    expect(found('x.ts', code).sort()).toEqual(
      [
        'x.ts: metal',
        'x.ts: sat',
        'x.ts: lab',
        'x.ts: yard',
        'x.ts: fusion',
        'x.ts: probe',
        'x.ts: deut',
        'x.ts: lab',
      ].sort(),
    );
  });

  it('notices a comparison with a key in a Svelte component (self-test)', () => {
    const component = [
      '<script lang="ts">',
      "  const LIST = ['solar', 'z'] as const;",
      "  const a = (k: string) => k !== 'metal' || LIST.includes(k);",
      "  const b = (k: string) => { switch (k) { case 'sat': return 1; } };",
      "  const c = (k: string) => text('energy') && k === 'attack';",
      '</script>',
      '<script module>const d = (k) => k == "lab";</script>',
      "{#if key === 'fusion'}<p>{['probe'].includes(key)}</p>{/if}",
      '<p title="deut">metal</p><!-- k === \'yard\' -->',
    ].join('\n');
    expect(found('X.svelte', component).sort()).toEqual(
      [
        'X.svelte: solar',
        'X.svelte: metal',
        'X.svelte: sat',
        'X.svelte: lab',
        'X.svelte: fusion',
        'X.svelte: probe',
      ].sort(),
    );
  });
});
