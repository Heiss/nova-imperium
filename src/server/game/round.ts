import type { RoundRules } from '../../core/achievements.ts';
import {
  RECOGNITION_DEFAULT,
  RECOGNITION_KEYS,
  type Recognition,
  recognitionErrors,
  recognitionOf,
} from '../../core/fleet-recognition.ts';
import { isLockDays, MAIN_LOCK_DAYS } from '../../core/main-planet.ts';
import { type RoundError, roundChoice, roundError } from '../../core/round.ts';
import { UNIVERSE_SPECS, type UniverseSpec } from '../../core/universe.ts';
import { type Ctx, fail } from './context.ts';

/** The setting of the lock of the main planet in days (#221, D3). */
const MAIN_LOCK = 'roundMainLock';

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
    recognition: recognitionRules(ctx),
  };
}

/**
 * The thresholds of the recognition of foreign fleets (#228): the stored
 * settings, which the universe settings change too (X1); existing
 * universes start with the classic 2 / 4 / 8.
 */
const recognitionRules = (ctx: Ctx): Recognition => ({
  total: ctx.admin.setting(RECOGNITION_KEYS.total) ?? RECOGNITION_DEFAULT.total,
  types: ctx.admin.setting(RECOGNITION_KEYS.types) ?? RECOGNITION_DEFAULT.types,
  counts:
    ctx.admin.setting(RECOGNITION_KEYS.counts) ?? RECOGNITION_DEFAULT.counts,
});

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

/** The refusal of a value outside its range, as the universe settings word it (#214). */
export const rangeError = (s: UniverseSpec): string =>
  `${s.label}: ganze Zahl von ${s.min} bis ${s.max}.`;

const specOf = (key: string): UniverseSpec =>
  UNIVERSE_SPECS.find((s) => s.key === key)!;

/**
 * The thresholds of foreign fleets in the new round (#228, X1); without a
 * choice the current ones. Refused with the message of the universe
 * settings, every wrong threshold at once.
 */
function recognitionRule(current: RoundRules, input: unknown): Recognition {
  const wrong = recognitionErrors(current.recognition, input);
  if (wrong.length)
    fail(
      wrong.map((part) => rangeError(specOf(RECOGNITION_KEYS[part]))).join(' '),
    );
  return recognitionOf(current.recognition, input);
}

export function startRoundRules(
  ctx: Ctx,
  options: unknown,
  guilds?: unknown,
  mainLock?: unknown,
  recognition?: unknown,
): RoundRules {
  const current = roundRules(ctx);
  const error = roundError(current, options, guilds);
  if (error) fail(ROUND_ERROR[error]);
  const next = {
    number: current.number + 1,
    ...roundChoice(current, options, guilds),
    mainLock: mainLockRule(current, mainLock),
    recognition: recognitionRule(current, recognition),
  };
  ctx.admin.putSettings([
    [MAIN_LOCK, next.mainLock],
    [RECOGNITION_KEYS.total, next.recognition.total],
    [RECOGNITION_KEYS.types, next.recognition.types],
    [RECOGNITION_KEYS.counts, next.recognition.counts],
    ['round', next.number],
    ['roundAchievements', Number(next.achievements)],
    ['roundDaily', Number(next.daily)],
    ['roundGuilds', Number(next.guilds)],
    ['roundStart', ctx.now()],
  ]);
  return next;
}
