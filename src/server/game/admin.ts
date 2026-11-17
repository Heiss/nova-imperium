// Admin actions on the universe: change the settings live, start a new round.
import type { RoundRules } from '../../core/achievements.ts';
import { settle } from '../../core/settle.ts';
import {
  type UniverseCode,
  type UniverseSpec,
  type UsedSize,
  universeErrors,
  universeOf,
} from '../../core/universe.ts';
import type { Action } from './actions.ts';
import { addReport, type Ctx, fail, str, universe } from './context.ts';
import { roundRules, startRoundRules } from './round.ts';
import { placePlanet } from './planets.ts';

export const requireAdmin = (u: { admin: boolean }): void => {
  if (!u.admin) fail('Nur der Admin darf das.');
};

/** The message of each refused setting of `universeErrors` (#214). */
const SETTINGS_ERROR: Readonly<
  Record<UniverseCode, (spec: UniverseSpec, used: UsedSize) => string>
> = {
  range: (s) => `${s.label}: ganze Zahl von ${s.min} bis ${s.max}.`,
  used: (s, used) =>
    `${s.label}: mindestens ${used[s.size!]}, dort liegen schon Planeten.`,
};

/**
 * Saves new settings. All planets are moved forward to now with the old
 * settings first, so the time before the change keeps the old speed. Running
 * buildings and flights keep their end time.
 */
export const saveSettings: Action = (ctx, u, d) => {
  requireAdmin(u);
  const input = (d.settings as Record<string, unknown> | null) ?? {};
  const used = ctx.planets.usedSize();
  const errors = universeErrors(input, used);
  if (errors.length)
    return fail(
      errors.map((e) => SETTINGS_ERROR[e.code](e.spec, used)).join(' '),
    );
  const old = universe(ctx);
  const t = ctx.now();
  for (const p of ctx.planets.all())
    ctx.planets.save(settle(p, t, old, ctx.players.get(p.owner)));
  ctx.admin.saveUniverse(universeOf(input));
  return 'Einstellungen gespeichert.';
};

function newRound(ctx: Ctx, rules: RoundRules): void {
  ctx.planets.deleteAll();
  // A round with guilds off starts without any guild (#191); with guilds on
  // they stay, as before.
  if (!rules.guilds) ctx.guilds.deleteAll();
  // Every new round deletes all guild chats, guilds on or off (#169, D6).
  ctx.guilds.clearChats();
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
    // A new round starts with the first planet as the main planet, unlocked
    // (#221): a planet id is its place, so an old choice must not come back.
    x.mainPlanet = null;
    x.mainSwitched = null;
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
  const after = startRoundRules(ctx, data.rewards, data.guilds, {
    mainLock: data.mainLock,
    abandonLock: data.abandonLock,
  });
  newRound(ctx, after);
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
