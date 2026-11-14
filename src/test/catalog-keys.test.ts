// No comparison with a catalog key outside src/features (#114, owner,
// 2026-11-14): a rule asks the components of an entry, never its key. The
// scan reads the code with the TypeScript and Svelte parsers, as the naming
// test does, and flags only comparisons with a key: `===`, `!==` (and
// `==`, `!=`), `case` and `includes` on a fixed list, an array literal or a
// const bound to one where the call sees it (by scope). The keys are the folder names under src/features,
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

/**
 * Comparisons with a key that may stay: how many there are in the file, and
 * the issue that removes them, or `permanent` for a word that only equals a
 * key (owner, 2026-11-14).
 */
interface Allowed {
  file: string;
  key: string;
  count: number;
  issue: `#${number}` | 'permanent';
}

/**
 * The comparisons with a key that are still allowed, counted per file and
 * key (owner, 2026-11-14). The counts may only fall: a file with more hits
 * than its count fails the test (a new comparison), and so does one with
 * fewer (lower the count, or remove the entry once its issue made the rule
 * generic).
 */
const ALLOWED: readonly Allowed[] = [
  // The lab lock and the shipyard lock without catalog keys.
  { file: 'core/lab.ts', key: 'lab', count: 2, issue: '#183' },
  { file: 'client/views/yard.ts', key: 'yard', count: 1, issue: '#183' },
  // Not a catalog key but an equal word: the report type „spy“.
  {
    file: 'client/views/messages.ts',
    key: 'spy',
    count: 1,
    issue: 'permanent',
  },
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

/**
 * The names a scope binds: to the initializer of a const, or to `null` for
 * any other binding (a parameter, `let`, `var`, a function, an import), which
 * is no fixed list but shadows one of an outer scope.
 */
type Scope<T> = Map<string, T | null>;

/**
 * What `name` is bound to where `scopes` (outermost first) are visible: the
 * innermost scope that binds it decides, `undefined` if none or not a const.
 */
function resolve<T>(name: string, scopes: readonly Scope<T>[]): T | undefined {
  const scope = [...scopes].reverse().find((s) => s.has(name));
  return scope?.get(name) ?? undefined;
}

type TsScope = Scope<ts.Expression>;

/** The elements of a fixed list: an array literal, or a const bound to one. */
function tsList(node: ts.Expression, scopes: readonly TsScope[]): ts.Node[] {
  let list = ts.isIdentifier(node) ? resolve(node.text, scopes) : node;
  while (
    list &&
    (ts.isAsExpression(list) || ts.isParenthesizedExpression(list))
  )
    list = list.expression;
  return list && ts.isArrayLiteralExpression(list) ? [...list.elements] : [];
}

/** The keys a node of TypeScript code compares with. */
function tsCompared(node: ts.Node, scopes: readonly TsScope[]): string[] {
  if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind))
    return tsLiterals([node.left, node.right]);
  if (ts.isCaseClause(node)) return tsLiterals([node.expression]);
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'includes'
  )
    return tsLiterals(tsList(node.expression.expression, scopes));
  return [];
}

/** Binds the names of `name` in `scope`, to `init` if it is one identifier. */
function tsBind(
  name: ts.BindingName,
  scope: TsScope,
  init: ts.Expression | null = null,
): void {
  if (ts.isIdentifier(name)) scope.set(name.text, init);
  else
    for (const e of name.elements)
      if (ts.isBindingElement(e)) tsBind(e.name, scope);
}

/** Binds the names of a declaration list: a const to its initializer. */
function tsDeclare(list: ts.VariableDeclarationList, scope: TsScope): void {
  const isConst =
    (list.flags & ts.NodeFlags.BlockScoped) === ts.NodeFlags.Const;
  for (const d of list.declarations)
    tsBind(d.name, scope, isConst ? (d.initializer ?? null) : null);
}

const blockScoped = (list: ts.VariableDeclarationList): boolean =>
  (list.flags & ts.NodeFlags.BlockScoped) !== 0;

