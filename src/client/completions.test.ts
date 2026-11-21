import { afterEach, describe, expect, it } from 'vitest';
import { rememberCompletions } from './completions.ts';
import { client } from './logic/state.svelte.ts';
import type { V } from './views/common.ts';

afterEach(() => client.forget());

const state = (id: string, fleets: object[] = [], now = 100): V =>
  ({
    P: { id, bq: null, b: {}, sq: [], sqT: null },
    R: { rq: null, research: {} },
    s: { me: { id: 'anna' }, fleets },
    now,
  }) as unknown as V;

describe('what finished between two renders', () => {
  it('remembers the return of an own fleet that is gone from the state', () => {
    const back = { id: 'f1', owner: 'anna', state: 'back', ret: 90 };
    rememberCompletions(state('p1', [back]), state('p1'));
    expect(client.completedMenu.get('fleet')).toBe('Die Flotte kehrt heim');
  });

  it('does not remember a fleet that is still flying, or another player’s', () => {
    const flying = { id: 'f1', owner: 'anna', state: 'back', ret: 90 };
    rememberCompletions(state('p1', [flying]), state('p1', [flying]));
    const other = { id: 'f2', owner: 'berta', state: 'back', ret: 90 };
    rememberCompletions(state('p1', [other]), state('p1'));
    const late = { id: 'f3', owner: 'anna', state: 'back', ret: 500 };
    rememberCompletions(state('p1', [late]), state('p1'));
    expect(client.completedMenu.size).toBe(0);
  });

  it('remembers a finished order of the shipyard and of the defense', () => {
    const planet = {
      id: 'p1',
      bq: null,
      b: {},
      sqT: 10,
      sq: [{ key: 'defender', unit: 10, n: 2 }],
    };
    const previous = { ...state('p1'), P: planet } as unknown as V;
    rememberCompletions(previous, state('p1', [], 100));
    expect(
      client.completionNotices.has('Auftrag der Schiffsschmiede fertig.'),
    ).toBe(true);
    expect(client.completedMenu.size).toBe(1);
  });

  it('remembers nothing when the player changed the planet', () => {
    const back = { id: 'f1', owner: 'anna', state: 'back', ret: 90 };
    rememberCompletions(state('p1', [back]), state('p2'));
    expect(client.completedMenu.size).toBe(0);
  });
});
