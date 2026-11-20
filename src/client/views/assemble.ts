// The tables of mount.ts and index.ts (#317): the views of their own frame (the
// views that are not moved into a module of their own yet) plus those of every
// listed module. A view key, a menu number or a tab number defined twice stops
// the start with both places named, so no view silently replaces another.
import type { V } from './common.ts';
import type { ClientView, MenuItem, Mount, Tab } from './contract.ts';

/** The modules as the generated list gives them: `[name in this folder, clientViews]`. */
export type Listed = readonly (readonly [string, readonly ClientView[]])[];

/** A value with the place that defines it, for the message of a clash. */
interface Owned<T> {
  file: string;
  value: T;
}

/** Everything of one kind, each key once; with a key twice both places are named. */
function collect<T>(
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

const values = <T>(table: Map<string, Owned<T>>): T[] =>
  [...table.values()].map((owned) => owned.value);

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

const MOUNT_FILE = 'src/client/views/mount.ts';
const INDEX_FILE = 'src/client/views/index.ts';

/** The Svelte views of the frame and of all modules by key, and the keys that mount anew. */
export function assembleMounts(
  frame: Readonly<Record<string, Mount>>,
  frameAnew: readonly string[],
  listed: Listed,
): { mount: Record<string, Mount>; anew: ReadonlySet<string> } {
  const table = collect('view', [
    ...Object.entries(frame).map(([k, m]) => [k, MOUNT_FILE, m] as const),
    ...declared(listed, 'mount').map(
      (d) => [d.view.key, d.file, d.value] as const,
    ),
  ]);
  const anew = declared(listed, 'anew')
    .filter((d) => d.value)
    .map((d) => d.view.key);
  return { mount: record(table), anew: new Set([...frameAnew, ...anew]) };
}

/** The HTML views of the frame and of all modules by key. */
export function assembleHtml(
  frame: Readonly<Record<string, (v: V) => string>>,
  listed: Listed,
): Record<string, (v: V) => string> {
  return record(
    collect('view', [
      ...Object.entries(frame).map(([k, h]) => [k, INDEX_FILE, h] as const),
      ...declared(listed, 'html').map(
        (d) => [d.view.key, d.file, d.value] as const,
      ),
    ]),
  );
}

/** An entry with the key of its view. */
export type Placed<T> = T & { view: string };

/** Entries by ascending number, each number once: the frame's and those of all modules. */
function ordered<T extends MenuItem | Tab>(
  kind: string,
  frame: readonly Placed<T>[],
  listed: Listed,
  member: 'menu' | 'tab',
): readonly Placed<T>[] {
  const table = collect(kind, [
    ...frame.map((e) => [String(e.order), INDEX_FILE, e] as const),
    ...declared(listed, member).map(
      (d) =>
        [
          String(d.value.order),
          d.file,
          { ...(d.value as T), view: d.view.key },
        ] as const,
    ),
  ]);
  return values(table).sort((a, b) => a.order - b.order);
}

/** The menu entries of the frame and of all modules by ascending number. */
export const assembleMenu = (
  frame: readonly Placed<MenuItem>[],
  listed: Listed,
): readonly Placed<MenuItem>[] => ordered('menu number', frame, listed, 'menu');

/** The tabs of the frame and of all modules by ascending number. */
export const assembleTabs = (
  frame: readonly Placed<Tab>[],
  listed: Listed,
): readonly Placed<Tab>[] => ordered('tab number', frame, listed, 'tab');

/** The glyphs of the frame and of all modules by view key. */
export function assembleGlyphs(
  frame: Readonly<Record<string, string>>,
  listed: Listed,
): Record<string, string> {
  return record(
    collect('glyph', [
      ...Object.entries(frame).map(([k, g]) => [k, INDEX_FILE, g] as const),
      ...declared(listed, 'glyph').map(
        (d) => [d.view.key, d.file, d.value] as const,
      ),
    ]),
  );
}