/** The name a function, class, enum, namespace or `import =` declares. */
function tsDeclaredName(s: ts.Statement): string | undefined {
  const declares =
    ts.isFunctionDeclaration(s) ||
    ts.isClassDeclaration(s) ||
    ts.isEnumDeclaration(s) ||
    ts.isModuleDeclaration(s) ||
    ts.isImportEqualsDeclaration(s);
  return declares && s.name && ts.isIdentifier(s.name)
    ? s.name.text
    : undefined;
}

/** Binds the names an import declares. */
function tsImport(s: ts.ImportDeclaration, scope: TsScope): void {
  const clause = s.importClause;
  const bindings = clause?.namedBindings;
  const names: ts.Identifier[] = clause?.name ? [clause.name] : [];
  if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name);
  else if (bindings) names.push(...bindings.elements.map((e) => e.name));
  for (const name of names) scope.set(name.text, null);
}

/** Binds the block-scoped declarations among `statements`. */
function tsLexical(statements: readonly ts.Statement[], scope: TsScope): void {
  for (const s of statements) {
    const name = tsDeclaredName(s);
    if (ts.isVariableStatement(s) && blockScoped(s.declarationList))
      tsDeclare(s.declarationList, scope);
    else if (ts.isImportDeclaration(s)) tsImport(s, scope);
    else if (name) scope.set(name, null);
  }
}

/** Binds the `var`s in `body`, without those of nested functions. */
function tsHoisted(body: ts.Node | undefined, scope: TsScope): void {
  const visit = (n: ts.Node): void => {
    if (ts.isVariableDeclarationList(n) && !blockScoped(n)) tsDeclare(n, scope);
    if (!ts.isFunctionLike(n)) ts.forEachChild(n, visit);
  };
  if (body) ts.forEachChild(body, visit);
}

/** Binds the `let` or `const` of a `for` head. */
function tsLoop(init: ts.ForInitializer | undefined, scope: TsScope): void {
  if (init && ts.isVariableDeclarationList(init) && blockScoped(init))
    tsDeclare(init, scope);
}

/** Binds the parameters, the `var`s and the own name of a function. */
function tsFunction(node: ts.SignatureDeclaration, scope: TsScope): void {
  if (ts.isFunctionExpression(node) && node.name)
    scope.set(node.name.text, null);
  for (const p of node.parameters) tsBind(p.name, scope);
  if ('body' in node) tsHoisted(node.body, scope);
}

/** A kind of node that opens a scope, and how it binds its names. */
const tsRule =
  <T extends ts.Node>(
    is: (n: ts.Node) => n is T,
    bind: (n: T, scope: TsScope) => void,
  ) =>
  (n: ts.Node, scope: TsScope): boolean => {
    if (!is(n)) return false;
    bind(n, scope);
    return true;
  };

/** The nodes that open a scope: module, function, block, loop, catch, class. */
const TS_SCOPES = [
  tsRule(ts.isSourceFile, (n, scope) => {
    tsHoisted(n, scope);
    tsLexical(n.statements, scope);
  }),
  tsRule(ts.isFunctionLike, tsFunction),
  tsRule(ts.isBlock, (n, scope) => tsLexical(n.statements, scope)),
  tsRule(ts.isModuleBlock, (n, scope) => tsLexical(n.statements, scope)),
  tsRule(ts.isCaseBlock, (n, scope) =>
    tsLexical(
      n.clauses.flatMap((c) => [...c.statements]),
      scope,
    ),
  ),
  tsRule(ts.isForStatement, (n, scope) => tsLoop(n.initializer, scope)),
  tsRule(ts.isForInStatement, (n, scope) => tsLoop(n.initializer, scope)),
  tsRule(ts.isForOfStatement, (n, scope) => tsLoop(n.initializer, scope)),
  tsRule(ts.isCatchClause, (n, scope) => {
    if (n.variableDeclaration) tsBind(n.variableDeclaration.name, scope);
  }),
  tsRule(ts.isClassExpression, (n, scope) => {
    if (n.name) scope.set(n.name.text, null);
  }),
];

