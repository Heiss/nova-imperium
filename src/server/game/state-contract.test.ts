// The contract of the state between the server and the browser (#317, #118):
// the type of each key is declared once in src/core/state/, the server checks
// what each part builds against it (`StatePart<Shape>`), and the browser's
// `GameState` is derived from the same shapes. This file checks at compile
// time (`pnpm typecheck` covers it) that every key a feature part sends has a
// shape and that the shapes hold no key nobody sends.
import { describe, expect, it } from 'vitest';
import type { FullState } from '../../core/state.gen.ts';
import type { StateShape as Frame } from '../../core/state/frame.ts';
import { SERVER_FEATURES } from '../features.gen.ts';

type Feature = (typeof SERVER_FEATURES)[number][1];

/** The keys the parts of the features declare, as literal types when the part is checked against a shape. */
type FeatureKeys = Feature extends infer F
  ? F extends { state: { keys: readonly (infer K)[] } }
    ? K
    : never
  : never;

type Same<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

describe('the contract of the state', () => {
  it('has a shape for every key of a feature and no shape for a key nobody sends', () => {
    // The keys of the frame are the keys of its shape, the others come from
    // the features: together they are the keys of the whole state.
    const exact: Same<keyof FullState, keyof Frame | FeatureKeys> = true;
    expect(exact).toBe(true);
  });
});
