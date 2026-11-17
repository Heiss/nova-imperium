// The buddy list (#227): the table `friendships` of migration
// 20261117T0710-friendships, one row per pair, an open request or a
// friendship. The rules are those of src/core/friends.ts; the table refuses
// a second row for a pair in either direction.
import type { FriendLink } from '../../../core/friends.ts';
import type { Db } from '../database.ts';
import type { Row } from './rows.ts';

export interface Friends {
  /** Every request and friendship of `uid`, in either direction. */
  links(uid: string): FriendLink[];
  /** Stores the open request of `from` to `to`. */
  request(from: string, to: string): void;
  /** Turns the open request of `from` to `to` into a friendship. */
  accept(from: string, to: string): void;
  /** Deletes the row of the pair, whoever asked. */
  remove(a: string, b: string): void;
}

const linkOf = (r: Row): FriendLink => ({
  from: r.requester as string,
  to: r.addressee as string,
  status: r.status as FriendLink['status'],
});

export class SqliteFriends implements Friends {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  links(uid: string): FriendLink[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM friendships WHERE requester = ? OR addressee = ?
         ORDER BY requester, addressee`,
      )
      .all(uid, uid) as Row[];
    return rows.map(linkOf);
  }

  request(from: string, to: string): void {
    this.db
      .prepare(
        "INSERT INTO friendships (requester, addressee, status) VALUES (?, ?, 'pending')",
      )
      .run(from, to);
  }

  accept(from: string, to: string): void {
    this.db
      .prepare(
        "UPDATE friendships SET status = 'friend' WHERE requester = ? AND addressee = ?",
      )
      .run(from, to);
  }

  remove(a: string, b: string): void {
    this.db
      .prepare(
        `DELETE FROM friendships
         WHERE (requester = ? AND addressee = ?) OR (requester = ? AND addressee = ?)`,
      )
      .run(a, b, b, a);
  }
}
