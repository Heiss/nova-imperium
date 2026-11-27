// The texts of „Wache stellen“ of #440, the owner's words (2026-11-27,
// „klingen gut“). Shared by the server (refusals, reports), the Lexicanum
// and the browser (the title of the option box).

/** Why a hold turns home: the {Grund} of „Deine Wache bei {Planet} kehrt zurück: {Grund}.“ */
export const HOLD_REASON_TEXT = {
  /** The admin switched „Wache stellen“ off (240a). */
  off: 'Wache stellen ist in dieser Runde abgeschaltet',
  /** The bond ended or „Verbündete“ changed (229a). */
  bond: 'ihr seid keine Verbündeten mehr',
  /** The host switched „Keine Wachen annehmen“ on (282a). */
  refused: 'der Gastgeber nimmt keine Wachen mehr an',
} as const;

/** The refusal of a launch while „Wache stellen“ is off (240a). */
export const HOLD_OFF_REFUSAL =
  'Wache stellen ist in dieser Runde abgeschaltet.';

/** The refusal of a launch to a host with „Keine Wachen annehmen“ (230b). */
export const HOLDS_REFUSED_REFUSAL = 'Dieser Spieler nimmt keine Wachen an.';

/** The titles of the reports of a hold, to the host and to the owner. */
export const HOLD_REPORT_TITLE = {
  /** To the host at the launch (242c). */
  launch: 'Wache unterwegs',
  /** To the host at the arrival (242c). */
  arrival: 'Wache eingetroffen',
  /** To the owner when the hold is no longer allowed. */
  notAllowed: 'Wache kehrt zurück',
  /** To the owner when the host sent it away (230b). */
  sentAway: 'Wache weggeschickt',
} as const;

/** The Lexicanum lines of #440 (rule-allies, rule-battle, rule-protection). */
export const HOLD_LEXICON = {
  /** The noob protection lapses where a foreign fleet holds (238c, 281b). */
  lapsedProtection:
    'Hält bei einem geschützten Spieler eine fremde Flotte Wache, gilt sein Schutz an diesem Ort nicht für Sturmangriff und Auspex-Erkundung; vor Raketen bleibt er geschützt.',
  /** The cargo of held fleets is no loot (233b). */
  noLoot:
    'Eine Wache wird nicht geplündert: Ihre Ladung geht verloren, wenn sie zerstört wird.',
} as const;

/** The title of the box of „Keine Wachen annehmen“ in „Optionen“ (230b). */
export const HOLD_OPTION_TITLE = 'Wachen';
