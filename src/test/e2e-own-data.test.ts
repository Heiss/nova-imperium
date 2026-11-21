// The guard of #302 for the E2E specs: tests own their data. A spec gets its
// players, its guild tags and its area of the universe from the helpers
// (e2e/own-data.ts); the seed command refuses what no helper handed out at
// run time, and this test refuses what a spec writes down by hand, so a
// fixed position, tag or account cannot come back. A position slot inside the
// own system (`p: 15`) is fine: the system is the test's own.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const dir = path.resolve(import.meta.dirname, '../../e2e');

/** The calls that take the name of an account as their second argument. */
const LOGINS = new Set(['register', 'login', 'registerByMail', 'loginByCode']);

const isText = (n: ts.Node): boolean =>
  ts.isStringLiteralLike(n) || ts.isTemplateExpression(n);

/** A rule: what is wrong with a node of a spec, or nothing. */
type Rule = (n: ts.Node, sf: ts.SourceFile) => string[];

const keyOf = (p: ts.ObjectLiteralElementLike, sf: ts.SourceFile): string =>
  p.name?.getText(sf) ?? '';

const assigned = (n: ts.ObjectLiteralExpression): ts.PropertyAssignment[] =>
  n.properties.filter(ts.isPropertyAssignment);

/** A place ({ g, s, p }) with a literal galaxy or system. */
const literalPlace: Rule = (n, sf) => {
  if (!ts.isObjectLiteralExpression(n)) return [];
  const keys = n.properties.map((p) => keyOf(p, sf));
  if (['g', 's', 'p'].filter((k) => keys.includes(k)).length < 2) return [];
  return assigned(n)
    .filter(
      (p) =>
        ts.isNumericLiteral(p.initializer) && ['g', 's'].includes(keyOf(p, sf)),
    )
    .map((p) => `a literal galaxy or system (${p.getText(sf)}): use ownArea()`);
};

/** The tag of a guild action (`type` ends in „Guild“). */
const literalTag: Rule = (n, sf) => {
  if (!ts.isObjectLiteralExpression(n)) return [];
  const props = assigned(n);
  const action = props.some(
    (p) =>
      keyOf(p, sf) === 'type' &&
      ts.isStringLiteralLike(p.initializer) &&
      p.initializer.text.endsWith('Guild'),
  );
  return props
    .filter((p) => action && keyOf(p, sf) === 'tag' && isText(p.initializer))
    .map((p) => `a literal tag (${p.initializer.getText(sf)}): use guildTag()`);
};

/** The name of a player in a call of the seed helpers. */
const literalSeedName: Rule = (n, sf) =>
  ts.isPropertyAssignment(n) &&
  keyOf(n, sf) === 'name' &&
  isText(n.initializer) &&
  ts.isObjectLiteralExpression(n.parent) &&
  ts.isCallExpression(n.parent.parent) &&
  /^(seed|mailSeed)$/.test(n.parent.parent.expression.getText(sf))
    ? [`a literal name (${n.initializer.getText(sf)}): use uniqueName()`]
    : [];

const literalPosition: Rule = (n) =>
  ts.isStringLiteralLike(n) &&
  /\[\d+:\d+:\d+\]/.test(n.text) &&
  !ts.isImportDeclaration(n.parent)
    ? [`a literal position (${n.text}): use ownArea()`]
    : [];

const clockInText: Rule = (n, sf) =>
  ts.isTemplateSpan(n) && /\bDate\.now\(/.test(n.expression.getText(sf))
    ? [
        'Date.now() in a text builds names and tags: use uniqueName() or guildTag()',
      ]
    : [];

const literalAccount: Rule = (n, sf) =>
  ts.isCallExpression(n) &&
  ts.isIdentifier(n.expression) &&
  LOGINS.has(n.expression.text) &&
  n.arguments[1] &&
  isText(n.arguments[1])
    ? [`a literal account (${n.arguments[1].getText(sf)}): use uniqueName()`]
    : [];

const literalTagField: Rule = (n, sf) =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  n.expression.name.text === 'fill' &&
  n.arguments[0] &&
  isText(n.arguments[0]) &&
  /getByLabel\(\s*'Kürzel'/.test(n.expression.expression.getText(sf))
    ? ['a literal guild tag: use guildTag()']
    : [];

const RULES: Rule[] = [
  literalPlace,
  literalTag,
  literalSeedName,
  literalPosition,
  clockInText,
  literalAccount,
  literalTagField,
];

/** What in a spec source a test may not write by hand, one line each. */
function handMade(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const walk = (n: ts.Node): void => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    for (const rule of RULES)
      for (const why of rule(n, sf)) found.push(`${file}:${line + 1}: ${why}`);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return found;
}

describe('the E2E specs own their data (#302)', () => {
  const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));

  it('has specs to check', () => {
    expect(specs.length).toBeGreaterThan(20);
  });

  it.each(specs)('%s writes no position, tag or account by hand', (file) => {
    const source = readFileSync(path.join(dir, file), 'utf8');
    expect(handMade(`e2e/${file}`, source)).toEqual([]);
  });

  it('finds what it forbids', () => {
    const source = [
      'seed({ name: "Hand", colony: { g: 2, s: 7, p: 15 } });',
      'await register(page, "Hand");',
      'const tag = `G${Date.now() % 1000000}`;',
      "await page.getByLabel('Kürzel').fill('ABC');",
      'expect(x).toBe("[1:2:3]");',
      'await refusal(p, { type: "createGuild", name: "N", tag: "NEU" });',
    ].join('\n');
    expect(handMade('x.spec.ts', source)).toEqual([
      'x.spec.ts:1: a literal name ("Hand"): use uniqueName()',
      'x.spec.ts:1: a literal galaxy or system (g: 2): use ownArea()',
      'x.spec.ts:1: a literal galaxy or system (s: 7): use ownArea()',
      'x.spec.ts:2: a literal account ("Hand"): use uniqueName()',
      'x.spec.ts:3: Date.now() in a text builds names and tags: use uniqueName() or guildTag()',
      'x.spec.ts:4: a literal guild tag: use guildTag()',
      'x.spec.ts:5: a literal position ([1:2:3]): use ownArea()',
      'x.spec.ts:6: a literal tag ("NEU"): use guildTag()',
    ]);
  });

  it('leaves what is fine', () => {
    const source = [
      'const ok = { g: home.g, p: 15, tag: "push" };',
      'const fine = { ...ownArea().system(2), p: 15 };',
      'const units = { T: 86400, s: 1 };',
      'await register(page, name);',
    ].join('\n');
    expect(handMade('x.spec.ts', source)).toEqual([]);
  });
});
