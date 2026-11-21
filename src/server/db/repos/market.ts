// The state of the marketplace (#171, okf/features/marketplace.md): the
// price of each pair after its last exchange and the amount each player gave
// on each UTC day, in the tables of migration 20261118T2324-marketplace.
import type { Pair, PriceState } from '../../../core/market.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

export interface MarketStore {
  /** The stored price of every pair that had an exchange this round. */
  prices(): Partial<Record<Pair, PriceState>>;
  /** Stores the price of a pair and the time it was set. */
  savePrice(pair: Pair, state: PriceState): void;
  /** What the player gave on the UTC day `day`. */
  used(uid: string, day: number): number;
  /** Adds to what the player gave on `day` and forgets every earlier day. */
  addUsed(uid: string, day: number, amount: number): void;
  /** Forgets every price and every amount, for a new round. */
  clear(): void;
}

class SqliteMarket implements MarketStore {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  prices(): Partial<Record<Pair, PriceState>> {
    const rows = this.db
      .prepare('SELECT pair, price, changed FROM market_prices')
      .all() as Row[];
    const out: Partial<Record<Pair, PriceState>> = {};
    // The column holds one of the six pairs only (a CHECK of the table).
    for (const r of rows)
      out[r.pair as Pair] = {
        price: r.price as number,
        at: r.changed as number,
      };
    return out;
  }

  savePrice(pair: Pair, state: PriceState): void {
    this.db
      .prepare(
        `INSERT INTO market_prices (pair, price, changed) VALUES (?, ?, ?)
         ON CONFLICT(pair) DO UPDATE SET price = excluded.price,
           changed = excluded.changed`,
      )
      .run(pair, state.price, state.at);
  }

  used(uid: string, day: number): number {
    const row = this.db
      .prepare('SELECT amount FROM market_usage WHERE user_id = ? AND day = ?')
      .get(uid, day) as Row | undefined;
    return (row?.amount as number | undefined) ?? 0;
  }

  addUsed(uid: string, day: number, amount: number): void {
    this.db.prepare('DELETE FROM market_usage WHERE day < ?').run(day);
    this.db
      .prepare(
        `INSERT INTO market_usage (user_id, day, amount) VALUES (?, ?, ?)
         ON CONFLICT(user_id, day) DO UPDATE SET amount = amount + excluded.amount`,
      )
      .run(uid, day, amount);
  }

  clear(): void {
    this.db.exec('DELETE FROM market_prices; DELETE FROM market_usage;');
  }
}

/** The prices and the daily amounts of the marketplace (#171). */
export const repository = {
  key: 'market',
  make: (db: Db): MarketStore => new SqliteMarket(db),
} as const satisfies RepositoryModule;

/** The prices and the amounts of the day start over (#171). */
export const roundReset = [
  { order: 80, clears: ['market_prices', 'market_usage'] },
] satisfies readonly RoundReset[];
