// The tables of mount.ts and index.ts (#317): the views of every listed module.
// A view key, a menu number, a tab number or a glyph defined twice stops the
// start with both files named, so no view silently replaces another.
import type { V } from './common.ts';
import type { ClientView, MenuItem, Mount, Offered, Tab } from './contract.ts';

/** The modules as the generated list gives them: `[name in this folder, clientViews]`. */
export type Listed = readonly (readonly [string, readonly ClientView[]])[];

/** A value with the file that defines it, for the message of a clash. */
interface Owned<T> {
  file: string;
  value: T;
}

/** Everything of one kind, each key once; with a key twice both files are named. */
export function collect<T>(
  kind: string,
  entries: readonly (readonly [string, string, T])[],
): Map<string, Owned<T>> {
  const table = new Map<string, Owned<T>>();
  for (const [key, file, value] of entries) {
    const taken = table.get(key);
    if (taken)
      throw new Error(
        `${kind} "${key}" is defined in ${taken.file} and in ${file}.`,
      );
    table.set(key, { file, value });
  }
  return table;
}

const record = <T>(table: Map<string, Owned<T>>): Record<string, T> =>
  Object.fromEntries([...table].map(([key, owned]) => [key, owned.value]));

/** The views of all modules that have `member`, with the file of the module. */
function declared<K extends keyof ClientView>(
  listed: Listed,
  member: K,
): { file: string; view: ClientView; value: NonNullable<ClientView[K]> }[] {
  return listed.flatMap(([name, list]) =>
    list.flatMap((view) =>
      view[member] === undefined
        ? []
        : [
            {
              file: `src/client/views/${name}.ts`,
              view,
              value: view[member] as NonNullable<ClientView[K]>,
            },
          ],
    ),
  );
}

/** The keys of the views that set `member` to true. */
const flagged = (listed: Listed, member: 'anew' | 'fresh'): Set<string> =>
  new Set(
    declared(listed, member)
      .filter((d) => d.value)
      .map((d) => d.view.key),
  );

/** The Svelte views of all modules by key, the keys that mount anew and those that mount anew by a fresh render only. */
export function assembleMounts(listed: Listed): {
  mount: Record<string, Mount>;
  anew: ReadonlySet<string>;
  fresh: ReadonlySet<string>;
} {
  const table = collect(
    'view',
    declared(listed, 'mount').map((d) => [d.view.key, d.file, d.value]),
  );
  return {
    mount: record(table),
    anew: flagged(listed, 'anew'),
    fresh: flagged(listed, 'fresh'),
  };
}

/** The HTML views of all modules by key. */
export const assembleHtml = (
  listed: Listed,
): Record<string, (v: V) => string> =>
  record(
    collect(
      'view',
      declared(listed, 'html').map((d) => [d.view.key, d.file, d.value]),
    ),
  );

/** An entry with the key of its view. */
export type Placed<T> = T & { view: string };

/** The entries of all modules by ascending number, each number once. */
function ordered<T extends MenuItem | Tab>(
  kind: string,
  listed: Listed,
  member: 'menu' | 'tab',
): readonly Placed<T>[] {
  const table = collect(
    kind,
    declared(listed, member).map((d) => [
      String(d.value.order),
      d.file,
      { ...(d.value as T), view: d.view.key },
    ]),
  );
  return [...table.values()]
    .map((owned) => owned.value)
    .sort((a, b) => a.order - b.order);
}

/** The menu entries of all modules by ascending number. */
export const assembleMenu = (listed: Listed): readonly Placed<MenuItem>[] =>
  ordered('menu number', listed, 'menu');

/** The tabs of all modules by ascending number. */
export const assembleTabs = (listed: Listed): readonly Placed<Tab>[] =>
  ordered('tab number', listed, 'tab');

/** The glyphs of all modules by view key. */
export const assembleGlyphs = (listed: Listed): Record<string, string> =>
  record(
    collect(
      'glyph',
      declared(listed, 'glyph').map((d) => [d.view.key, d.file, d.value]),
    ),
  );

/** The rules of the views that are not always offered, by view key (#373). */
export const assembleOffered = (listed: Listed): Record<string, Offered> =>
  record(
    collect(
      'offered',
      declared(listed, 'offered').map((d) => [d.view.key, d.file, d.value]),
    ),
  );

/** The address parameters of the views that have some, by view key; each name belongs to one view (#379). */
export function assembleAddress(
  listed: Listed,
): Record<string, readonly string[]> {
  const found = declared(listed, 'address');
  collect(
    'address parameter',
    found.flatMap((d) =>
      d.value.map((name) => [name, d.file, d.view.key] as const),
    ),
  );
  return Object.fromEntries(found.map((d) => [d.view.key, d.value]));
}