/** The scope `node` opens, if it opens one. */
function tsScope(node: ts.Node): TsScope | undefined {
  const scope: TsScope = new Map();
  return TS_SCOPES.some((rule) => rule(node, scope)) ? scope : undefined;
}

/** The keys TypeScript code compares with, read by its parser. */
function tsKeys(code: string): string[] {
  const file = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node, outer: readonly TsScope[]): void => {
    const scope = tsScope(node);
    const scopes = scope ? [...outer, scope] : outer;
    out.push(...tsCompared(node, scopes));
    ts.forEachChild(node, (child) => visit(child, scopes));
  };
  visit(file, []);
  return out;
}

/** A node of the syntax tree of the Svelte parser (ESTree in scripts and expressions). */
type Node = Record<string, unknown>;
type EsScope = Scope<Node>;

/** The keys among the string literals of `nodes`. */
const esLiterals = (nodes: readonly unknown[]): string[] =>
  nodes.flatMap((n) => {
    const value = (n as Node | null)?.value;
    return typeof value === 'string' && KEYS.has(value) ? [value] : [];
  });

/** The elements of a fixed list: an array literal, or a const bound to one. */
function esList(node: Node, scopes: readonly EsScope[]): unknown[] {
  let list: Node | undefined =
    node.type === 'Identifier' ? resolve(String(node.name), scopes) : node;
  while (list?.type === 'TSAsExpression') list = list.expression as Node;
  return list?.type === 'ArrayExpression' ? (list.elements as unknown[]) : [];
}

/** The keys a node of the Svelte syntax tree compares with. */
function esCompared(n: Node, scopes: readonly EsScope[]): string[] {
  if (n.type === 'BinaryExpression' && /^[!=]==?$/.test(String(n.operator)))
    return esLiterals([n.left, n.right]);
  if (n.type === 'SwitchCase') return esLiterals([n.test]);
  const callee = n.callee as Node | undefined;
  if (
    n.type === 'CallExpression' &&
    callee?.type === 'MemberExpression' &&
    (callee.property as Node).name === 'includes'
  )
    return esLiterals(esList(callee.object as Node, scopes));
  return [];
}

const SKIP = new Set(['parent', 'leadingComments', 'trailingComments', 'css']);

/** The child nodes of a node of a Svelte syntax tree. */
const children = (n: Node): unknown[] =>
  Object.entries(n).flatMap(([key, child]) => (SKIP.has(key) ? [] : [child]));

const FUNCTION = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** The parts of a destructuring pattern, by its type. */
const ES_PATTERNS = new Map<string, (p: Node) => unknown[]>([
  [
    'ObjectPattern',
    (p) =>
      (p.properties as Node[]).map((q) =>
        q.type === 'RestElement' ? q.argument : q.value,
      ),
  ],
  ['ArrayPattern', (p) => p.elements as unknown[]],
  ['RestElement', (p) => [p.argument]],
  ['AssignmentPattern', (p) => [p.left]],
  ['TSParameterProperty', (p) => [p.parameter]],
]);

/** Binds the names of a pattern in `scope`, to `init` if it is one identifier. */
function esBind(
  pattern: unknown,
  scope: EsScope,
  init: Node | null = null,
): void {
  const p = pattern as Node | null;
  if (p?.type === 'Identifier') scope.set(String(p.name), init);
  else if (p)
    for (const q of ES_PATTERNS.get(String(p.type))?.(p) ?? [])
      esBind(q, scope);
}

/** Binds the names of a variable declaration: a const to its initializer. */
function esDeclare(d: Node, scope: EsScope): void {
  for (const v of d.declarations as Node[])
    esBind(v.id, scope, d.kind === 'const' ? ((v.init as Node) ?? null) : null);
}

const DECLARATION = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSEnumDeclaration',
]);

