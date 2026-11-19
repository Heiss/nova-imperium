// The rules of the round on the server (#283): `roundRules()` reads every
// setting of the registry `ROUND_SETTINGS` (src/core/round.ts), and a new
// round checks and stores them. A feature adds its entry there, not here.
import {
  ROUND_SETTINGS,
  type RoundNumber,
  type RoundRules,
  type RoundSetting,
  roundRefused,
  freshValues,
  roundValues,
  storedValues,
} from '../../core/round.ts';
import { type Ctx, fail } from './context.ts';

export function roundRules(
  ctx: Ctx,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): RoundRules {
  return {
    number: ctx.admin.setting('round') ?? 1,
    ...storedValues((key) => ctx.admin.setting(key), settings),
  } as RoundRules;
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

/** The refusal of a value outside its range, as the universe settings word it (#214). */
export const rangeError = (s: {
  label: string;
  min: number;
  max: number;
}): string => `${s.label}: ganze Zahl von ${s.min} bis ${s.max}.`;

/**
 * The refusal of the refused entries: their own wording, each once, else the
 * range. A switch always has its own wording, so only a number gets the range.
 */
const refusal = (wrong: readonly RoundSetting[]): string =>
  [
    ...new Set(wrong.map((s) => s.refusal ?? rangeError(s as RoundNumber))),
  ].join(' ');

/**
 * Starts the rules of a new round from the request „reset“ (#283): every
 * setting of the registry as sent, else as in the current round. Nothing is
 * stored when one is refused.
 */
export function startRoundRules(
  ctx: Ctx,
  data: Record<string, unknown>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): RoundRules {
  const running = roundRules(ctx, settings);
  // Where the running round has no value of its own, a value that is not sent is the default (#237).
  const current = {
    ...running,
    ...freshValues((key) => ctx.admin.setting(key), settings),
  };
  const wrong = roundRefused(current, data, settings);
  if (wrong.length) fail(refusal(wrong));
  const next = {
    number: running.number + 1,
    ...roundValues(current, data, settings),
  } as RoundRules;
  const values = next as unknown as Record<string, number | boolean>;
  ctx.admin.putSettings([
    ...settings.map((s): [string, number] => [s.key, Number(values[s.name])]),
    ['round', next.number],
    ['roundStart', ctx.now()],
  ]);
  return next;
}
