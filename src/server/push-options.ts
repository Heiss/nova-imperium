// The push kinds a player switched off (issue #192). The switches belong to
// the account and apply to all of its devices; a kind not in `push_off` is
// on. Delivery drops a due push of a kind that is off (web-push.ts).
import { isPushTopic, PUSH_TOPICS, type PushTopic } from '../core/push.ts';
import type { Action } from './game/actions.ts';
import { type Ctx, fail } from './game/context.ts';

/** The kinds the player switched off, in the order of the options. */
export function pushOff(ctx: Ctx, uid: string): PushTopic[] {
  const rows = ctx.db
    .prepare('SELECT topic FROM push_off WHERE user_id = ?')
    .all(uid) as { topic: string }[];
  const off = new Set(rows.map((r) => r.topic));
  return PUSH_TOPICS.filter((t) => off.has(t));
}

/** The list of a request: known kinds only, else a refusal. */
const topics = (x: unknown): PushTopic[] =>
  Array.isArray(x) && x.every(isPushTopic) ? x : fail('Ungültig.');

/** Stores which kinds are off; every other kind is on. */
export const pushOptions: Action = (ctx, u, d) => {
  const off = new Set(topics(d.off));
  ctx.db.prepare('DELETE FROM push_off WHERE user_id = ?').run(u.id);
  const add = ctx.db.prepare(
    'INSERT INTO push_off (user_id, topic) VALUES (?, ?)',
  );
  for (const topic of off) add.run(u.id, topic);
  return 'Gespeichert.';
};
