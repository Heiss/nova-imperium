// Guilds (#117): a guild with its members, open applications, ranks (#163)
// and chat (#169). The rules of the ranks are in
// src/server/game/guild-ranks.ts, those of the chat in
// src/server/game/guild-chat.ts.
import { CHAT_HISTORY, type ChatEventKind } from '../../../core/guild-chat.ts';
import {
  GUILD_RIGHTS,
  MEMBER_RIGHTS,
  type GuildRight,
} from '../../../core/guild-ranks.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { RoundRules } from '../../../core/round.ts';
import type { RoundReset } from '../round-reset.ts';

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
  /** The newest chat message of the last visit to the page of the guild (#169). */
  chat_seen: number;
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

/** A message or an event of the guild chat (#169). */
export interface ChatMessage {
  id: number;
  guild_id: string;
  /** The writer of a message; null once its account is deleted (anonymous, owner D7), and for an event. */
  author: string | null;
  time: number;
  /** A message, or the kind of an event (D3, D4). */
  kind: 'message' | ChatEventKind;
  /** The text of a message; the new rank of „rank“, the target of „attack“; empty otherwise. */
  text: string;
  /** The member an event is about; null once its account is deleted. */
  member: string | null;
  /** The attacker of „attack“; null once its account is deleted. */
  attacker: string | null;
  /** The arrival of „attack“. */
  arrival: number | null;
  /** The current names of `member` and `attacker`, null without an account. */
  member_name: string | null;
  attacker_name: string | null;
}

/** An event to write into the chat of a guild (#169 D3, D4). */
export interface ChatEventRow {
  kind: ChatEventKind;
  member: string;
  text: string;
  attacker?: string;
  arrival?: number;
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
   * and Mitglied (`r1_<id>`, the default rank, with the rights of
   * MEMBER_RIGHTS).
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
  /** Deletes every guild with its members, applications, ranks and rights (#191). */
  deleteAll(): void;
  /** Hands over the Leitung: its rank to `founder`, the rank `rank` to the old one. */
  transfer(id: string, founder: string, rank: string): void;
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
  /** Whether a member holds the rank. */
  rankHasMembers(rank: string): boolean;
  /** The kept messages of a guild's chat, oldest first (#169). */
  chat(id: string): ChatMessage[];
  chatMessage(id: number): ChatMessage | undefined;
  /** Adds a message and keeps only the newest CHAT_HISTORY of the guild. */
  addChat(id: string, author: string, time: number, text: string): number;
  /** Adds an event, kept and counted like a message. */
  addChatEvent(id: string, time: number, event: ChatEventRow): number;
  /** Notes a visit of the member to the page of its guild: never back (#169). */
  seeChat(uid: string, id: number): void;
  deleteChat(id: number): void;
  /** The time of the newest kept message of `uid`, in any guild. */
  lastChat(uid: string): number | undefined;
  /** Deletes the chats of every guild: each new round (owner, D6). */
  clearChats(): void;
}

/** The entries of the chat with the current names of the accounts they name. */
const CHAT = `SELECT c.*, m.name AS member_name, a.name AS attacker_name
  FROM guild_chat c LEFT JOIN users m ON m.id = c.member
  LEFT JOIN users a ON a.id = c.attacker`;

interface RankRow {
  id: string;
  guild_id: string;
  name: string;
  position: number;
}

const order = (a: GuildRight, b: GuildRight): number =>
  GUILD_RIGHTS.indexOf(a) - GUILD_RIGHTS.indexOf(b);

class SqliteGuilds implements Guilds {
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
    this.setRights(member, MEMBER_RIGHTS);
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

  deleteAll(): void {
    this.db.prepare('DELETE FROM guilds').run();
  }

  transfer(id: string, founder: string, rank: string): void {
    this.db
      .prepare(
        `UPDATE guild_members SET rank_id = ?
         WHERE user_id = (SELECT founder FROM guilds WHERE id = ?)`,
      )
      .run(rank, id);
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

  rankHasMembers(rank: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM guild_members WHERE rank_id = ?')
        .get(rank) !== undefined
    );
  }

  chat(id: string): ChatMessage[] {
    return this.db
      .prepare(`${CHAT} WHERE c.guild_id = ? ORDER BY c.id`)
      .all(id) as ChatMessage[];
  }

  chatMessage(id: number): ChatMessage | undefined {
    return this.db.prepare(`${CHAT} WHERE c.id = ?`).get(id) as
      ChatMessage | undefined;
  }

  addChat(id: string, author: string, time: number, text: string): number {
    const added = this.db
      .prepare(
        'INSERT INTO guild_chat (guild_id, author, time, text) VALUES (?, ?, ?, ?)',
      )
      .run(id, author, time, text);
    return this.keep(id, Number(added.lastInsertRowid));
  }

  addChatEvent(id: string, time: number, e: ChatEventRow): number {
    const added = this.db
      .prepare(
        `INSERT INTO guild_chat (guild_id, time, kind, text, member, attacker, arrival)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        time,
        e.kind,
        e.text,
        e.member,
        e.attacker ?? null,
        e.arrival ?? null,
      );
    return this.keep(id, Number(added.lastInsertRowid));
  }

  /** Keeps the newest CHAT_HISTORY entries of the guild; returns `added`. */
  private keep(id: string, added: number): number {
    this.db
      .prepare(
        `DELETE FROM guild_chat WHERE guild_id = ? AND id NOT IN (
           SELECT id FROM guild_chat WHERE guild_id = ? ORDER BY id DESC LIMIT ?)`,
      )
      .run(id, id, CHAT_HISTORY);
    return added;
  }

  seeChat(uid: string, id: number): void {
    this.db
      .prepare(
        'UPDATE guild_members SET chat_seen = max(chat_seen, ?) WHERE user_id = ?',
      )
      .run(id, uid);
  }

  deleteChat(id: number): void {
    this.db.prepare('DELETE FROM guild_chat WHERE id = ?').run(id);
  }

  lastChat(uid: string): number | undefined {
    const time = this.db
      .prepare('SELECT MAX(time) FROM guild_chat WHERE author = ?')
      .pluck()
      .get(uid) as number | null;
    return time ?? undefined;
  }

  clearChats(): void {
    this.db.prepare('DELETE FROM guild_chat').run();
  }
}

/** The `guilds` repository on `Ctx`. */
export const repository = {
  key: 'guilds',
  make: (db: Db): Guilds => new SqliteGuilds(db),
} as const satisfies RepositoryModule;

/**
 * A round with guilds off starts without any guild (#191); with guilds on they
 * stay, with their members, ranks and rights. Every new round deletes all guild
 * chats, guilds on or off (#169, D6).
 */
export const roundReset = [
  { order: 20, clears: ['guilds'], when: (rules: RoundRules) => !rules.guilds },
  { order: 30, clears: ['guild_chat'] },
  {
    keeps: ['guilds', 'guild_members', 'guild_ranks', 'guild_rank_rights'],
    when: (rules: RoundRules) => rules.guilds,
  },
] satisfies readonly RoundReset[];
