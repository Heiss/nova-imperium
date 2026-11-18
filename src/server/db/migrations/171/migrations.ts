// The migrations of #171. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261118T2324-marketplace: the state of the marketplace (okf/features/
// marketplace.md). `market_prices` holds the price of a pair after its last
// exchange in millionths of the base and when it was set; a pair without a
// row is at the base. `market_usage` holds the amount a player gave on a UTC
// day, for the limit per day; it goes with the player. Both start empty: a
// running round has made no exchange yet. A new round clears both.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261118T2324-marketplace',
    sql: `
    CREATE TABLE market_prices (
      pair TEXT PRIMARY KEY CHECK (pair IN ('mc', 'md', 'cm', 'cd', 'dm', 'dc')),
      price INTEGER NOT NULL,
      changed INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE market_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      PRIMARY KEY (user_id, day)
    ) STRICT;
  `,
  },
];

export default migrations;
