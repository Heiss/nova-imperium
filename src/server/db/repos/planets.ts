// Planets (#117): a planet with its buildings, ships, defense, production
// shares and queues. The children are written with their planet, always.
import type { Planet } from '../../../core/types.ts';
import { isShip } from '../../../core/catalog.ts';
import type { UsedSize } from '../../../core/universe.ts';
import type { Db } from '../database.ts';
import { levels, queueOf, queueParams, type Row } from './rows.ts';

export interface Planets {
  get(id: string): Planet | null;
  /** The home planet: the oldest planet of the player. */
  home(uid: string): Planet | null;
  /** The planets of a player, the oldest first. */
  ofOwner(uid: string): Planet[];
  /** All planets by their coordinates. */
  all(): Planet[];
  save(p: Planet): void;
  deleteAll(): void;
  /** The largest galaxy, system and position in use. */
  usedSize(): UsedSize;
}

export class SqlitePlanets implements Planets {
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
    return {
      id: r.id as string,
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
      ships: levels(
        units.filter((u) => u.kind === 'ship'),
        'key',
        'count',
      ),
      def: levels(
        units.filter((u) => u.kind === 'defense'),
        'key',
        'count',
      ),
      bq: queueOf(r, 'bq'),
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
          'SELECT * FROM planets WHERE owner = ? ORDER BY created, id LIMIT 1',
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
        `INSERT INTO planets (id, owner, name, g, s, p, temp, diameter, unlimited, res_m, res_c, res_d,
           t, created, sq_t, bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c, bq_cost_d)
         VALUES (@id, @owner, @name, @g, @s, @p, @temp, @diameter, @unlimited, @res_m, @res_c, @res_d,
           @t, @created, @sq_t, @bq_key, @bq_lvl, @bq_start, @bq_end, @bq_cost_m, @bq_cost_c, @bq_cost_d)
         ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, name = excluded.name,
           temp = excluded.temp, diameter = excluded.diameter, unlimited = excluded.unlimited, res_m = excluded.res_m, res_c = excluded.res_c, res_d = excluded.res_d,
           t = excluded.t, sq_t = excluded.sq_t, bq_key = excluded.bq_key, bq_lvl = excluded.bq_lvl,
           bq_start = excluded.bq_start, bq_end = excluded.bq_end, bq_cost_m = excluded.bq_cost_m,
           bq_cost_c = excluded.bq_cost_c, bq_cost_d = excluded.bq_cost_d`,
      )
      .run({
        id: p.id,
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
        ...queueParams(p.bq, 'bq'),
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

  deleteAll(): void {
    this.db.prepare('DELETE FROM planets').run();
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
