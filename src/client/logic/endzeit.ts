// The notes of the „Endzeit“ in the admin panel (#161, #214): the dialog asks
// `endzeitError` of src/core/endzeit.ts, the check of the server, before it
// sends the action. Since O18 (c) (owner, 2026-11-15, F15) the notes are the
// server's refusals, word for word.
import { type EndzeitError, endzeitError } from '../../core/endzeit.ts';

/** The note of each refusal; „done“ is also the text of the box. */
export const ENDZEIT_NOTE: Readonly<Record<EndzeitError, string>> = {
  done: 'In dieser Runde wurde die Endzeit schon eingeläutet.',
  minutes: 'Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.',
};

/**
 * The note that keeps the dialog from sending the „Endzeit“ with the flight
 * time typed in, or null when the action goes to the server.
 */
export function endzeitNote(done: boolean, minutes: string): string | null {
  const error = endzeitError(done, minutes);
  return error ? ENDZEIT_NOTE[error] : null;
}
