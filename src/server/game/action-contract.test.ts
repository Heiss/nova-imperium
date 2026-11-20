// The contract of the actions between the browser and the server (#317, #118):
// the input of every action is declared once in src/core/actions/, the browser
// checks each call against it (`act`) and every handler here is checked
// against it by the compiler. The names are checked at run time, the input of
// each handler at compile time (`pnpm typecheck` covers this file).
import { describe, expect, it } from 'vitest';
import type { ActionName, Wire } from '../../core/actions.ts';
import { ACTION_INPUTS } from '../../core/actions.gen.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import type * as A from './actions.ts';
import { ACTIONS } from './dispatch.ts';

const declared = ACTION_INPUTS.flatMap(([, inputs]) => Object.keys(inputs));

type Feature = (typeof SERVER_FEATURES)[number][1];
type Frame = Pick<
  typeof A,
  | 'build'
  | 'cancelBuild'
  | 'research'
  | 'cancelResearch'
  | 'order'
  | 'cancelOrder'
  | 'pct'
  | 'rename'
  | 'options'
  | 'read'
  | 'delrep'
  | 'delall'
>;

/** The tables of the three groups of one feature. */
type Tables<F> =
  | (F extends { actions: infer T } ? T : never)
  | (F extends { guildActions: infer T } ? T : never)
  | (F extends { adminActions: infer T } ? T : never);

/** The input a handler declares: its third parameter. */
type Declared<H> = H extends (
  c: never,
  u: never,
  d: infer D,
  ...r: never[]
) => unknown
  ? D
  : never;

type Same<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

/** The names of a table whose handler does not declare exactly the input of the map. */
type Wrong<T> = {
  [K in keyof T]: K extends ActionName
    ? Same<Declared<T[K]>, Wire<K>> extends true
      ? never
      : K
    : K;
}[keyof T];

type Mismatched<T> = T extends unknown ? Wrong<T> : never;

describe('the contract of the actions', () => {
  it('declares every registered action once and no other', () => {
    expect(new Set(declared).size, 'a name declared twice').toBe(
      declared.length,
    );
    expect([...declared].sort()).toEqual(Object.keys(ACTIONS).sort());
  });

  it('has a handler for every action that declares exactly the input of the map', () => {
    // A handler that declares a wider input (`Data`) or another one is a
    // compile error here; the value only keeps the check in the file.
    const exact: [Mismatched<Tables<Feature> | Frame>] extends [never]
      ? true
      : false = true;
    expect(exact).toBe(true);
  });
});
