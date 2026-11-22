// The rules that hold for every client view (#317). The test names no view and
// no count: a view registers itself in its own module (`clientViews`), and each
// view tests its own behaviour in its own test. The functions that put the
// tables together are tested here too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import {
  assembleGlyphs,
  assembleHtml,
  assembleMenu,
  assembleMounts,
  assembleTabs,
  type Listed,
} from './assemble.ts';
import type { ClientView, Mount } from './contract.ts';
import { menu, TAB_GLYPHS, TAB_VIEWS, VIEWS } from './index.ts';
import { ANEW, FRESH, MOUNTED, mountsAnew } from './mount.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

const listed: Listed = CLIENT_VIEWS;
const views = listed.flatMap(([name, list]) =>
  list.map((view) => [name, view] as const),
);
const KEY = /^[a-z][a-zA-Z0-9]*$/;
const MEMBERS = [
  'key',
  'mount',
  'html',
  'anew',
  'fresh',
  'menu',
  'glyph',
  'tab',
];
const round = { guilds: true, achievements: true, daily: false } as RoundRules;

describe('the list of the client views', () => {
  it('names each module once, by its file in src/client/views', () => {
    const names = listed.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-zA-Z0-9/-]*$/);
  });

  it('exports a list of views with plain keys and only the known members', () => {
    for (const [name, list] of listed) {
      expect(Array.isArray(list), name).toBe(true);
      expect(list.length, name).toBeGreaterThan(0);
    }
    for (const [name, view] of views) {
      expect(view.key, name).toMatch(KEY);
      for (const member of Object.keys(view))
        expect(MEMBERS, `${name}: ${view.key}: ${member}`).toContain(member);
    }
  });

  it('gives every view exactly one of mount and html, and anew only to a mounted one', () => {
    for (const [name, view] of views) {
      expect(
        Number(view.mount !== undefined) + Number(view.html !== undefined),
        `${name}: ${view.key}`,
      ).toBe(1);
      if (view.anew) expect(view.mount, `${name}: ${view.key}`).toBeDefined();
    }
  });

  it('defines no view key, menu number or tab number twice, in the modules or in the frame', () => {
    const keys = views.map(([, view]) => view.key);
    expect(new Set(keys).size).toBe(keys.length);
    // The frame and the modules assemble without a clash.
    expect(menu(true, round).length).toBeGreaterThan(0);
    expect(TAB_VIEWS.length).toBeGreaterThan(0);
    for (const key of keys)
      expect(MOUNTED.has(key) || Object.hasOwn(VIEWS, key), key).toBe(true);
  });

  it('puts every menu entry and tab at a number, a label and a glyph', () => {
    for (const [name, view] of views) {
      const where = `${name}: ${view.key}`;
      if (view.menu) {
        expect(Number.isInteger(view.menu.order), where).toBe(true);
        expect(['string', 'function'], where).toContain(typeof view.menu.label);
      }
      if (view.tab) {
        expect(Number.isInteger(view.tab.order), where).toBe(true);
        expect(view.menu, where).toBeDefined();
        expect(TAB_GLYPHS[view.key], where).toMatch(/^<svg /);
      }
      if (view.glyph)
        expect(view.glyph, where).toMatch(/^<svg [^>]*aria-hidden/);
    }
  });

  it('mounts a view that says anew anew', () => {
    for (const [, view] of views)
      expect(ANEW.has(view.key), view.key).toBe(view.anew === true);
  });

  it('mounts a view that says fresh anew by a fresh render only, and never says both (#352)', () => {
    for (const [name, view] of views) {
      const where = `${name}: ${view.key}`;
      expect(FRESH.has(view.key), where).toBe(view.fresh === true);
      if (view.fresh) {
        expect(view.mount, where).toBeDefined();
        expect(view.anew, where).toBeUndefined();
      }
      expect(mountsAnew(view.key, false, false), where).toBe(
        view.anew === true,
      );
      expect(mountsAnew(view.key, true, false), where).toBe(
        view.anew === true || view.fresh === true,
      );
      // A list is mounted anew by a fresh render, as before.
      expect(mountsAnew(view.key, true, true), where).toBe(true);
    }
  });
});

