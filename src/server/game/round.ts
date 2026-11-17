import type { RoundRules } from '../../core/achievements.ts';
import { isLockDays, MAIN_LOCK_DAYS } from '../../core/main-planet.ts';
import { type RoundError, roundChoice, roundError } from '../../core/round.ts';
import { isVacationHours, VACATION_HOURS } from '../../core/vacation.ts';
import { type Ctx, fail } from './context.ts';

/** The setting of the lock of the main planet in days (#221, D3). */
const MAIN_LOCK = 'roundMainLock';

/**
 * The setting of the minimum duration of the vacation mode in hours (#223,
 * D1): a key of `UNIVERSE_SPECS` too, so the admin changes it live (X1).
 */
const VACATION = 'roundVacationHours';

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
    // Existing universes keep a vacation for the default 24 h at least (#223).
    vacationHours: ctx.admin.setting(VACATION) ?? VACATION_HOURS.default,
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

/** The minimum duration of the vacation mode in the new round (#223); without a choice the current one. */
function vacationRule(current: RoundRules, hours: unknown): number {
  const selected = hours === undefined ? current.vacationHours : hours;
  if (!isVacationHours(selected))
    return fail(
      `Bitte für die Mindestdauer des Urlaubsmodus ${VACATION_HOURS.min} bis ${VACATION_HOURS.max} ganze Stunden angeben.`,
    );
  return selected;
}

/** The values of the dialog „Neue Runde“ beyond the rewards and the guild switch. */
interface RoundValues {
  mainLock?: unknown;
  vacationHours?: unknown;
}

export function startRoundRules(
  ctx: Ctx,
  options: unknown,
  guilds?: unknown,
  values: RoundValues = {},
): RoundRules {
  const current = roundRules(ctx);
  const error = roundError(current, options, guilds);
  if (error) fail(ROUND_ERROR[error]);
  const next = {
    number: current.number + 1,
    ...roundChoice(current, options, guilds),
    mainLock: mainLockRule(current, values.mainLock),
    vacationHours: vacationRule(current, values.vacationHours),
  };
  ctx.admin.putSettings([
    [MAIN_LOCK, next.mainLock],
    [VACATION, next.vacationHours],
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
    ['roundGuilds', Number(next.guilds)],
    ['roundStart', ctx.now()],
  ]);
  return next;
}
