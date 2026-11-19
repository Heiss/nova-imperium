// The migrations of #225. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261120T0900-attack-unions: the attack union („Verbandsangriff“). A fleet
// of a union carries the ID of the union in `fleets.union_id`; the ID of a
// union is the ID of the fleet that opened it (its leader's Sturmangriff),
// and a fleet of no union has NULL. The column is added with ALTER TABLE, so
// no fleet changes; a later rebuild of `fleets` must list it with the other
// columns (`hold`, `aim`, `union_id`). The invitations of a union are rows of
// `attack_union_invites` (the union, the invited player); the table does not
// reference `fleets`, so a later rebuild of `fleets` needs no change of it.
// Rows of a union that is over are deleted by the server (the arrival, a
// recall of the leader, a fleet that is deleted), and deleting an account
// deletes its invitations.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261120T0900-attack-unions',
    sql: `
    ALTER TABLE fleets ADD COLUMN union_id TEXT;

    CREATE TABLE attack_union_invites (
      union_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (union_id, user_id)
    ) STRICT;
    CREATE INDEX attack_union_invites_user ON attack_union_invites(user_id);
  `,
  },
];

export default migrations;