/** Binds the block-scoped names a statement (or `{@const}`) declares. */
function esStatement(raw: Node, scope: EsScope): void {
  const exported = /^Export(Named|Default)Declaration$/.test(String(raw.type));
  const s = exported ? ((raw.declaration as Node | null) ?? raw) : raw;
  if (s.type === 'VariableDeclaration' && s.kind !== 'var') esDeclare(s, scope);
  else if (s.type === 'ConstTag') esDeclare(s.declaration as Node, scope);
  else if (DECLARATION.has(String(s.type))) esBind(s.id, scope);
  else if (s.type === 'ImportDeclaration')
    for (const i of s.specifiers as Node[]) esBind(i.local, scope);
}

/** Binds the block-scoped declarations among `statements`. */
const esLexical = (statements: unknown, scope: EsScope): void => {
  for (const s of statements as Node[]) esStatement(s, scope);
};

/** Binds the `var`s in `body`, without those of nested functions. */
function esHoisted(body: unknown, scope: EsScope): void {
  if (!body || typeof body !== 'object') return;
  if (Array.isArray(body)) return body.forEach((b) => esHoisted(b, scope));
  const n = body as Node;
  if (n.type === 'VariableDeclaration' && n.kind === 'var') esDeclare(n, scope);
  if (!FUNCTION.has(String(n.type)))
    for (const child of children(n)) esHoisted(child, scope);
}

/** Binds the `let` or `const` of a `for` head. */
function esLoop(init: unknown, scope: EsScope): void {
  const d = init as Node | null;
  if (d?.type === 'VariableDeclaration' && d.kind !== 'var')
    esDeclare(d, scope);
}

/** Binds the parameters, the `var`s and the own name of a function. */
function esFunction(n: Node, scope: EsScope): void {
  if (n.type === 'FunctionExpression') esBind(n.id, scope);
  for (const p of n.params as unknown[]) esBind(p, scope);
  esHoisted(n.body, scope);
}

/**
 * The nodes that open a scope, by type, and how they bind their names: the
 * scripts, functions, blocks, loops, catch and class, and in the markup a
 * fragment (its `{@const}`), each, snippet and await.
 */
const ES_SCOPES = new Map<string, (n: Node, scope: EsScope) => void>([
  [
    'Program',
    (n, scope) => {
      esHoisted(n.body, scope);
      esLexical(n.body, scope);
    },
  ],
  ...[...FUNCTION].map((type) => [type, esFunction] as const),
  ['BlockStatement', (n, scope) => esLexical(n.body, scope)],
  ['StaticBlock', (n, scope) => esLexical(n.body, scope)],
  [
    'SwitchStatement',
    (n, scope) =>
      esLexical(
        (n.cases as Node[]).flatMap((c) => c.consequent as unknown[]),
        scope,
      ),
  ],
  ['ForStatement', (n, scope) => esLoop(n.init, scope)],
  ['ForInStatement', (n, scope) => esLoop(n.left, scope)],
  ['ForOfStatement', (n, scope) => esLoop(n.left, scope)],
  ['CatchClause', (n, scope) => esBind(n.param, scope)],
  ['ClassExpression', (n, scope) => esBind(n.id, scope)],
  ['Fragment', (n, scope) => esLexical(n.nodes, scope)],
  [
    'EachBlock',
    (n, scope) => {
      esBind(n.context, scope);
      if (typeof n.index === 'string') scope.set(n.index, null);
    },
  ],
  [
    'SnippetBlock',
    (n, scope) => {
      for (const p of n.parameters as unknown[]) esBind(p, scope);
    },
  ],
  [
    'AwaitBlock',
    (n, scope) => {
      esBind(n.value, scope);
      esBind(n.error, scope);
    },
  ],
]);

/** The scope `n` opens, if it opens one. */
function esScope(n: Node): EsScope | undefined {
  const bind = ES_SCOPES.get(String(n.type));
  if (!bind) return undefined;
  const scope: EsScope = new Map();
  bind(n, scope);
  return scope;
}

