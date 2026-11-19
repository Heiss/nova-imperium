import { DAY } from '../audit.ts';
import type { Ctx } from './context.ts';
import { suspension } from './moderation.ts';
import { dayTable, weekMs } from './playtime.ts';

/**
 * The players for the admin: the estimated active time of the last seven UTC
 * days is the one of the players' own view (#232, game/playtime.ts); the old
 * sums of `player_activity` (kept 30 days, no longer written) only give an
 * older last sighting.
 */
export function playerStats(ctx: Ctx) {
  const now = ctx.now();
  const since = Math.floor(now / DAY) * DAY - 6 * DAY;
  const rows = ctx.db
    .prepare(
      `
    WITH activity AS (
      SELECT player, MAX(last_seen) AS lastSeen
      FROM player_activity GROUP BY player
    ), actions AS (
      SELECT actor, SUM(category = 'game' AND outcome = 'ok') AS actions,
        SUM(action IN ('login', 'loginPassword') AND outcome = 'rejected' AND time >= ?) AS failedLogins,
        SUM(category = 'game' AND time >= ?) AS recentActions
      FROM audit_events WHERE time >= ? GROUP BY actor
    )
    SELECT u.id, u.name, u.admin, a.lastSeen,
      COALESCE(x.actions, 0) AS actions, COALESCE(x.failedLogins, 0) AS failedLogins,
      COALESCE(x.recentActions, 0) AS recentActions
    FROM users u LEFT JOIN activity a ON a.player = u.id
    LEFT JOIN actions x ON x.actor = u.id ORDER BY u.name
  `,
    )
    .all(now - 3600000, now - 60000, since) as {
    id: string;
    lastSeen: number | null;
  }[];
  const week = weekMs(ctx);
  const ends = ctx.playtime.lastActiveEnds();
  return rows.map((r) => ({
    ...r,
    lastSeen: Math.max(r.lastSeen ?? 0, ends[r.id] ?? 0) || null,
    activeMs: week.get(r.id) ?? 0,
  }));
}

/**
 * The planets of a player for „Mond anlegen“ (#53): each with whether a
 * moon is at its position already.
 */
function planetsOf(ctx: Ctx, uid: string) {
  const own = ctx.planets.ofOwner(uid);
  const moons = new Set(
    own.filter((x) => x.kind === 'moon').map((x) => `${x.g}:${x.s}:${x.p}`),
  );
  return own
    .filter((x) => x.kind === 'planet')
    .map((x) => ({
      id: x.id,
      name: x.name,
      g: x.g,
      s: x.s,
      p: x.p,
      moon: moons.has(`${x.g}:${x.s}:${x.p}`),
    }));
}

export function playerDetail(ctx: Ctx, uid: string) {
  return {
    suspension: suspension(ctx, uid) ?? null,
    planets: planetsOf(ctx, uid),
    // The days with active time or an action: the sums of the player's own view.
    days: dayTable(ctx, uid).filter((d) => d.activeMs > 0 || d.actions > 0),
  };
}

export function orders(ctx: Ctx, player: string, reference: string) {
  return ctx.db
    .prepare(
      `
    SELECT * FROM (
    SELECT 'Gebäude' AS kind, id, owner AS player, bq_key AS item, bq_end AS due, t AS processed
    FROM planets WHERE bq_end IS NOT NULL AND (@player = '' OR owner = @player)
    UNION ALL
    SELECT 'Forschung', id, id, rq_key, rq_end, NULL
    FROM users WHERE rq_end IS NOT NULL AND (@player = '' OR id = @player)
    UNION ALL
    SELECT 'Schiffsschmiede', p.id, p.owner, q.key,
      CAST(p.sq_t + SUM(q.n * q.unit_ms) OVER (PARTITION BY p.id ORDER BY q.pos) AS INTEGER), p.t
    FROM planets p JOIN shipyard_queue q ON q.planet_id = p.id
    WHERE (@player = '' OR p.owner = @player)
    UNION ALL
    SELECT 'Flotte', id, owner, mission, CASE state WHEN 'out' THEN arr ELSE ret END, NULL
    FROM fleets WHERE (@player = '' OR owner = @player)
    ) WHERE @reference = '' OR id = @reference
    ORDER BY due LIMIT 100
  `,
    )
    .all({ player, reference });
}
