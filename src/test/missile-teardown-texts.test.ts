// The refusals of „Verschrotten“ of stored missiles (#54, 2026-11-21) are one text
// for the browser and the server. Each side keeps its own table, as patterns
// section 7 says; this test keeps them equal.
import { describe, expect, it } from 'vitest';
import { TEAR_DOWN_NOTE } from '../client/logic/missiles.ts';
import { TEAR_DOWN_ERROR } from '../server/game/missiles.ts';

describe('the refusals of „Verschrotten“ of missiles', () => {
  it('are the same in the browser and on the server', () => {
    expect(TEAR_DOWN_NOTE).toEqual(TEAR_DOWN_ERROR);
  });
});
