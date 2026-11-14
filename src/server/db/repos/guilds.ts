// Guilds (#117): a guild with its members, open applications and ranks
// (#163). The rules of the ranks are in src/server/game/guild-ranks.ts.
import { GUILD_RIGHTS, type GuildRight } from '../../../core/guild-ranks.ts';
import type { Db } from '../database.ts';

export interface Guild {
  id: string;
  tag: string;
  name: string;
  description: string;
  founder: string;
  /** The rank new members get; never the Leitung. */
  default_rank: string | null;
}

export interface Membership {
  user_id: string;
  guild_id: string;
  status: 'pending' | 'member';
  /** The rank of a member; an applicant has none. */
  rank_id: string | null;
}

/** A player with their guild, for the directory. */
export interface GuildPlayer {
  id: string;
  name: string;
  guild_id: string;
  status: 'member' | 'pending';
  rank_id: string | null;
}

/** A rank: position 0 is the Leitung, a larger position a lower rank. */
export interface Rank {
  id: string;
  guild_id: string;
  name: string;
  position: number;
  /** The rights stored for the rank, in the order of GUILD_RIGHTS. */
  rights: GuildRight[];
}

export interface Guilds {
  get(id: string): Guild | undefined;
  all(): Guild[];
  /** Every member and applicant with their name. */
  players(): GuildPlayer[];
  membership(uid: string): Membership | undefined;
  /** Whether another guild than `except` has the tag or the name. */
  taken(except: string, tag: string, name: string): boolean;
  /**
   * Founds a guild with the ranks Leitung (`r0_<id>`, held by the founder)
   * and Mitglied (`r1_<id>`, the default rank).
   */
  create(
    id: string,
    tag: string,
    name: string,
    description: string,
    founder: string,
  ): void;
  update(id: string, tag: string, name: string, description: string): void;
  delete(id: string): void;
  /** Hands over the Leitung: its rank to `founder`, the default rank to the old one. */
  transfer(id: string, founder: string): void;
  apply(uid: string, id: string): void;
  /** Makes the applicant a member with the default rank of the guild. */
  accept(uid: string): void;
  removeMember(uid: string): void;
  /** Whether the guild has a member other than `uid`. */
  hasOtherMembers(id: string, uid: string): boolean;
  /** The ranks of a guild, highest first. */
  ranks(id: string): Rank[];
  rank(id: string): Rank | undefined;
  /** Adds a rank without rights below all others. */
  addRank(id: string, guild: string, name: string): void;
  renameRank(id: string, name: string): void;
  setRights(id: string, rights: readonly GuildRight[]): void;
  /** Swaps the places of two ranks of one guild. */
  swapRanks(a: Rank, b: Rank): void;
  /** Deletes a rank; its members get the rank `fallback`. */
  deleteRank(id: string, fallback: string): void;
  setDefaultRank(id: string, rank: string): void;
  setRank(uid: string, rank: string): void;
}

interface RankRow {
  id: string;
  guild_id: string;
  name: string;
  position: number;
}

const order = (a: GuildRight, b: GuildRight): number =>
  GUILD_RIGHTS.indexOf(a) - GUILD_RIGHTS.indexOf(b);

export class SqliteGuilds implements Guilds {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(id: string): Guild | undefined {
    return this.db.prepare('SELECT * FROM guilds WHERE id = ?').get(id) as
      Guild | undefined;
  }

  all(): Guild[] {
    return this.db.prepare('SELECT * FROM guilds').all() as Guild[];
  }

  players(): GuildPlayer[] {
    return this.db
      .prepare(
        'SELECT u.id, u.name, m.guild_id, m.status, m.rank_id FROM guild_members m JOIN users u ON u.id = m.user_id',
      )
      .all() as GuildPlayer[];
  }

  membership(uid: string): Membership | undefined {
    return this.db
      .prepare('SELECT * FROM guild_members WHERE user_id = ?')
      .get(uid) as Membership | undefined;
  }

