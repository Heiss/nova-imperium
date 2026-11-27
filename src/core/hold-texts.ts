// The texts of „Wache stellen“ that the owner has not decided yet (#440).
// Each is a marked placeholder, never a German text of its own: the owner
// chooses the words, and the pull request lists the options. Shared by the
// server (refusals, reports) and the browser (none yet).

/** Why a hold turns home: the {Grund} of „Deine Wache bei {Planet} kehrt zurück: {Grund}.“ */
export const HOLD_REASON_TEXT = {
  /** The admin switched „Wache stellen“ off (240a). */
  off: '[TEXT PENDING #440: Grund off]',
  /** The bond ended or „Verbündete“ changed (229a). */
  bond: '[TEXT PENDING #440: Grund bond]',
  /** The host switched „Keine Wachen annehmen“ on (282a). */
  refused: '[TEXT PENDING #440: Grund refused]',
} as const;

/** The refusal of a launch while „Wache stellen“ is off (240a). */
export const HOLD_OFF_REFUSAL = '[TEXT PENDING #440: refusal off]';

/** The refusal of a launch to a host with „Keine Wachen annehmen“ (230b). */
export const HOLDS_REFUSED_REFUSAL = '[TEXT PENDING #440: refusal refused]';
