// The migrations of #478. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261128T1000-union-planned-start: the leader of an attack union may plan a
// later arrival X; his fleet then starts by itself at X minus its flight time
// (owner, 2026-11-28, #478). Until the start the ships stay on the planet, so
// the union row keeps the start: when (`start_at`), from which planet
// (`start_from`), the ships (`start_ships`, JSON of type and count) and the
// speed step (`start_pct`, tenths 1 to 10). All four are empty for a union
// whose leading fleet has started or flies already; every row of a running
// round is such a union, so nothing is filled.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261128T1000-union-planned-start',
    sql: `
    ALTER TABLE attack_unions ADD COLUMN start_at INTEGER;
    ALTER TABLE attack_unions ADD COLUMN start_from TEXT;
    ALTER TABLE attack_unions ADD COLUMN start_ships TEXT;
    ALTER TABLE attack_unions ADD COLUMN start_pct INTEGER;
    CREATE INDEX attack_unions_start ON attack_unions(start_at);
  `,
  },
];

export default migrations;
