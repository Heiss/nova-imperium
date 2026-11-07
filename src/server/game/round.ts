import type { RoundRules } from '../../shared/achievements.ts';
import { type Ctx, fail } from './context.ts';

export function roundRules(ctx: Ctx): RoundRules {
  const rows = ctx.store.db
    .prepare(
      "SELECT key, value FROM settings WHERE key IN ('round', 'roundAchievements', 'roundDaily')",
    )
    .all() as { key: string; value: number }[];
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  return {
    number: settings.get('round') ?? 1,
    achievements: settings.get('roundAchievements') !== 0,
    daily: settings.get('roundDaily') !== 0,
  };
}

export function startRoundRules(ctx: Ctx, options: unknown): RoundRules {
  const current = roundRules(ctx);
  const selected =
    options === undefined ? current : (options as Partial<RoundRules> | null);
  if (
    typeof selected?.achievements !== 'boolean' ||
    typeof selected.daily !== 'boolean'
  )
    return fail(
      'Bitte beide Belohnungseinstellungen für die neue Runde auswählen.',
    );
  const next = {
    number: current.number + 1,
    achievements: selected.achievements,
    daily: selected.daily,
  };
  const put = ctx.store.db.prepare(
    'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  put.run('round', next.number);
  put.run('roundAchievements', Number(next.achievements));
  put.run('roundDaily', Number(next.daily));
  return next;
}