  taken(except: string, tag: string, name: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM guilds WHERE id != ? AND (tag = ? OR name = ?)')
        .get(except, tag, name) !== undefined
    );
  }

  create(
    id: string,
    tag: string,
    name: string,
    description: string,
    founder: string,
  ): void {
    const lead = `r0_${id}`;
    const member = `r1_${id}`;
    this.db
      .prepare(
        'INSERT INTO guilds (id, tag, name, description, founder) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, tag, name, description, founder);
    const rank = this.db.prepare(
      'INSERT INTO guild_ranks (id, guild_id, name, position) VALUES (?, ?, ?, ?)',
    );
    rank.run(lead, id, 'Leitung', 0);
    rank.run(member, id, 'Mitglied', 1);
    this.setDefaultRank(id, member);
    this.db
      .prepare(
        "INSERT INTO guild_members (user_id, guild_id, status, rank_id) VALUES (?, ?, 'member', ?)",
      )
      .run(founder, id, lead);
  }

  update(id: string, tag: string, name: string, description: string): void {
    this.db
      .prepare(
        'UPDATE guilds SET tag = ?, name = ?, description = ? WHERE id = ?',
      )
      .run(tag, name, description, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM guilds WHERE id = ?').run(id);
  }

  transfer(id: string, founder: string): void {
    this.db
      .prepare(
        `UPDATE guild_members SET rank_id = (SELECT default_rank FROM guilds WHERE id = ?)
         WHERE user_id = (SELECT founder FROM guilds WHERE id = ?)`,
      )
      .run(id, id);
    this.db
      .prepare(
        `UPDATE guild_members SET rank_id =
           (SELECT id FROM guild_ranks WHERE guild_id = ? AND position = 0)
         WHERE user_id = ?`,
      )
      .run(id, founder);
    this.db
      .prepare('UPDATE guilds SET founder = ? WHERE id = ?')
      .run(founder, id);
  }

  apply(uid: string, id: string): void {
    this.db
      .prepare(
        "INSERT INTO guild_members (user_id, guild_id, status) VALUES (?, ?, 'pending')",
      )
      .run(uid, id);
  }

  accept(uid: string): void {
    this.db
      .prepare(
        `UPDATE guild_members SET status = 'member',
           rank_id = (SELECT default_rank FROM guilds WHERE id = guild_members.guild_id)
         WHERE user_id = ?`,
      )
      .run(uid);
  }

  removeMember(uid: string): void {
    this.db.prepare('DELETE FROM guild_members WHERE user_id = ?').run(uid);
  }

  hasOtherMembers(id: string, uid: string): boolean {
    return (
      this.db
        .prepare(
          "SELECT 1 FROM guild_members WHERE guild_id = ? AND user_id != ? AND status = 'member'",
        )
        .get(id, uid) !== undefined
    );
  }

  private rights(id: string): GuildRight[] {
    return (
      this.db
        .prepare('SELECT right_key FROM guild_rank_rights WHERE rank_id = ?')
        .pluck()
        .all(id) as GuildRight[]
    ).sort(order);
  }

  ranks(id: string): Rank[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY position',
        )
        .all(id) as RankRow[]
    ).map((r) => ({ ...r, rights: this.rights(r.id) }));
  }

  rank(id: string): Rank | undefined {
    const row = this.db
      .prepare('SELECT * FROM guild_ranks WHERE id = ?')
      .get(id) as RankRow | undefined;
    return row && { ...row, rights: this.rights(id) };
  }

  addRank(id: string, guild: string, name: string): void {
    this.db
      .prepare(
        `INSERT INTO guild_ranks (id, guild_id, name, position)
         SELECT ?, ?, ?, MAX(position) + 1 FROM guild_ranks WHERE guild_id = ?`,
      )
      .run(id, guild, name, guild);
  }

  renameRank(id: string, name: string): void {
    this.db
      .prepare('UPDATE guild_ranks SET name = ? WHERE id = ?')
      .run(name, id);
  }

  setRights(id: string, rights: readonly GuildRight[]): void {
    this.db.prepare('DELETE FROM guild_rank_rights WHERE rank_id = ?').run(id);
    const add = this.db.prepare(
      'INSERT OR IGNORE INTO guild_rank_rights (rank_id, right_key) VALUES (?, ?)',
    );
    for (const right of rights) add.run(id, right);
  }

  swapRanks(a: Rank, b: Rank): void {
    // UNIQUE (guild_id, position): a waits on -1 while b takes its place.
    const move = this.db.prepare(
      'UPDATE guild_ranks SET position = ? WHERE id = ?',
    );
    move.run(-1, a.id);
    move.run(a.position, b.id);
    move.run(b.position, a.id);
  }

  deleteRank(id: string, fallback: string): void {
    this.db
      .prepare('UPDATE guild_members SET rank_id = ? WHERE rank_id = ?')
      .run(fallback, id);
    this.db.prepare('DELETE FROM guild_ranks WHERE id = ?').run(id);
  }

  setDefaultRank(id: string, rank: string): void {
    this.db
      .prepare('UPDATE guilds SET default_rank = ? WHERE id = ?')
      .run(rank, id);
  }

  setRank(uid: string, rank: string): void {
    this.db
      .prepare('UPDATE guild_members SET rank_id = ? WHERE user_id = ?')
      .run(rank, uid);
  }
}
