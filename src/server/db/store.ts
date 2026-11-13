// All reads and writes of the game data. The game logic works on plain
// objects; this module maps them to the normalized tables.
import type {
  Coords,
  Fleet,
  Levels,
  Planet,
  Queue,
  ResearchQueue,
  Universe,
} from '../../shared/types.ts';
import { isShip } from '../../shared/catalog.ts';
import {
  DEFAULT_UNIVERSE,
  UNIVERSE_SPECS,
  type UsedSize,
} from '../../shared/universe.ts';
import type { ExplainMode } from '../../shared/explain.ts';
import type { Db } from './database.ts';

export interface User {
  id: string;
  name: string;
  email: string | null;
  salt: string;
  pw: string;
  admin: boolean;
  probes: number;
  /** Display option of the explanation texts (issue #63). */
  explain: ExplainMode;
  readAt: number;
  created: number;
  research: Levels;
  rq: ResearchQueue | null;
}

export interface Report {
  id: string;
  time: number;
  type: 'info' | 'spy' | 'battle';
  title: string;
  [field: string]: unknown;
}

export interface Invitation {
  id: string;
  email: string;
  tokenHash: string;
  createdBy: string | null;
  created: number;
  expires: number;
  usedAt: number | null;
  revokedAt: number | null;
}

type Row = Record<string, unknown>;