/** The keys a Svelte component compares with, in its scripts and markup. */
function svelteKeys(code: string): string[] {
  const ast = parse(code, { modern: true });
  const out: string[] = [];
  const visit = (node: unknown, outer: readonly EsScope[]): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((x) => visit(x, outer));
    const n = node as Node;
    const scope = esScope(n);
    const scopes = scope ? [...outer, scope] : outer;
    out.push(...esCompared(n, scopes));
    for (const child of children(n)) visit(child, scopes);
  };
  // The module script is visible in the instance script, both in the markup.
  const scopes: EsScope[] = [];
  for (const script of [ast.module, ast.instance]) {
    if (!script) continue;
    const program = script.content as unknown as Node;
    visit(program, scopes);
    scopes.push(esScope(program) ?? new Map());
  }
  visit(ast.fragment, scopes);
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
    const counts = new Map<string, number>();
    for (const h of hits) counts.set(h, (counts.get(h) ?? 0) + 1);
    const names = ALLOWED.map(allowed);
    expect([...counts.keys()].filter((h) => !names.includes(h))).toEqual([]);
    // Each allowed comparison as often as its count: more is a new one,
    // fewer means the count must be lowered.
    expect(
      ALLOWED.map((a) => `${allowed(a)} × ${counts.get(allowed(a)) ?? 0}`),
    ).toEqual(ALLOWED.map((a) => `${allowed(a)} × ${a.count}`));
  });

  it('names each allowed comparison once, with its count and issue', () => {
    const names = ALLOWED.map(allowed);
    expect(new Set(names).size).toBe(names.length);
    for (const a of ALLOWED) {
      expect(KEYS, a.key).toContain(a.key);
      expect(Number.isInteger(a.count) && a.count > 0, allowed(a)).toBe(true);
      expect(a.issue, allowed(a)).toMatch(/^(#\d+|permanent)$/);
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

  it('resolves a list by the scope of its name in TypeScript (self-test)', () => {
    const code = [
      "const LIST = ['metal'];",
      // An inner binding of the name hides the outer list inside only.
      'function f(LIST: string[]) { LIST.includes(k); }',
      "function g() { let LIST = ['sat']; LIST.includes(k); }",
      "function h() { if (k) { var LIST = ['lab']; } LIST.includes(k); }",
      'for (const LIST of lists) LIST.includes(k);',
      'try {} catch (LIST) { LIST.includes(k); }',
      "{ const LIST = ['yard']; LIST.includes(k); }",
      // An inner list does not leak outward or into a sibling.
      "function i() { const LIST = ['probe']; } LIST.includes(k);",
      "function j() { const INNER = ['fusion']; } INNER.includes(k);",
      'const m = () => LIST.includes(k);',
    ].join('\n');
    expect(found('x.ts', code).sort()).toEqual(
      ['x.ts: yard', 'x.ts: metal', 'x.ts: metal'].sort(),
    );
  });

  it('resolves a list by the scope of its name in a Svelte component (self-test)', () => {
    const component = [
      "<script module>const MOD = ['deut'];</script>",
      '<script lang="ts">',
      "  const LIST = ['solar'];",
      // An inner binding of the name hides the outer list inside only.
      '  function f(LIST: string[]) { return LIST.includes(k); }',
      "  function g() { let LIST = ['sat']; return LIST.includes(k); }",
      '  const h = () => { var MOD = 1; return MOD.includes(k); };',
      // An inner list does not leak outward.
      "  function i() { const LIST = ['probe']; const INNER = ['fusion']; }",
      '  const a = INNER.includes(k) || MOD.includes(k);',
      '</script>',
      '<p>{LIST.includes(key)}</p>',
      '{#each items as LIST}<p>{LIST.includes(key)}</p>{/each}',
      '{#snippet s(MOD)}{MOD.includes(key)}{/snippet}',
      "{#if x}{@const LIST = ['lab']}{LIST.includes(key)}{/if}",
      '<p>{LIST.includes(key)}</p>',
    ].join('\n');
    expect(found('X.svelte', component).sort()).toEqual(
      [
        'X.svelte: deut',
        'X.svelte: solar',
        'X.svelte: lab',
        'X.svelte: solar',
      ].sort(),
    );
  });
});
