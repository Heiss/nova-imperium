// O18 (c) (owner, 2026-11-15, #214): the refusals of the „Endzeit“ (F15) are
// one text for the browser and the server. Each side keeps its own table, as
// patterns section 7 says; this test keeps them equal.
import { describe, expect, it } from 'vitest';
import { ENDZEIT_NOTE } from '../client/logic/endzeit.ts';
import { ENDZEIT_ERROR } from '../server/game/endzeit.ts';

describe('the refusals of the „Endzeit“ (F15)', () => {
  it('are the same in the browser and on the server', () => {
    expect(ENDZEIT_NOTE).toEqual(ENDZEIT_ERROR);
  });
});
