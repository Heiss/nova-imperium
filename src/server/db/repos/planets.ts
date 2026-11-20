// Planets (#117): a planet with its buildings, ships, defense, production
// shares and queues. The children are written with their planet, always.
import type { Coords, Levels, Planet } from '../../../core/types.ts';
import { isShip } from '../../../core/catalog.ts';
import type { UsedSize } from '../../../core/universe.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import { buildQueueOf, buildQueueParams, levels, type Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

/** A position locked after its colony was given up, until `until` (#224, D2). */
interface PositionLock extends Coords {
  until: number;
}

export interface Planets {
  get(id: string): Planet | null;
  /** The home planet: the oldest planet of the player. */
  home(uid: string): Planet | null;
  /** The planets of a player, the oldest first. */
  ofOwner(uid: string): Planet[];
  /** All planets by their coordinates. */
  all(): Planet[];
  save(p: Planet): void;
  /**
   * When the Warp-Tor of a moon is ready again (#230): 0 when it never
   * cooled down. The time goes with the moon.
   */
  gateReady(id: string): number;
  /** Stores when the Warp-Tor of a moon is ready again (#230). */
  setGateReady(id: string, ready: number): void;
  /** Deletes a planet or moon with its buildings, units, shares and queues. */
  delete(id: string): void;
  /** Deletes every planet and every lock of a position (a new round). */
  deleteAll(): void;
  /** Locks a position for colonization until `until` (#224, D2). */
  lockPosition(c: Coords, until: number): void;
  /** When the lock of a position ends, or null without one; an ended lock is not removed. */
  positionLock(c: Coords): number | null;
  /** Every lock of a position that holds after `now`, by position (#224). */
  locks(now: number): PositionLock[];
  /** The largest galaxy, system and position in use. */
  usedSize(): UsedSize;
  /** Sets the time of the last activity (#229) of the places `ids`. */
  markActive(ids: readonly string[], at: number): void;
  /** The time of the last activity of every place that has one (#229). */
  activeTimes(): Record<string, number>;
  /** The time of the last activity of one place, or null without one (#175). */
  activeAt(id: string): number | null;
}

class SqlitePlanets implements Planets {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  private planetOf(r: Row | undefined): Planet | null {
    if (!r) return null;
    const q = (sql: string): Row[] => this.db.prepare(sql).all(r.id) as Row[];
    const units = q(
      'SELECT kind, key, count FROM planet_units WHERE planet_id = ?',
    );
    const unitsOf = (kind: string): Levels =>
      levels(
        units.filter((u) => u.kind === kind),
        'key',
        'count',
      );
    return {
      id: r.id as string,
      kind: r.kind as Planet['kind'],
      owner: r.owner as string,
      name: r.name as string,
      g: r.g as number,
      s: r.s as number,
      p: r.p as number,
      temp: r.temp as number,
      diameter: r.diameter as number,
      unlimited: r.unlimited === 1,
      res: { m: r.res_m as number, c: r.res_c as number, d: r.res_d as number },
      b: levels(
        q('SELECT key, level FROM planet_buildings WHERE planet_id = ?'),
        'key',
        'level',
      ),
      ships: unitsOf('ship'),
      def: unitsOf('defense'),
      bq: buildQueueOf(r),
      sq: q(
        'SELECT key, n, unit_ms FROM shipyard_queue WHERE planet_id = ? ORDER BY pos',
      ).map((x) => ({
        key: x.key as string,
        n: x.n as number,
        unit: Math.ceil(x.unit_ms as number),
      })),
      sqT: (r.sq_t as number | null) ?? null,
      pct: levels(
        q('SELECT key, pct FROM planet_production WHERE planet_id = ?'),
        'key',
        'pct',
      ),
      t: r.t as number,
      created: r.created as number,
    };
  }

  get(id: string): Planet | null {
    return this.planetOf(
      this.db.prepare('SELECT * FROM planets WHERE id = ?').get(id) as Row,
    );
  }

  home(uid: string): Planet | null {
    return this.planetOf(
      this.db
        .prepare(
          // A moon is never the home planet (#53).
          "SELECT * FROM planets WHERE owner = ? AND kind = 'planet' ORDER BY created, id LIMIT 1",
        )
        .get(uid) as Row,
    );
  }

  ofOwner(uid: string): Planet[] {
    const rows = this.db
      .prepare('SELECT * FROM planets WHERE owner = ? ORDER BY created, id')
      .all(uid) as Row[];
    return rows.map((r) => this.planetOf(r)!);
  }

  all(): Planet[] {
    const rows = this.db
      .prepare('SELECT * FROM planets ORDER BY g, s, p')
      .all() as Row[];
    return rows.map((r) => this.planetOf(r)!);
  }

