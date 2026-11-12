// The grimdark naming (#94): no display text of the game shows a classic
// name that the naming replaces, neither in the catalog nor in the
// interface, the server messages or the icons.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, MISSION, RES, SHIPS } from '../shared/catalog.ts';
import { CLASSIC, classicIn, NAMES, renamed, says } from './naming.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

/** The source files of the game, without tests, test helpers and version 1. */
function sources(dir: string, ext: RegExp): string[] {
  return readdirSync(path.join(ROOT, dir), {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((f) => ext.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => path.join(dir, f))
    .filter((f) => !f.endsWith('test-helpers.ts'));
}

/** String literals and template texts of TypeScript code, read by its parser. */
function literals(code: string): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node))
      out.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true));
  return out;
}

/**
 * What a Svelte component shows, read by the Svelte parser: the text and
 * attribute nodes of its markup and the string literals of its scripts and
 * markup expressions. Comments and styles are not read.
 */
function svelte(code: string): string[] {
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, unknown>;
    out.push(...shown(n));
    for (const [key, child] of Object.entries(n))
      if (!SKIP.has(key)) visit(child);
  };
  const ast = parse(code, { modern: true });
  visit([ast.fragment, ast.instance, ast.module]);
  return out;
}

/** The text a node of the Svelte syntax tree shows itself. */
function shown(n: Record<string, unknown>): string[] {
  if (n.type === 'Text') return [String(n.data)];
  if (n.type === 'Literal' && typeof n.value === 'string') return [n.value];
  if (n.type === 'TemplateElement')
    return [(n.value as { cooked: string }).cooked];
  return [];
}
const SKIP = new Set(['parent', 'leadingComments', 'trailingComments', 'css']);

/**
 * Classic words a file may still say, and why: account deletion also finds
 * spy reports stored before the rename under their classic title.
 */
const ALLOWED: readonly string[] = [
  'server/delete-account.ts: Spionageaktivität',
];

/** Every classic word in `texts`, as „file: word“. */
const found = (file: string, texts: string[]): string[] =>
  texts.flatMap((t) => classicIn(t).map((w) => `${file}: ${w}`));

const CATALOG = { ...BUILD, ...RES, ...SHIPS, ...DEF };

describe('grimdark naming (#94)', () => {
  it('finds a classic word as a word or the start of a compound only', () => {
    expect(says('Der Kreuzer feuert.', 'Kreuzer')).toBe(true);
    expect(says('Ein Deuteriumvorrat.', 'Deuterium')).toBe(true);
    expect(says('Der Jagdkreuzer feuert.', 'Kreuzer')).toBe(false);
    expect(says('Psikristall', 'Kristall')).toBe(false);
    expect(says('Adamant-Panzerung', 'Panzerung')).toBe(false);
    expect(classicIn('Metall und Sonde')).toEqual(['Metall', 'Sonde']);
  });

  it('renames the classic names of version 1, the longest first', () => {
    expect(renamed('Raumschiffwerft (Stufe 5)')).toBe(
      'Orbitale Schiffsschmiede (Stufe 5)',
    );
    expect(renamed('Schlachtkreuzer und Kreuzer')).toBe(
      'Jagdkreuzer und Fregatte',
    );
    expect(renamed('Kreuzers')).toBe('Kreuzers');
  });

  it('shows no classic name in a name, short or long text of the catalog', () => {
    const hits = Object.entries(CATALOG).flatMap(([k, d]) =>
      found(k, [d.n, d.ab, d.ds ?? '', d.lt ?? '']),
    );
    expect(hits).toEqual([]);
    expect(found('MISSION', Object.values(MISSION))).toEqual([]);
  });

  it('keeps every abbreviation unique', () => {
    const abs = Object.values(CATALOG).map((d) => d.ab);
    expect(new Set(abs).size).toBe(abs.length);
    expect(Object.keys(NAMES).sort()).toEqual(Object.keys(CATALOG).sort());
  });

  it('shows no classic name in the interface, the server messages or the icons', () => {
    const files = [
      ...sources('client', /\.ts$/),
      ...sources('server', /\.ts$/),
      ...sources('shared', /\.ts$/),
    ];
    const hits = [
      ...files.flatMap((f) =>
        found(f, literals(readFileSync(path.join(ROOT, f), 'utf8'))),
      ),
      ...sources('client', /\.svelte$/).flatMap((f) =>
        found(f, svelte(readFileSync(path.join(ROOT, f), 'utf8'))),
      ),
      ...sources('client', /\.(svg|html)$/).flatMap((f) =>
        found(f, [readFileSync(path.join(ROOT, f), 'utf8')]),
      ),
    ];
    expect(files.length).toBeGreaterThan(50);
    expect(hits.filter((h) => !ALLOWED.includes(h))).toEqual([]);
    // Each allowed word is still needed; remove it once it is not.
    expect(ALLOWED.filter((a) => !hits.includes(a))).toEqual([]);
  });

  it('notices a classic name in the interface (self-test)', () => {
    expect(
      found('x.ts', literals("const a = 'Nicht genug Rohstoffe.';")),
    ).toEqual(['x.ts: Nicht genug Rohstoffe']);
    expect(found('x.ts', literals('// Metallmine\nconst b = 1;'))).toEqual([]);
    expect(
      found('x.ts', literals('/* Labor */ const c = `${1} Sonde`; // Werft')),
    ).toEqual(['x.ts: Sonde']);
    expect(
      found('X.svelte', svelte('<script>const n = 1;</script><p>Werft</p>')),
    ).toEqual(['X.svelte: Werft']);
    // Text, attributes, script and markup literals count; comments and
    // styles do not, as the Svelte parser reads them.
    const component = [
      '<script>// Metallmine\n/* Labor */ const a = `x${1}Sonde`;</script>',
      '<script context="module">const b = "Satellit";</script>',
      '<style>p::after { content: "Werft"; }</style>',
      '<!-- Kreuzer --><p title="Bomber">{a ? "Kristall" : b}</p>',
    ].join('');
    expect(found('Y.svelte', svelte(component)).sort()).toEqual(
      [
        'Y.svelte: Bomber',
        'Y.svelte: Kristall',
        'Y.svelte: Satellit',
        'Y.svelte: Sonde',
      ].sort(),
    );
    expect(Object.keys(CLASSIC)).toContain('Labor');
  });
});
