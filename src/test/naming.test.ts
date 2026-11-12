// The grimdark naming (#94): no display text of the game shows a classic
// name that the naming replaces, neither in the catalog nor in the
// interface, the server messages or the icons.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
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

/** String literals of a TypeScript file, comments left out. */
const literals = (code: string): string[] =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];

/** What a Svelte component shows: its markup and the literals of its script. */
const svelte = (code: string): string[] => {
  const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(code)?.[1] ?? '';
  const markup = code
    .replace(/<script[^>]*>[\s\S]*?<\/script>/, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [...literals(script), markup];
};

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
    const ts = [
      ...sources('client', /\.ts$/),
      ...sources('server', /\.ts$/),
      ...sources('shared', /\.ts$/),
    ];
    const hits = [
      ...ts.flatMap((f) =>
        found(f, literals(readFileSync(path.join(ROOT, f), 'utf8'))),
      ),
      ...sources('client', /\.svelte$/).flatMap((f) =>
        found(f, svelte(readFileSync(path.join(ROOT, f), 'utf8'))),
      ),
      ...sources('client', /\.(svg|html)$/).flatMap((f) =>
        found(f, [readFileSync(path.join(ROOT, f), 'utf8')]),
      ),
    ];
    expect(ts.length).toBeGreaterThan(50);
    expect(hits).toEqual([]);
  });

  it('notices a classic name in the interface (self-test)', () => {
    expect(
      found('x.ts', literals("const a = 'Nicht genug Rohstoffe.';")),
    ).toEqual(['x.ts: Nicht genug Rohstoffe']);
    expect(found('x.ts', literals('// Metallmine\nconst b = 1;'))).toEqual([]);
    expect(
      found('X.svelte', svelte('<script>const n = 1;</script><p>Werft</p>')),
    ).toEqual(['X.svelte: Werft']);
    expect(Object.keys(CLASSIC)).toContain('Labor');
  });
});
