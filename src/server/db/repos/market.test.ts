import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

// The state of the marketplace (#171): the price of each pair and what each
// player gave on each UTC day.
describe('market repository', () => {
  it('knows no price before an exchange', () => {
    const ctx = testCtx();
    expect(ctx.market.prices()).toEqual({});
    ctx.db.close();
  });

  it('stores the price of a pair with its time and replaces it on the next exchange', () => {
    const ctx = testCtx();
    ctx.market.savePrice('mc', { price: 909090, at: 1000 });
    ctx.market.savePrice('dm', { price: 500000, at: 2000 });
    expect(ctx.market.prices()).toEqual({
      mc: { price: 909090, at: 1000 },
      dm: { price: 500000, at: 2000 },
    });
    ctx.market.savePrice('mc', { price: 826445, at: 3000 });
    expect(ctx.market.prices()).toEqual({
      mc: { price: 826445, at: 3000 },
      dm: { price: 500000, at: 2000 },
    });
    ctx.db.close();
  });

  it('refuses a price for something that is no pair', () => {
    const ctx = testCtx();
    expect(() =>
      ctx.db
        .prepare(
          "INSERT INTO market_prices (pair, price, changed) VALUES ('mm', 1, 1)",
        )
        .run(),
    ).toThrow('CHECK constraint failed');
    ctx.db.close();
  });

  it('adds up what a player gave on a day, apart from other players', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    expect(ctx.market.used(anna.id, 20408)).toBe(0);
    ctx.market.addUsed(anna.id, 20408, 1000);
    ctx.market.addUsed(anna.id, 20408, 250);
    ctx.market.addUsed(bert.id, 20408, 7);
    expect(ctx.market.used(anna.id, 20408)).toBe(1250);
    expect(ctx.market.used(bert.id, 20408)).toBe(7);
    expect(ctx.market.used(anna.id, 20407)).toBe(0);
    expect(ctx.market.used(anna.id, 20409)).toBe(0);
    ctx.db.close();
  });

  it('forgets the days before the day of the last exchange', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    ctx.market.addUsed(anna.id, 20406, 1);
    ctx.market.addUsed(bert.id, 20407, 2);
    ctx.market.addUsed(bert.id, 20408, 3);
    ctx.market.addUsed(anna.id, 20408, 4);
    expect(
      ctx.db
        .prepare(
          'SELECT user_id, day, amount FROM market_usage ORDER BY day, user_id',
        )
        .all(),
    ).toEqual([
      { user_id: anna.id, day: 20408, amount: 4 },
      { user_id: bert.id, day: 20408, amount: 3 },
    ]);
    ctx.db.close();
  });

  it('forgets everything for a new round', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    ctx.market.savePrice('mc', { price: 1, at: 1 });
    ctx.market.addUsed(anna.id, 5, 9);
    ctx.market.clear();
    expect(ctx.market.prices()).toEqual({});
    expect(ctx.market.used(anna.id, 5)).toBe(0);
    ctx.db.close();
  });

  it('forgets the amounts of a deleted player', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    ctx.market.addUsed(anna.id, 5, 9);
    ctx.db.prepare('DELETE FROM users WHERE id = ?').run(anna.id);
    expect(ctx.db.prepare('SELECT * FROM market_usage').all()).toEqual([]);
    ctx.db.close();
  });
});
