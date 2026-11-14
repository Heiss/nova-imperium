// Mapping helpers shared by the repositories: a row of better-sqlite3 to the
// plain objects of the game, and back.
import type { Levels, Queue, ResearchQueue } from '../../../core/types.ts';

export type Row = Record<string, unknown>;

export const queueOf = (r: Row, p: 'bq' | 'rq'): Queue | null =>
  r[`${p}_key`] == null
    ? null
    : {
        key: r[`${p}_key`] as string,
        lvl: r[`${p}_lvl`] as number,
        start: r[`${p}_start`] as number,
        end: r[`${p}_end`] as number,
        cost: [
          r[`${p}_cost_m`] as number,
          r[`${p}_cost_c`] as number,
          r[`${p}_cost_d`] as number,
        ],
      };

/** The running research; `rq_planet` is empty for research started before #49. */
export function researchQueueOf(r: Row): ResearchQueue | null {
  const q = queueOf(r, 'rq');
  return q && r.rq_planet != null ? { ...q, planet: r.rq_planet as string } : q;
}

const QUEUE_FIELDS = [
  'key',
  'lvl',
  'start',
  'end',
  'cost_m',
  'cost_c',
  'cost_d',
] as const;

export const queueParams = (q: Queue | null, p: 'bq' | 'rq'): Row => {
  const values = q ? [q.key, q.lvl, q.start, q.end, ...q.cost] : [];
  return Object.fromEntries(
    QUEUE_FIELDS.map((f, i) => [`${p}_${f}`, values[i] ?? null]),
  );
};

export const levels = (rows: Row[], key: string, value: string): Levels =>
  Object.fromEntries(rows.map((r) => [r[key] as string, r[value] as number]));
