import { ABANDON_LOCK_HOURS, isAbandonLockHours } from '../../core/abandon.ts';
import type { RoundRules } from '../../core/achievements.ts';
import { isLockDays, MAIN_LOCK_DAYS } from '../../core/main-planet.ts';
import { type RoundError, roundChoice, roundError } from '../../core/round.ts';
import { type Ctx, fail } from './context.ts';

/** The setting of the lock of the main planet in days (#221, D3). */
const MAIN_LOCK = 'roundMainLock';

/** The setting of the lock of a given-up colony's position in hours (#224, D2). */
const ABANDON_LOCK = 'roundAbandonLock';

export function roundRules(ctx: Ctx): RoundRules {
  const rows = ctx.admin.roundSettings();
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  return {
    number: settings.get('round') ?? 1,
    achievements: settings.get('roundAchievements') !== 0,
    daily: settings.get('roundDaily') !== 0,
    // Existing universes start with guilds on, as before (#191).
    guilds: settings.get('roundGuilds') !== 0,
    // Existing universes lock for the default 7 days (#221).
    mainLock: ctx.admin.setting(MAIN_LOCK) ?? MAIN_LOCK_DAYS.default,
    // Existing universes lock a given-up position for the default 24 h (#224).
    abandonLock: ctx.admin.setting(ABANDON_LOCK) ?? ABANDON_LOCK_HOURS.default,
  };
}

/**
 * When the current round started (#220): set by every new round; the
 * migration of #220 gave a running round the creation time of its first
 * planet, or the time of the migration without one. Without the setting
 * the round starts now.
 */
export const roundStart = (ctx: Ctx): number =>
  ctx.admin.setting('roundStart') ?? ctx.now();

/** The refusal of every guild action while guilds are off (#191, owner). */
export const GUILDS_OFF = 'Gilden sind in dieser Runde abgeschaltet.';

/**
 * Whether guilds, with their chat (#169), are on in this round (#191). The
 * one switch: the guild actions, the guild data of the state and the chat
 * all follow it.
 */
export const guildsOn = (ctx: Ctx): boolean => roundRules(ctx).guilds;

/** Refuses with GUILDS_OFF while guilds are off (#191). */
export function requireGuilds(ctx: Ctx): void {
  if (!guildsOn(ctx)) fail(GUILDS_OFF);
}

/** The refusals of `roundError` (#214). */
const ROUND_ERROR: Readonly<Record<RoundError, string>> = {
  rewards: 'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.',
  guilds: 'Bitte auswählen, ob Gilden in der neuen Runde an sind.',
};

/** The lock of the main planet in the new round (#221); without a choice the current one. */
function mainLockRule(current: RoundRules, days: unknown): number {
  const selected = days === undefined ? current.mainLock : days;
  if (!isLockDays(selected))
    return fail(
      `Bitte für die Sperre des Hauptplaneten ${MAIN_LOCK_DAYS.min} bis ${MAIN_LOCK_DAYS.max} ganze Tage angeben.`,
    );
  return selected;
}

/** The lock of a given-up position in the new round (#224); without a choice the current one. */
function abandonLockRule(current: RoundRules, hours: unknown): number {
  const selected = hours === undefined ? current.abandonLock : hours;
  if (!isAbandonLockHours(selected))
    return fail(
      `Bitte für die Sperre einer aufgegebenen Position ${ABANDON_LOCK_HOURS.min} bis ${ABANDON_LOCK_HOURS.max} ganze Stunden angeben.`,
    );
  return selected;
}

/** The choices of the dialog „Neue Runde“ beyond the rewards and the guild switch. */
interface RoundLocks {
  mainLock?: unknown;
  abandonLock?: unknown;
}

export function startRoundRules(
  ctx: Ctx,
  options: unknown,
  guilds?: unknown,
  locks: RoundLocks = {},
): RoundRules {
  const current = roundRules(ctx);
  const error = roundError(current, options, guilds);
  if (error) fail(ROUND_ERROR[error]);
  const next = {
    number: current.number + 1,
    ...roundChoice(current, options, guilds),
    mainLock: mainLockRule(current, locks.mainLock),
    abandonLock: abandonLockRule(current, locks.abandonLock),
  };
  ctx.admin.putSettings([
    [MAIN_LOCK, next.mainLock],
    [ABANDON_LOCK, next.abandonLock],
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
    ['roundGuilds', Number(next.guilds)],
    ['roundStart', ctx.now()],
  ]);
  return next;
}
