// Fleets (#117): a fleet in flight with its ships and cargo.
import { missionRules } from '../../../core/missions.ts';
import type { Coords, Fleet } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import { levels, type Row } from './rows.ts';

export interface Fleets {
  get(id: string): Fleet | null;
  /** All fleets by departure. */
  all(): Fleet[];
  /** How many fleet slots a player uses: the fleets in flight, no gift (#161). */
  count(owner: string): number;
  /** Fleets whose next event (arrival, end of holding or return) is due, the earliest first. */
  due(now: number): Fleet[];
  /** The fleets flying to a place or holding there (#55), by departure. */
  at(place: string): Fleet[];
  save(f: Fleet): void;
  delete(id: string): void;
  deleteAll(): void;
}

const coordsOf = (r: Row, p: 'from' | 'to'): Coords => ({
  g: r[`${p}_g`] as number,
  s: r[`${p}_s`] as number,
  p: r[`${p}_p`] as number,
});

export class SqliteFleets implements Fleets {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  private fleetOf(r: Row | undefined): Fleet | null {
    if (!r) return null;
    const ships = this.db
      .prepare('SELECT key, count FROM fleet_ships WHERE fleet_id = ?')
      .all(r.id) as Row[];
    return {
      id: r.id as string,
      owner: r.owner as string,
      from: r.from_planet as string,
      fromC: coordsOf(r, 'from'),
      to: r.to_planet as string,
      toC: coordsOf(r, 'to'),
      mission: r.mission as Fleet['mission'],
      ships: levels(ships, 'key', 'count'),
      cargo: {
        m: r.cargo_m as number,
        c: r.cargo_c as number,
        d: r.cargo_d as number,
      },
      dep: r.dep as number,
      arr: r.arr as number,
      ret: r.ret as number,
      state: r.state as Fleet['state'],
      recalled: r.recalled === 1,
      fuel: r.fuel as number,
      ...(r.gift === 1 && { gift: true as const }),
      // Only a fleet that holds has a holding time (#55).
      ...(missionRules(r.mission as string)?.holds && {
        hold: r.hold as number,
      }),
    };
  }

  get(id: string): Fleet | null {
    return this.fleetOf(
      this.db.prepare('SELECT * FROM fleets WHERE id = ?').get(id) as Row,
    );
  }

  all(): Fleet[] {
    const rows = this.db
      .prepare('SELECT * FROM fleets ORDER BY dep, id')
      .all() as Row[];
    return rows.map((r) => this.fleetOf(r)!);
  }

  count(owner: string): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM fleets WHERE owner = ? AND gift = 0')
      .get(owner) as Row;
    return r.n as number;
  }

  due(now: number): Fleet[] {
    const rows = this.db
      .prepare(
        `SELECT *, CASE state WHEN 'out' THEN arr WHEN 'hold' THEN arr + hold ELSE ret END AS at
         FROM fleets WHERE at <= ? ORDER BY at, id`,
      )
      .all(now) as Row[];
    return rows.map((r) => this.fleetOf(r)!);
  }

  at(place: string): Fleet[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM fleets WHERE to_planet = ? AND state != 'back' ORDER BY dep, id",
      )
      .all(place) as Row[];
    return rows.map((r) => this.fleetOf(r)!);
  }

  save(f: Fleet): void {
    // Only a gift writes `gift` (#161): every other fleet keeps the default
    // 0, and a fleet never changes whether it is a gift.
    const gift = f.gift ? [', gift', ', 1'] : ['', ''];
    // Only a Halten writes `hold` (#55), set once at the launch.
    const hold = f.hold === undefined ? ['', ''] : [', hold', ', @hold'];
    this.db
      .prepare(
        `INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
           mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel${hold[0]}${gift[0]})
         VALUES (@id, @owner, @from, @from_g, @from_s, @from_p, @to, @to_g, @to_s, @to_p,
           @mission, @cargo_m, @cargo_c, @cargo_d, @dep, @arr, @ret, @state, @recalled, @fuel${hold[1]}${gift[1]})
         ON CONFLICT(id) DO UPDATE SET cargo_m = excluded.cargo_m, cargo_c = excluded.cargo_c,
           cargo_d = excluded.cargo_d, ret = excluded.ret, state = excluded.state, recalled = excluded.recalled`,
      )
      .run({
        id: f.id,
        owner: f.owner,
        from: f.from,
        from_g: f.fromC.g,
        from_s: f.fromC.s,
        from_p: f.fromC.p,
        to: f.to,
        to_g: f.toC.g,
        to_s: f.toC.s,
        to_p: f.toC.p,
        mission: f.mission,
        cargo_m: f.cargo.m,
        cargo_c: f.cargo.c,
        cargo_d: f.cargo.d,
        dep: f.dep,
        arr: f.arr,
        ret: f.ret,
        state: f.state,
        recalled: f.recalled ? 1 : 0,
        fuel: f.fuel,
        ...(f.hold !== undefined && { hold: f.hold }),
      });
    this.db.prepare('DELETE FROM fleet_ships WHERE fleet_id = ?').run(f.id);
    const put = this.db.prepare('INSERT INTO fleet_ships VALUES (?, ?, ?)');
    for (const [k, n] of Object.entries(f.ships))
      if (n > 0) put.run(f.id, k, n);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM fleets WHERE id = ?').run(id);
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM fleets').run();
  }
}
