// The notes of the „Endzeit“ dialog (#214, F15): the check of the server,
// asked before the action is sent.
import { describe, expect, it } from 'vitest';
import { ENDZEIT_NOTE, endzeitNote } from './endzeit.ts';

const DONE = 'In dieser Runde wurde die Endzeit schon eingeläutet.';
const MINUTES = 'Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.';

describe('the notes of the „Endzeit“', () => {
  it('keep the text of the box and the refusal of the server', () => {
    expect(ENDZEIT_NOTE).toEqual({ done: DONE, minutes: MINUTES });
  });

  it('send whole minutes from 1 to 4,320 as typed', () => {
    for (const minutes of ['1', '30', '240', '4320'])
      expect(endzeitNote(false, minutes)).toBeNull();
  });

  it('keep another time from the server', () => {
    for (const minutes of ['', '0', '4321', '1.5', '-5', 'abc'])
      expect(endzeitNote(false, minutes)).toBe(MINUTES);
  });

  it('say first that the round had its „Endzeit“', () => {
    expect(endzeitNote(true, '30')).toBe(DONE);
    expect(endzeitNote(true, '')).toBe(DONE);
  });
});
