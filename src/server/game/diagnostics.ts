import { DAY } from '../audit.ts';
import type { Ctx } from './context.ts';
import { suspension } from './moderation.ts';

export function playerStats(ctx: Ctx) {
  const now = ctx.now();
  const since = Math.floor(now / DAY) * DAY - 6 * DAY;
  return ctx.store.db
    .prepare(
      `
    WITH activity AS (
      SELECT player, SUM(CASE WHEN day >= ? THEN active_ms ELSE 0 END) AS activeMs, MAX(last_seen) AS lastSeen
      FROM player_activity GROUP BY player
    ), actions AS (
      SELECT actor, SUM(category = 'game' AND outcome = 'ok') AS actions,
        SUM(action IN ('login', 'loginPassword') AND outcome = 'rejected' AND time >= ?) AS failedLogins,
        SUM(category = 'game' AND time >= ?) AS recentActions
      FROM audit_events WHERE time >= ? GROUP BY actor
    )
    SELECT u.id, u.name, u.admin, a.lastSeen, COALESCE(a.activeMs, 0) AS activeMs,
      COALESCE(x.actions, 0) AS actions, COALESCE(x.failedLogins, 0) AS failedLogins,
      COALESCE(x.recentActions, 0) AS recentActions
    FROM users u LEFT JOIN activity a ON a.player = u.id
    LEFT JOIN actions x ON x.actor = u.id ORDER BY u.name
  `,
    )
    .all(since, now - 3600000, now - 60000, since);
}

export function playerDetail(ctx: Ctx, uid: string) {
  return {
    suspension: suspension(ctx, uid) ?? null,
    days: ctx.store.db
      .prepare(
        `
      WITH days AS (
        SELECT day FROM player_activity WHERE player = @uid AND day >= @since
        UNION
        SELECT time - time % @day FROM audit_events
        WHERE actor = @uid AND category = 'game' AND outcome = 'ok' AND time >= @since
      )
      SELECT d.day, COALESCE(a.active_ms, 0) AS activeMs,
        (SELECT COUNT(*) FROM audit_events WHERE actor = @uid AND category = 'game'
         AND outcome = 'ok' AND time >= d.day AND time < d.day + @day) AS actions
      FROM days d LEFT JOIN player_activity a ON a.player = @uid AND a.day = d.day
      ORDER BY d.day DESC
    `,
      )
      .all({
        uid,
        day: DAY,
        since: Math.floor(ctx.now() / DAY) * DAY - 6 * DAY,
      }),
  };
}

export function orders(ctx: Ctx, player: string, reference: string) {
  return ctx.store.db
    .prepare(
      `
    SELECT * FROM (
    SELECT 'Gebäude' AS kind, id, owner AS player, bq_key AS item, bq_end AS due, t AS processed
    FROM planets WHERE bq_end IS NOT NULL AND (@player = '' OR owner = @player)
    UNION ALL
    SELECT 'Forschung', id, id, rq_key, rq_end, NULL
    FROM users WHERE rq_end IS NOT NULL AND (@player = '' OR id = @player)
    UNION ALL
    SELECT 'Werft', p.id, p.owner, q.key,
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
