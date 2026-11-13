// The mission names live apart from the game values (#131); the display
// texts of the catalog entries are checked in text.test.ts (#113).
import { describe, expect, it } from 'vitest';
import { MISSION } from './catalog.ts';
import { MISSION_TEXT } from './texts.ts';

describe('mission names', () => {
  it('names every mission and nothing else', () => {
    expect(MISSION).toEqual(MISSION_TEXT);
    expect(Object.keys(MISSION)).toEqual([
      'attack',
      'transport',
      'spy',
      'colonize',
      'deploy',
    ]);
  });
});
