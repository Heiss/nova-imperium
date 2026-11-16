// The choices of a new round (#214, patterns, section 7): both reward
// options (achievements, daily rewards) and the guild switch (#191) are yes
// or no; an option the admin does not send keeps the one of the current
// round. The server words the refusal (`ROUND_ERROR`); the dialog „Neue
// Runde“ sends its checkboxes, always yes or no.
import type { RoundRules } from './achievements.ts';

/** What the admin chooses for the new round. */
type RoundChoice = Pick<RoundRules, 'achievements' | 'daily' | 'guilds'>;

/** Why the new round cannot start: the reward options, the guild switch. */
export type RoundError = 'rewards' | 'guilds';

/** The choices as sent, an option not sent taken from the current round. */
function chosen(
  current: RoundChoice,
  rewards: unknown,
  guilds: unknown,
): Record<keyof RoundChoice, unknown> {
  const selected = (rewards === undefined ? current : rewards) as Partial<
    Record<'achievements' | 'daily', unknown>
  > | null;
  return {
    achievements: selected?.achievements,
    daily: selected?.daily,
    guilds: guilds === undefined ? current.guilds : guilds,
  };
}

/**
 * Why the new round cannot start with the choices, or null when it can: the
 * reward options first, then the guild switch.
 */
export function roundError(
  current: RoundChoice,
  rewards: unknown,
  guilds: unknown,
): RoundError | null {
  const choice = chosen(current, rewards, guilds);
  if (
    typeof choice.achievements !== 'boolean' ||
    typeof choice.daily !== 'boolean'
  )
    return 'rewards';
  return typeof choice.guilds === 'boolean' ? null : 'guilds';
}

/** The choices of the new round, once `roundError` refused none. */
export const roundChoice = (
  current: RoundChoice,
  rewards: unknown,
  guilds: unknown,
): RoundChoice => chosen(current, rewards, guilds) as RoundChoice;
