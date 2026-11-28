// The migrations of #466. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261128T0300-attack-union-rows: an attack union („Verbandsangriff“) gets
// a row of its own (#466, owner, 2026-11-28, [V] of the issue): its leader,
// its target and its fixed arrival X, and the leader's fleet that leads the
// battle (`lead`, empty while he has sent none). Until now a union had no
// row: its ID was the ID of the leader's Sturmangriff (#225). The unions in
// flight move into rows with that ID, `lead` that fleet and X their present
// arrival, so `fleets.union_id` and `attack_union_invites` stay as they are.
// A fleet whose union_id names no row (its leader's fleet was gone) arrives
// alone, as before. The table references `users` only, so a later rebuild
// of `fleets` needs no change of it; deleting an account deletes its unions.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261128T0300-attack-union-rows',
    sql: `
    CREATE TABLE attack_unions (
      id TEXT PRIMARY KEY,
      leader TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lead TEXT,
      target TEXT NOT NULL,
      to_g INTEGER NOT NULL,
      to_s INTEGER NOT NULL,
      to_p INTEGER NOT NULL,
      arr INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX attack_unions_leader ON attack_unions(leader);

    INSERT INTO attack_unions (id, leader, lead, target, to_g, to_s, to_p, arr)
      SELECT id, owner, id, to_planet, to_g, to_s, to_p, arr
      FROM fleets WHERE union_id = id AND state = 'out';
  `,
  },
];

export default migrations;
