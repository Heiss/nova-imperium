// Admin actions on the universe: change the settings live, start a new round.
import { settle } from '../../shared/settle.ts';
import { validateUniverse } from '../../shared/universe.ts';
import type { Action } from './actions.ts';
import { type Ctx, fail, universe } from './context.ts';
import { placePlanet } from './planets.ts';

export const requireAdmin = (u: { admin: boolean }): void => {
  if (!u.admin) fail('Nur der Admin darf das.');
};

/**
 * Saves new settings. All planets are moved forward to now with the old
 * settings first, so the time before the change keeps the old speed. Running
 * buildings and flights keep their end time.
 */
export const saveSettings: Action = (ctx, u, d) => {
  requireAdmin(u);
  const checked = validateUniverse(
    (d.settings as Record<string, unknown> | null) ?? {},
    ctx.store.usedSize(),
  );
  if (!checked.ok) return fail(checked.errors.join(' '));
  const old = universe(ctx);
  const t = ctx.now();
  for (const p of ctx.store.planets()) ctx.store.savePlanet(settle(p, t, old));
  ctx.store.saveUniverse(checked.value);
  return 'Einstellungen gespeichert.';
};

export function newRound(ctx: Ctx): void {
  ctx.store.deleteAllPlanets();
  ctx.store.deleteAllFleets();
  ctx.store.db.prepare('DELETE FROM push_jobs').run();
  const u = universe(ctx);
  for (const x of ctx.store.users()) {
    x.research = {};
    x.rq = null;
    x.readAt = 0;
    ctx.store.saveUser(x);
    ctx.store.deleteReports(x.id);
    placePlanet(
      ctx,
      x.id,
      'Heimatplanet',
      1 + Math.floor(ctx.rng() * u.galaxies),
    );
  }
}

export const reset: Action = (ctx, u) => {
  requireAdmin(u);
  newRound(ctx);
  return 'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.';
};