  save(p: Planet): void {
    this.db
      .prepare(
        `INSERT INTO planets (id, kind, owner, name, g, s, p, temp, diameter, unlimited, res_m, res_c, res_d,
           t, created, sq_t, bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c, bq_cost_d,
           bq_back_m, bq_back_c, bq_back_d)
         VALUES (@id, @kind, @owner, @name, @g, @s, @p, @temp, @diameter, @unlimited, @res_m, @res_c, @res_d,
           @t, @created, @sq_t, @bq_key, @bq_lvl, @bq_start, @bq_end, @bq_cost_m, @bq_cost_c, @bq_cost_d,
           @bq_back_m, @bq_back_c, @bq_back_d)
         ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, name = excluded.name,
           temp = excluded.temp, diameter = excluded.diameter, unlimited = excluded.unlimited, res_m = excluded.res_m, res_c = excluded.res_c, res_d = excluded.res_d,
           t = excluded.t, sq_t = excluded.sq_t, bq_key = excluded.bq_key, bq_lvl = excluded.bq_lvl,
           bq_start = excluded.bq_start, bq_end = excluded.bq_end, bq_cost_m = excluded.bq_cost_m,
           bq_cost_c = excluded.bq_cost_c, bq_cost_d = excluded.bq_cost_d,
           bq_back_m = excluded.bq_back_m, bq_back_c = excluded.bq_back_c, bq_back_d = excluded.bq_back_d`,
      )
      .run({
        id: p.id,
        kind: p.kind,
        owner: p.owner,
        name: p.name,
        g: p.g,
        s: p.s,
        p: p.p,
        temp: p.temp,
        diameter: p.diameter,
        unlimited: Number(p.unlimited),
        res_m: p.res.m,
        res_c: p.res.c,
        res_d: p.res.d,
        t: p.t,
        created: p.created,
        sq_t: p.sqT,
        ...buildQueueParams(p.bq),
      });
    this.replaceChildren(p);
  }

  private replaceChildren(p: Planet): void {
    for (const t of [
      'planet_buildings',
      'planet_units',
      'planet_production',
      'shipyard_queue',
    ])
      this.db.prepare(`DELETE FROM ${t} WHERE planet_id = ?`).run(p.id);
    const b = this.db.prepare('INSERT INTO planet_buildings VALUES (?, ?, ?)');
    for (const [k, l] of Object.entries(p.b)) b.run(p.id, k, l);
    const u = this.db.prepare('INSERT INTO planet_units VALUES (?, ?, ?, ?)');
    for (const [k, n] of Object.entries({ ...p.ships, ...p.def }))
      if (n > 0) u.run(p.id, isShip(k) ? 'ship' : 'defense', k, n);
    const pr = this.db.prepare(
      'INSERT INTO planet_production VALUES (?, ?, ?)',
    );
    for (const [k, v] of Object.entries(p.pct)) pr.run(p.id, k, v);
    const sq = this.db.prepare(
      'INSERT INTO shipyard_queue VALUES (?, ?, ?, ?, ?)',
    );
    p.sq.forEach((q, i) => sq.run(p.id, i, q.key, q.n, q.unit));
  }

  gateReady(id: string): number {
    const r = this.db
      .prepare('SELECT ready FROM jump_gates WHERE moon_id = ?')
      .get(id) as Row | undefined;
    return (r?.ready as number | undefined) ?? 0;
  }

  setGateReady(id: string, ready: number): void {
    this.db
      .prepare(
        `INSERT INTO jump_gates (moon_id, ready) VALUES (?, ?)
         ON CONFLICT(moon_id) DO UPDATE SET ready = excluded.ready`,
      )
      .run(id, ready);
  }

  delete(id: string): void {
    // The children go with the planet (ON DELETE CASCADE).
    this.db.prepare('DELETE FROM planets WHERE id = ?').run(id);
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM planets').run();
    this.db.prepare('DELETE FROM position_locks').run();
  }

  lockPosition(c: Coords, until: number): void {
    this.db
      .prepare(
        `INSERT INTO position_locks (g, s, p, until) VALUES (?, ?, ?, ?)
         ON CONFLICT(g, s, p) DO UPDATE SET until = excluded.until`,
      )
      .run(c.g, c.s, c.p, until);
  }

  locks(now: number): PositionLock[] {
    return this.db
      .prepare(
        'SELECT g, s, p, until FROM position_locks WHERE until > ? ORDER BY g, s, p',
      )
      .all(now) as PositionLock[];
  }

  positionLock(c: Coords): number | null {
    const r = this.db
      .prepare(
        'SELECT until FROM position_locks WHERE g = ? AND s = ? AND p = ?',
      )
      .get(c.g, c.s, c.p) as Row | undefined;
    return r ? (r.until as number) : null;
  }

  markActive(ids: readonly string[], at: number): void {
    const put = this.db.prepare(
      'UPDATE planets SET active_at = ? WHERE id = ?',
    );
    for (const id of ids) put.run(at, id);
  }

  activeTimes(): Record<string, number> {
    const rows = this.db
      .prepare('SELECT id, active_at FROM planets WHERE active_at IS NOT NULL')
      .all() as Row[];
    return levels(rows, 'id', 'active_at');
  }

  activeAt(id: string): number | null {
    const r = this.db
      .prepare('SELECT active_at FROM planets WHERE id = ?')
      .get(id) as Row | undefined;
    return (r?.active_at as number | null | undefined) ?? null;
  }

  usedSize(): UsedSize {
    const r = this.db
      .prepare('SELECT MAX(g) AS g, MAX(s) AS s, MAX(p) AS p FROM planets')
      .get() as Row;
    return {
      g: (r.g as number) ?? 0,
      s: (r.s as number) ?? 0,
      p: (r.p as number) ?? 0,
    };
  }
}

/** The `planets` repository on `Ctx`. */
export const repository = {
  key: 'planets',
  make: (db: Db): Planets => new SqlitePlanets(db),
} as const satisfies RepositoryModule;

/** A new round starts without planets and without the locks of their places. */
export const roundReset = [
  { order: 10, clears: ['planets', 'position_locks'] },
] satisfies readonly RoundReset[];