const queueOf = (r: Row, p: 'bq' | 'rq'): Queue | null =>
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
function researchQueueOf(r: Row): ResearchQueue | null {
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

const queueParams = (q: Queue | null, p: 'bq' | 'rq'): Row => {
  const values = q ? [q.key, q.lvl, q.start, q.end, ...q.cost] : [];
  return Object.fromEntries(
    QUEUE_FIELDS.map((f, i) => [`${p}_${f}`, values[i] ?? null]),
  );
};

const levels = (rows: Row[], key: string, value: string): Levels =>
  Object.fromEntries(rows.map((r) => [r[key] as string, r[value] as number]));

const coordsOf = (r: Row, p: 'from' | 'to'): Coords => ({
  g: r[`${p}_g`] as number,
  s: r[`${p}_s`] as number,
  p: r[`${p}_p`] as number,
});

export class Store {
  readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  /** Reserve the writer before reads, so a concurrent commit cannot stale the snapshot. */
  tx<T>(fn: () => T): T {
    return this.db.transaction(fn).immediate();
  }

  // ----- settings -----

  universe(): Universe {
    const rows = this.db
      .prepare('SELECT key, value FROM settings')
      .all() as Row[];
    const stored = levels(rows, 'key', 'value');
    const out: Record<string, number> = {};
    for (const s of UNIVERSE_SPECS)
      out[s.key] = stored[s.key] ?? DEFAULT_UNIVERSE[s.key];
    return out as unknown as Universe;
  }

  saveUniverse(u: Universe): void {
    const put = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const s of UNIVERSE_SPECS) put.run(s.key, u[s.key]);
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

  // ----- users -----

  private userOf(r: Row | undefined): User | null {
    if (!r) return null;
    const research = this.db
      .prepare('SELECT key, level FROM user_research WHERE user_id = ?')
      .all(r.id) as Row[];
    return {
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string | null) ?? null,
      salt: r.salt as string,
      pw: r.pw_hash as string,
      admin: r.admin === 1,
      probes: r.probes as number,
      explain: r.explain_mode as ExplainMode,
      readAt: r.read_at as number,
      created: r.created as number,
      research: levels(research, 'key', 'level'),
      rq: researchQueueOf(r),
    };
  }

  user(id: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row,
    );
  }

  userByName(name: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE name = ?').get(name) as Row,
    );
  }

  userByEmail(email: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row,
    );
  }

  users(): User[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created, id')
      .all() as Row[];
    return rows.map((r) => this.userOf(r)!);
  }

  saveUser(u: User): void {
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, salt, pw_hash, admin, probes, explain_mode, read_at, created,
           rq_key, rq_lvl, rq_start, rq_end, rq_cost_m, rq_cost_c, rq_cost_d, rq_planet)
         VALUES (@id, @name, @email, @salt, @pw, @admin, @probes, @explain, @readAt, @created,
           @rq_key, @rq_lvl, @rq_start, @rq_end, @rq_cost_m, @rq_cost_c, @rq_cost_d, @rq_planet)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email,
           salt = excluded.salt, pw_hash = excluded.pw_hash, admin = excluded.admin,
           probes = excluded.probes, explain_mode = excluded.explain_mode, read_at = excluded.read_at, rq_key = excluded.rq_key,
           rq_lvl = excluded.rq_lvl, rq_start = excluded.rq_start, rq_end = excluded.rq_end,
           rq_cost_m = excluded.rq_cost_m, rq_cost_c = excluded.rq_cost_c, rq_cost_d = excluded.rq_cost_d,
           rq_planet = excluded.rq_planet`,
      )
      .run({
        ...u,
        admin: u.admin ? 1 : 0,
        ...queueParams(u.rq, 'rq'),
        rq_planet: u.rq?.planet ?? null,
      });
    this.db.prepare('DELETE FROM user_research WHERE user_id = ?').run(u.id);
    const put = this.db.prepare(
      'INSERT INTO user_research (user_id, key, level) VALUES (?, ?, ?)',
    );
    for (const [k, l] of Object.entries(u.research)) put.run(u.id, k, l);
  }

  // ----- planets -----

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

  planet(id: string): Planet | null {
    return this.planetOf(
      this.db.prepare('SELECT * FROM planets WHERE id = ?').get(id) as Row,
    );
  }

  /** The home planet: the oldest planet of the player. */
  planetOfUser(uid: string): Planet | null {
    return this.planetOf(
      this.db
        .prepare(
          'SELECT * FROM planets WHERE owner = ? ORDER BY created, id LIMIT 1',
        )
        .get(uid) as Row,
    );
  }

  playerPlanets(uid: string): Planet[] {
    const rows = this.db
      .prepare('SELECT * FROM planets WHERE owner = ? ORDER BY created, id')
      .all(uid) as Row[];
    return rows.map((r) => this.planetOf(r)!);
  }

  planets(): Planet[] {
    const rows = this.db
      .prepare('SELECT * FROM planets ORDER BY g, s, p')
      .all() as Row[];
    return rows.map((r) => this.planetOf(r)!);
  }

  savePlanet(p: Planet): void {
    this.db
      .prepare(
        `INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, sq_t,
           bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c, bq_cost_d)
         VALUES (@id, @owner, @name, @g, @s, @p, @temp, @res_m, @res_c, @res_d, @t, @created, @sq_t,
           @bq_key, @bq_lvl, @bq_start, @bq_end, @bq_cost_m, @bq_cost_c, @bq_cost_d)
         ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, name = excluded.name,
           temp = excluded.temp, res_m = excluded.res_m, res_c = excluded.res_c, res_d = excluded.res_d,
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

  deleteAllPlanets(): void {
    this.db.prepare('DELETE FROM planets').run();
  }

  // ----- fleets -----

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
    };
  }

  fleet(id: string): Fleet | null {
    return this.fleetOf(
      this.db.prepare('SELECT * FROM fleets WHERE id = ?').get(id) as Row,
    );
  }

  fleets(): Fleet[] {
    const rows = this.db
      .prepare('SELECT * FROM fleets ORDER BY dep, id')
      .all() as Row[];
    return rows.map((r) => this.fleetOf(r)!);
  }

  fleetCount(owner: string): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM fleets WHERE owner = ?')
      .get(owner) as Row;
    return r.n as number;
  }

  /** Fleets whose next event (arrival or return) is due, the earliest first. */
  dueFleets(now: number): Fleet[] {
    const rows = this.db
      .prepare(
        `SELECT *, CASE state WHEN 'out' THEN arr ELSE ret END AS at FROM fleets
         WHERE (state = 'out' AND arr <= ?) OR (state = 'back' AND ret <= ?) ORDER BY at, id`,
      )
      .all(now, now) as Row[];
    return rows.map((r) => this.fleetOf(r)!);
  }

  saveFleet(f: Fleet): void {
    this.db
      .prepare(
        `INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
           mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel)
         VALUES (@id, @owner, @from, @from_g, @from_s, @from_p, @to, @to_g, @to_s, @to_p,
           @mission, @cargo_m, @cargo_c, @cargo_d, @dep, @arr, @ret, @state, @recalled, @fuel)
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
      });
    this.db.prepare('DELETE FROM fleet_ships WHERE fleet_id = ?').run(f.id);
    const put = this.db.prepare('INSERT INTO fleet_ships VALUES (?, ?, ?)');
    for (const [k, n] of Object.entries(f.ships))
      if (n > 0) put.run(f.id, k, n);
  }

  deleteFleet(id: string): void {
    this.db.prepare('DELETE FROM fleets WHERE id = ?').run(id);
  }

  deleteAllFleets(): void {
    this.db.prepare('DELETE FROM fleets').run();
  }

  // ----- reports -----

  addReport(uid: string, report: Report, keep: number): void {
    const { id, time, type, title, ...body } = report;
    const seq = this.db
      .prepare(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM reports WHERE user_id = ?',
      )
      .get(uid) as Row;
    this.db
      .prepare(
        'INSERT INTO reports (id, user_id, time, seq, type, title, body) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, uid, time, seq.n, type, title, JSON.stringify(body));
    this.db
      .prepare(
        `DELETE FROM reports WHERE user_id = ? AND id NOT IN
         (SELECT id FROM reports WHERE user_id = ? ORDER BY seq DESC LIMIT ?)`,
      )
      .run(uid, uid, keep);
  }

  /** The newest report first (the order in which they were written). */
  reports(uid: string): Report[] {
    const rows = this.db
      .prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY seq DESC')
      .all(uid) as Row[];
    return rows.map((r) => ({
      ...(JSON.parse(r.body as string) as Record<string, unknown>),
      id: r.id as string,
      time: r.time as number,
      type: r.type as Report['type'],
      title: r.title as string,
    }));
  }

  deleteReport(uid: string, id: string): void {
    this.db
      .prepare('DELETE FROM reports WHERE user_id = ? AND id = ?')
      .run(uid, id);
  }

  deleteReports(uid: string): void {
    this.db.prepare('DELETE FROM reports WHERE user_id = ?').run(uid);
  }

  // ----- sessions -----

  addSession(tokenHash: string, uid: string, expires: number): void {
    this.db
      .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
      .run(tokenHash, uid, expires);
  }

  sessionUser(tokenHash: string, now: number): string | null {
    const r = this.db
      .prepare(
        'SELECT user_id FROM sessions WHERE token_hash = ? AND expires > ?',
      )
      .get(tokenHash, now) as Row | undefined;
    return (r?.user_id as string | undefined) ?? null;
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  purgeSessions(now: number): number {
    return this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now)
      .changes;
  }

  // ----- invitations -----

  private invitationOf(r: Row | undefined): Invitation | null {
    if (!r) return null;
    return {
      id: r.id as string,
      email: r.email as string,
      tokenHash: r.token_hash as string,
      createdBy: (r.created_by as string | null) ?? null,
      created: r.created as number,
      expires: r.expires as number,
      usedAt: (r.used_at as number | null) ?? null,
      revokedAt: (r.revoked_at as number | null) ?? null,
    };
  }

  addInvitation(i: Invitation): void {
    this.db
      .prepare(
        `INSERT INTO invitations (id, email, token_hash, created_by, created, expires, used_at, revoked_at)
         VALUES (@id, @email, @tokenHash, @createdBy, @created, @expires, @usedAt, @revokedAt)`,
      )
      .run(i);
  }

  invitationByToken(tokenHash: string): Invitation | null {
    return this.invitationOf(
      this.db
        .prepare('SELECT * FROM invitations WHERE token_hash = ?')
        .get(tokenHash) as Row,
    );
  }

  /** Invitations that can still be used, the newest first. */
  openInvitations(now: number): Invitation[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires > ?
         ORDER BY created DESC, id`,
      )
      .all(now) as Row[];
    return rows.map((r) => this.invitationOf(r)!);
  }

  /** Revokes the open invitations of an address (or one by id). */
  revokeInvitations(
    where: { email?: string; id?: string },
    now: number,
  ): number {
    const sql = `UPDATE invitations SET revoked_at = ? WHERE used_at IS NULL AND revoked_at IS NULL AND ${
      where.id ? 'id = ?' : 'email = ?'
    }`;
    return this.db.prepare(sql).run(now, where.id ?? where.email ?? '').changes;
  }

  useInvitation(id: string, now: number): void {
    this.db
      .prepare('UPDATE invitations SET used_at = ? WHERE id = ?')
      .run(now, id);
  }
}
