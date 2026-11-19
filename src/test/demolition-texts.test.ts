// The refusals of „Zurückbauen“ (#202) are one text for the browser and the
// server, as O18 (c) made them for the „Endzeit“ (F15). Each side keeps its
// own table, as patterns section 7 says; this test keeps them equal.
import { describe, expect, it } from 'vitest';
import { DEMOLITION_NOTE } from '../client/logic/demolition.ts';
import { DEMOLITION_ERROR } from '../server/game/demolition.ts';

describe('the refusals of „Zurückbauen“', () => {
  it('are the same in the browser and on the server', () => {
    expect(DEMOLITION_NOTE).toEqual(DEMOLITION_ERROR);
  });
});
