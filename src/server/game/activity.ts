// The public activity markers (#229, okf/features/activity-indicators.md):
// the server records the events of src/core/activity.ts and sends only the
// coarse markers, never a time. A login sets activity on the main planet
// (#221), a manual action in the account on every own planet and moon; both
// count as the account's last activity, which decides its inactivity.
// Fleets, spying and finished buildings set none (owner, 2026-11-17).
import {
  type ActivityEvent,
  type ActivityLimits,
  type Inactivity,
  type PlanetActivity,
  activityPlaces,
  inactivity,
  planetActivity,
} from '../../core/activity.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import { mainPlanet } from './main-planet.ts';

/** Records a login or a manual action of `u` now. */
export function recordActivity(
  ctx: Ctx,
  u: User,
  event: Extract<ActivityEvent, 'login' | 'action'>,
): void {
  const now = ctx.now();
  const own = ctx.planets.ofOwner(u.id).map((p) => p.id);
  const main = event === 'login' ? (mainPlanet(ctx, u)?.id ?? null) : null;
  ctx.tx(() => {
    ctx.planets.markActive(activityPlaces(event, own, main), now);
    ctx.players.markActive(u.id, now);
  });
}

/** The public activity of every planet and moon that shows one now. */
export function planetActivities(
  ctx: Ctx,
  limits: Readonly<ActivityLimits>,
): Record<string, PlanetActivity> {
  const now = ctx.now();
  const out: Record<string, PlanetActivity> = {};
  for (const [id, at] of Object.entries(ctx.planets.activeTimes())) {
    const shown = planetActivity(at, now, limits);
    if (shown) out[id] = shown;
  }
  return out;
}

/**
 * The public activity of one place at a time with the round's thresholds:
 * the activity in the Auspex-Bericht (#175 D5, Q3), the same rule as on the
 * Sternenkarte.
 */
export const placeActivity = (
  ctx: Ctx,
  id: string,
  at: number,
  limits: Readonly<ActivityLimits>,
): PlanetActivity | null =>
  planetActivity(ctx.planets.activeAt(id), at, limits);

/** The inactivity of every account that is inactive now. */
export function inactivities(
  ctx: Ctx,
  limits: Readonly<ActivityLimits>,
): Record<string, Inactivity> {
  const now = ctx.now();
  const out: Record<string, Inactivity> = {};
  for (const [uid, last] of Object.entries(ctx.players.lastActive())) {
    const shown = inactivity(last, now, limits);
    if (shown) out[uid] = shown;
  }
  return out;
}
