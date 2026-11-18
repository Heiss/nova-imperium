// The migrations of #227. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261118T2230-friendships: the buddy list (#227). One row per pair of
// players, an open request of `requester` to `addressee` or, once accepted,
// a friendship. Never a player with themselves, and at most one row per
// pair in either direction, so a crossed request cannot be stored. Deleting
// an account deletes its rows; a new round keeps them (owner, 2026-11-16,
// D2).
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261118T2230-friendships',
    sql: `
    CREATE TABLE friendships (
      requester TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'friend')),
      PRIMARY KEY (requester, addressee),
      CHECK (requester != addressee)
    ) STRICT;
    CREATE UNIQUE INDEX friendships_pair
      ON friendships (min(requester, addressee), max(requester, addressee));
    CREATE INDEX friendships_addressee ON friendships (addressee);
  `,
  },
];

export default migrations;