describe('the tables of the views', () => {
  const mount: Mount = () => ({ destroy: () => undefined });
  const html = () => '';
  const one = (name: string, ...list: ClientView[]): Listed[number] => [
    name,
    list,
  ];

  it('holds the views of every module, each in its table', () => {
    const modules = [
      one('a', { key: 'fresh', mount, anew: true }, { key: 'plain', mount }),
      one('b', { key: 'page', html }, { key: 'kept', mount, fresh: true }),
    ];
    const { mount: table, anew, fresh } = assembleMounts(modules);
    expect(Object.keys(table)).toEqual(['fresh', 'plain', 'kept']);
    expect([...anew]).toEqual(['fresh']);
    expect([...fresh]).toEqual(['kept']);
    expect(Object.keys(assembleHtml(modules))).toEqual(['page']);
  });

  it('throws when two modules define one view, naming both files', () => {
    expect(() =>
      assembleMounts([
        one('a', { key: 'x', mount }),
        one('b', { key: 'x', mount }),
      ]),
    ).toThrow(
      'view "x" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
    expect(() =>
      assembleHtml([
        one('a', { key: 'x', html }),
        one('b', { key: 'x', html }),
      ]),
    ).toThrow(
      'view "x" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
  });

  it('puts the menu entries and the tabs in the order of their numbers', () => {
    const items = assembleMenu([
      one('a', { key: 'last', html, menu: { order: 30, label: 'L' } }),
      one('b', { key: 'first', html, menu: { order: 10, label: 'F' } }),
      one('c', {
        key: 'mid',
        html,
        menu: { order: 20, label: 'M', divider: true },
      }),
    ]);
    expect(items.map((i) => i.view)).toEqual(['first', 'mid', 'last']);
    const tabs = assembleTabs([
      one('a', { key: 'b', html, tab: { order: 20 } }),
      one('b', { key: 'a', html, tab: { order: 10, label: 'A' } }),
    ]);
    expect(tabs.map((t) => [t.view, t.label])).toEqual([
      ['a', 'A'],
      ['b', undefined],
    ]);
  });

  it('throws when a menu number or a tab number exists twice, naming both files', () => {
    expect(() =>
      assembleMenu([
        one('a', { key: 'x', html, menu: { order: 10, label: 'X' } }),
        one('b', { key: 'y', html, menu: { order: 10, label: 'Y' } }),
      ]),
    ).toThrow(
      'menu number "10" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
    expect(() =>
      assembleTabs([
        one('a', { key: 'x', html, tab: { order: 5 } }),
        one('b', { key: 'y', html, tab: { order: 5 } }),
      ]),
    ).toThrow(
      'tab number "5" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
  });

  it('takes the glyphs of the modules, each once', () => {
    expect(
      assembleGlyphs([one('b', { key: 'b', html, glyph: '<svg x/>' })]),
    ).toEqual({ b: '<svg x/>' });
    expect(() =>
      assembleGlyphs([
        one('a', { key: 'a', html, glyph: '<svg/>' }),
        one('b', { key: 'a', html, glyph: '<svg x/>' }),
      ]),
    ).toThrow(
      'glyph "a" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
  });
});

/**
 * The Svelte files a view module mounts, with every component they import,
 * read from the sources (#361): a component imported as `./X.svelte`.
 */
function componentsOf(module: string): string[] {
  const dir = 'src/client/views';
  const imports = (source: string): string[] =>
    [...source.matchAll(/from '\.\/([A-Za-z]+\.svelte)'/g)].map((m) => m[1]!);
  const seen = new Set<string>();
  const todo = imports(readFileSync(`${dir}/${module}.ts`, 'utf8'));
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    todo.push(...imports(readFileSync(`${dir}/${file}`, 'utf8')));
  }
  return [...seen].sort();
}

/** A field a player types into: a text area, or an input that is not a box, a button or hidden. */
const TYPED =
  /<textarea\b|<input\b(?![^>]*\btype="(?:checkbox|radio|hidden|submit|button)")/;

/**
 * The views still mounted anew that have a typed field, each with the reason
 * (#361). None is left: „Optionen“ was converted by #359.
 */
const ANEW_WITH_FIELDS: Readonly<Record<string, string>> = {};

describe('the views with fields a player types into (#361)', () => {
  it('are not mounted anew on every render: a render would replace a field while the player types', () => {
    const exposed = views
      .filter(([, view]) => view.anew === true)
      .filter(([name]) =>
        componentsOf(name).some((file) =>
          TYPED.test(readFileSync(`src/client/views/${file}`, 'utf8')),
        ),
      )
      .map(([, view]) => view.key)
      .filter((key) => !Object.hasOwn(ANEW_WITH_FIELDS, key));
    expect(exposed).toEqual([]);
  });

  it('list only views that are still mounted anew', () => {
    for (const key of Object.keys(ANEW_WITH_FIELDS))
      expect(ANEW.has(key), key).toBe(true);
  });

  it('read the components of a view from its module and their imports', () => {
    expect(componentsOf('galaxy')).toContain('Galaxy.svelte');
    expect(componentsOf('guilds')).toContain('GuildChat.svelte');
    expect(TYPED.test('<input type="number" id="x">')).toBe(true);
    expect(TYPED.test('<textarea id="y">')).toBe(true);
    expect(TYPED.test('<input type="checkbox" id="z">')).toBe(false);
    expect(TYPED.test('<input\n  type="hidden" name="a" />')).toBe(false);
  });
});
