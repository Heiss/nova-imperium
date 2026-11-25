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
  assembleAddress,
  assembleMounts,
  assembleOffered,
  assembleTabs,
  type Listed,
} from './assemble.ts';
import type { ClientView, Mount } from './contract.ts';
import { hiddenView } from '../logic/navigation.ts';
import type { GameState } from '../logic/types.ts';
import { addressParams, namesOf } from '../logic/address.ts';
import {
  ADDRESS,
  menu,
  phoneMenu,
  TAB_GLYPHS,
  TAB_VIEWS,
  VIEWS,
} from './index.ts';
import { offered } from './offered.ts';
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
  'offered',
  'address',
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

/** Names the prototype of a plain object answers (CodeQL on #395). */
const PROTO = [
  'constructor',
  'hasOwnProperty',
  '__proto__',
  'toString',
  'valueOf',
];

describe('whether a view is offered (#373)', () => {
  const ROUNDS = [true, false].flatMap((guilds) =>
    [true, false].flatMap((achievements) =>
      [true, false].map(
        (daily) => ({ guilds, achievements, daily }) as RoundRules,
      ),
    ),
  );
  const shown = (items: ReturnType<typeof menu>) =>
    items.flatMap((i) => (i === '-' ? [] : [i.view]));

  /** The menu, the tabs and the address of every view follow its rule in the round. */
  function follow(round: RoundRules, admin: boolean): void {
    const items = menu(admin, round);
    const tabs = phoneMenu(items).tabs.map((t) => t.view);
    const state = { round, me: { admin } } as unknown as GameState;
    for (const [, view] of views) {
      const on = offered(view.key, round, admin);
      expect(on, view.key).toBe(view.offered?.(round, admin) ?? true);
      if (view.menu) expect(shown(items).includes(view.key), view.key).toBe(on);
      if (view.tab) expect(tabs.includes(view.key), view.key).toBe(on);
      expect(hiddenView(view.key, state), view.key).toBe(!on);
      // Before the first state every view is open.
      expect(hiddenView(view.key, null), view.key).toBe(false);
    }
  }

  it('is one rule for the menu, the tabs and the address of every view', () => {
    for (const round of ROUNDS)
      for (const admin of [true, false]) follow(round, admin);
  });

  it('answers a name of the prototype of an object like an unknown view, never throwing (CodeQL on #395)', () => {
    const state = {
      round: ROUNDS[0],
      me: { admin: false },
    } as unknown as GameState;
    for (const name of PROTO) {
      expect(offered(name, ROUNDS[0]!, false), name).toBe(true);
      expect(offered(name, ROUNDS[0]!, true), name).toBe(true);
      expect(hiddenView(name, state), name).toBe(false);
    }
  });

  it('offers a view without a rule, an unknown name too', () => {
    expect(offered('no-such-view', ROUNDS[0]!, false)).toBe(true);
  });

  it('drops the tab of a view that is not in the menu', () => {
    const items = menu(false, ROUNDS[0]!).filter(
      (i) => i === '-' || i.view !== TAB_VIEWS[0],
    );
    expect(phoneMenu(items).tabs.map((t) => t.view)).toEqual(
      TAB_VIEWS.slice(1),
    );
  });

  it('is defined once per view', () => {
    const rule = () => true;
    expect(() =>
      assembleOffered([
        ['a', [{ key: 'x', html: () => '', offered: rule }]],
        ['b', [{ key: 'x', html: () => '', offered: rule }]],
      ]),
    ).toThrow(
      'offered "x" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
  });

  it('names no view in the navigation, the address or the mount', () => {
    for (const file of [
      'src/client/logic/navigation.ts',
      'src/client/view-address.ts',
      'src/client/views/mount.ts',
      'src/client/views/index.ts',
    ])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /'(admin|guilds|achievements|market)'/,
      );
    const mount = readFileSync('src/client/views/mount.ts', 'utf8');
    // The mount asks the one rule, after checking the view is its own.
    expect(mount).toContain(
      'const own = Object.hasOwn(MOUNT, view) ? MOUNT[view] : undefined;',
    );
    expect(mount).toContain(
      "typeof own === 'function' && offered(view, v.s.round, v.s.me.admin);",
    );
  });
});

describe('the address parameters of the views (#379)', () => {
  it('belong to one view each, plain names', () => {
    const names = views.flatMap(([, view]) => view.address ?? []);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(KEY);
    expect(() => assembleAddress(listed)).not.toThrow();
  });

  it('read no parameter for a name of the prototype of an object (CodeQL on #395)', () => {
    for (const name of PROTO) {
      expect(namesOf(ADDRESS, name), name).toEqual([]);
      expect(
        addressParams(`?view=${name}&guild=g1&a=x`, name, ADDRESS),
        name,
      ).toEqual({});
    }
    expect(namesOf(ADDRESS, 'guilds')).toEqual(['guild']);
  });

  it('stop the start when two views declare one name, naming both files', () => {
    expect(() =>
      assembleAddress([
        ['a', [{ key: 'x', html: () => '', address: ['p'] }]],
        ['b', [{ key: 'y', html: () => '', address: ['q', 'p'] }]],
      ]),
    ).toThrow(
      'address parameter "p" is defined in src/client/views/a.ts and in src/client/views/b.ts.',
    );
    expect(
      assembleAddress([
        ['a', [{ key: 'x', html: () => '', address: ['p', 'q'] }]],
        ['b', [{ key: 'y', html: () => '' }]],
      ]),
    ).toEqual({ x: ['p', 'q'] });
  });

  it('are named by no shared file of the address and the routing', () => {
    for (const file of [
      'src/client/logic/address.ts',
      'src/client/view-address.ts',
      'src/client/routing.ts',
      'src/client/ui-init.ts',
    ])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /'guild'|\.guild\b|get\('a'\)/,
      );
  });
});
