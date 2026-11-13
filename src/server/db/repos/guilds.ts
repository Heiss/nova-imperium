// Guilds (#117): a guild with its members and open applications.
import type { Db } from '../database.ts';

export interface Guild {
  id: string;
  tag: string;
  name: string;
  description: string;
  founder: string;
}

export interface Membership {
  user_id: string;
  guild_id: string;
  status: 'pending' | 'member';
}

/** A player with their guild, for the directory. */
export interface GuildPlayer {
  id: string;
  name: string;
  guild_id: string;
  status: 'member' | 'pending';
}

export interface Guilds {
  get(id: string): Guild | undefined;
  all(): Guild[];
  /** Every member and applicant with their name. */
  players(): GuildPlayer[];
  membership(uid: string): Membership | undefined;
  /** Whether another guild than `except` has the tag or the name. */
  taken(except: string, tag: string, name: string): boolean;
  /** Founds a guild with its founder as its first member. */
  create(
    id: string,
    tag: string,
    name: string,
    description: string,
    founder: string,
  ): void;
  update(id: string, tag: string, name: string, description: string): void;
  delete(id: string): void;
  transfer(id: string, founder: string): void;
  apply(uid: string, id: string): void;
  accept(uid: string): void;
  removeMember(uid: string): void;
  /** Whether the guild has a member other than `uid`. */
  hasOtherMembers(id: string, uid: string): boolean;
}

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
        'SELECT u.id, u.name, m.guild_id, m.status FROM guild_members m JOIN users u ON u.id = m.user_id',
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
    this.db
      .prepare('INSERT INTO guilds VALUES (?, ?, ?, ?, ?)')
      .run(id, tag, name, description, founder);
    this.db
      .prepare("INSERT INTO guild_members VALUES (?, ?, 'member')")
      .run(founder, id);
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
      .prepare('UPDATE guilds SET founder = ? WHERE id = ?')
      .run(founder, id);
  }

  apply(uid: string, id: string): void {
    this.db
      .prepare("INSERT INTO guild_members VALUES (?, ?, 'pending')")
      .run(uid, id);
  }

  accept(uid: string): void {
    this.db
      .prepare("UPDATE guild_members SET status = 'member' WHERE user_id = ?")
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
}
