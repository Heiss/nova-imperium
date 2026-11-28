// The texts of „Wache stellen“ of #440, each word for word as the owner
// decided them (2026-11-27). The report texts built around them are in
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
      off: 'Wache stellen ist in dieser Runde abgeschaltet',
      bond: 'ihr seid keine Verbündeten mehr',
      refused: 'der Gastgeber nimmt keine Wachen mehr an',
    });
  });

  it('give the two refusals of a launch', () => {
    expect(HOLD_OFF_REFUSAL).toBe(
      'Wache stellen ist in dieser Runde abgeschaltet.',
    );
    expect(HOLDS_REFUSED_REFUSAL).toBe('Dieser Spieler nimmt keine Wachen an.');
  });

  it('give the titles of the four reports', () => {
    expect(HOLD_REPORT_TITLE).toEqual({
      launch: 'Wache unterwegs',
      arrival: 'Wache eingetroffen',
      notAllowed: 'Wache kehrt zurück',
      sentAway: 'Wache weggeschickt',
    });
  });

  it('give the two lines of the Lexicanum, without a digit (a Lexicanum text types no number)', () => {
    expect(HOLD_LEXICON).toEqual({
      lapsedProtection:
        'Hält bei einem geschützten Spieler die Flotte eines anderen Spielers Wache, gilt sein Schutz an diesem Ort nicht für Sturmangriff und Auspex-Erkundung, außer gegen den Besitzer dieser Wache; vor Raketen bleibt er geschützt.',
      cargoHandover:
        'Wird eine Wache im Kampf vernichtet, geht ihre Ladung an den Planeten des Gastgebers, bei Verlusten der Teil, der nicht mehr in die übrigen Schiffe passt. Dort gehört sie zum Vorrat und lässt sich wie jeder Vorrat plündern.',
    });
  });

  it('give the title of the option box', () => {
    expect(HOLD_OPTION_TITLE).toBe('Wachen');
  });
});
