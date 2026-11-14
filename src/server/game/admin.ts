// Admin actions on the universe: change the settings live, start a new round.
import { settle } from '../../core/settle.ts';
import { validateUniverse } from '../../core/universe.ts';
import type { Action } from './actions.ts';
import { addReport, type Ctx, fail, str, universe } from './context.ts';
import { roundRules, startRoundRules } from './round.ts';
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
    ctx.planets.usedSize(),
  );
  if (!checked.ok) return fail(checked.errors.join(' '));
  const old = universe(ctx);
  const t = ctx.now();
  for (const p of ctx.planets.all())
    ctx.planets.save(settle(p, t, old, ctx.players.get(p.owner)));
  ctx.admin.saveUniverse(checked.value);
  return 'Einstellungen gespeichert.';
};

function newRound(ctx: Ctx): void {
  ctx.planets.deleteAll();
  ctx.fleets.deleteAll();
  ctx.debris.deleteAll();
  ctx.db.exec(`
    DELETE FROM push_jobs;
    DELETE FROM achievement_progress;
    DELETE FROM achievement_claims;
    DELETE FROM daily_rewards;
  `);
  const u = universe(ctx);
  for (const x of ctx.players.all()) {
    x.research = {};
    x.rq = null;
    x.readAt = 0;
    ctx.players.save(x);
    ctx.reports.deleteAll(x.id);
    placePlanet(
      ctx,
      x.id,
      'Heimatplanet',
      1 + Math.floor(ctx.rng() * u.galaxies),
    );
  }
}

export const reset: Action = (ctx, u, data, event) => {
  requireAdmin(u);
  const before = roundRules(ctx);
  const after = startRoundRules(ctx, data.rewards);
  newRound(ctx);
  if (event) event.detail = { before, after };
  return 'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.';
};

export function announce(ctx: Ctx, input: unknown): number {
  if (typeof input !== 'string' || input.trim().length > 500)
    return fail('Bitte eine Nachricht mit höchstens 500 Zeichen eingeben.');
  const message = str(input, 500);
  if (!message) return fail('Bitte eine Nachricht eingeben.');
  const players = ctx.players.all();
  const time = ctx.now();
  for (const player of players) {
    addReport(
      ctx,
      player.id,
      { time, type: 'info', title: 'Servernachricht', text: message },
      { topic: 'announcement', body: `Servernachricht: ${message}` },
    );
  }
  return players.length;
}
