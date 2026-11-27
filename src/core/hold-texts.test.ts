// The texts of „Wache stellen“ of #440, each word for word. The owner has not
// decided them yet: they are marked placeholders, and when the owner's words
// come, these expectations take them. The decided report texts are built in
// src/server/game/holding.ts and pinned in hold-rework.test.ts.
import { describe, expect, it } from 'vitest';
import {
  HOLD_LEXICON,
  HOLD_OFF_REFUSAL,
  HOLD_OPTION_TITLE,
  HOLD_REASON_TEXT,
  HOLD_REPORT_TITLE,
  HOLDS_REFUSED_REFUSAL,
} from './hold-texts.ts';

describe('the texts of „Wache stellen“ (#440)', () => {
  it('give each reason of a hold that turns home', () => {
    expect(HOLD_REASON_TEXT).toEqual({
      off: '[TEXT PENDING #440: Grund off]',
      bond: '[TEXT PENDING #440: Grund bond]',
      refused: '[TEXT PENDING #440: Grund refused]',
    });
  });

  it('give the two refusals of a launch', () => {
    expect(HOLD_OFF_REFUSAL).toBe('[TEXT PENDING #440: refusal off]');
    expect(HOLDS_REFUSED_REFUSAL).toBe('[TEXT PENDING #440: refusal refused]');
  });

  it('give the titles of the four reports', () => {
    expect(HOLD_REPORT_TITLE).toEqual({
      launch: '[TEXT PENDING #440: title launch]',
      arrival: '[TEXT PENDING #440: title arrival]',
      notAllowed: '[TEXT PENDING #440: title not allowed]',
      sentAway: '[TEXT PENDING #440: title sent away]',
    });
  });

  it('give the two lines of the Lexicanum, without a digit (a Lexicanum text types no number)', () => {
    expect(HOLD_LEXICON).toEqual({
      lapsedProtection:
        '[TEXT PENDING Wache stellen: Lexicanum lapsed protection]',
      noLoot: '[TEXT PENDING Wache stellen: Lexicanum held cargo no loot]',
    });
  });

  it('give the title of the option box', () => {
    expect(HOLD_OPTION_TITLE).toBe('[TEXT PENDING #440: box title]');
  });
});
