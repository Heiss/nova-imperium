// The main planet („Hauptplanet“, #221, okf/features/main-planet.md): the
// player chooses it in the options. It is the planet shown when none is
// selected, the target of „zum Heimatsystem“ on the Sternenkarte and the
// planet of the research view; rewards, the Endzeit gift and the fields
// stay with the first planet (`planets.home()`, owner, 2026-11-16, D1).
// The rules are those of src/core/main-planet.ts (patterns, section 7).
import type { RoundRules } from '../../core/achievements.ts';
import {
  type Main,
  type MainPlanetError,
  mainLocked,
  mainOf,
  mainSwitchError,
} from '../../core/main-planet.ts';
import type { Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Action } from './actions.ts';
import { type Ctx, fail } from './context.ts';
import { roundRules } from './round.ts';

/** The main planet of `u` and the end of the lock of the last switch. */
export const mainPlanetOf = (
  ctx: Ctx,
  u: User,
  rules: RoundRules = roundRules(ctx),
): Main<Planet> =>
  mainOf(
    u.mainPlanet === null ? null : ctx.planets.get(u.mainPlanet),
    u.id,
    { switched: u.mainSwitched, days: rules.mainLock },
    () => ctx.planets.home(u.id),
  );

/** The main planet of `u`: the chosen one, or the oldest planet left (D6). */
export const mainPlanet = (ctx: Ctx, u: User): Planet | null =>
  mainPlanetOf(ctx, u).planet;

/** What the state shows: the id of the main planet and the end of a lock that still holds. */
export const mainPlanetView = (
  main: Main<Planet>,
  now: number,
): { mainPlanet: string | null; mainLock: number | null } => ({
  mainPlanet: main.planet?.id ?? null,
  mainLock: mainLocked(main.lockEnd, now) ? main.lockEnd : null,
});

/** The end of the lock in German, in the time of the server's players [V]. */
export const lockEndText = (t: number): string =>
  new Date(t).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The German message of each refusal [V]; the lock names its end. */
export const MAIN_ERROR: Readonly<
  Record<Exclude<MainPlanetError, 'locked'>, string>
> = {
  unknown: 'Das ist keiner deiner Planeten.',
  moon: 'Ein Mond kann nicht Hauptplanet sein.',
  same: 'Das ist bereits dein Hauptplanet.',
};

/** The refusal while the lock holds: when the choice is possible again. */
export const lockedText = (end: number): string =>
  `Der Hauptplanet ist gesperrt. Wieder änderbar ab ${lockEndText(end)}.`;

/** Makes the own planet `d.main` the main planet; every switch starts the lock (D4, D5). */
export const chooseMainPlanet: Action = (ctx, u, d) => {
  const main = mainPlanetOf(ctx, u);
  const target = typeof d.main === 'string' ? ctx.planets.get(d.main) : null;
  const error = mainSwitchError({
    target,
    uid: u.id,
    current: main.planet?.id ?? null,
    lockEnd: main.lockEnd,
    now: ctx.now(),
  });
  if (error === 'locked') return fail(lockedText(main.lockEnd!));
  if (error) return fail(MAIN_ERROR[error]);
  u.mainPlanet = target!.id;
  u.mainSwitched = ctx.now();
  ctx.players.save(u);
  return `${target!.name} ist jetzt dein Hauptplanet.`;
};
