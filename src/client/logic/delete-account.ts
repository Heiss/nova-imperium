// The sentences of „Account löschen“ (#191): the box of „Optionen“, the box of
// the lock screen of the vacation mode and the confirmation share them.
import type { RoundRules } from '../../core/round.ts';

/** The sentence of the box „Account löschen“ and what it says of a guild (#191). */
export const deleteAccountText = (round: Pick<RoundRules, 'guilds'>): string =>
  `Dein Konto und deine Spielstände werden dauerhaft gelöscht.${round.guilds ? ' Leitest du eine Gilde, wird sie aufgelöst.' : ''}`;

/** The sentence of the confirmation of „Account löschen“ (#191). */
export const deleteAccountDialogText = (
  round: Pick<RoundRules, 'guilds'>,
): string =>
  `Dein Konto und deine Spielstände werden unwiderruflich gelöscht.${round.guilds ? ' Eine von dir geleitete Gilde wird aufgelöst.' : ''}`;
