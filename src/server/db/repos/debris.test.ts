import { describe, expect, it } from 'vitest';
import { testCtx } from '../../test-helpers.ts';

// Trümmerfelder (#45): one field per position, a place of its own (#119).
describe('debris repository', () => {
  it('adds a field at a position with the id of its place', () => {
    const ctx = testCtx();
    expect(ctx.debris.get('d1_2_3')).toBeNull();
    ctx.debris.add({ g: 1, s: 2, p: 3 }, { m: 1800.3, c: 600 });
    expect(ctx.debris.get('d1_2_3')).toEqual({
      id: 'd1_2_3',
      g: 1,
      s: 2,
      p: 3,
      m: 1800.3,
      c: 600,
    });
    ctx.db.close();
  });

  it('adds up the debris of several battles at one position', () => {
    const ctx = testCtx();
    ctx.debris.add({ g: 1, s: 2, p: 3 }, { m: 100, c: 0.5 });
    ctx.debris.add({ g: 1, s: 2, p: 3 }, { m: 1800, c: 1800 });
    ctx.debris.add({ g: 1, s: 2, p: 4 }, { m: 1, c: 2 });
    expect(ctx.debris.get('d1_2_3')).toMatchObject({ m: 1900, c: 1800.5 });
    expect(ctx.debris.get('d1_2_4')).toMatchObject({ m: 1, c: 2 });
    ctx.db.close();
  });

  it('lists every field by position', () => {
    const ctx = testCtx();
    ctx.debris.add({ g: 2, s: 1, p: 1 }, { m: 1, c: 1 });
    ctx.debris.add({ g: 1, s: 9, p: 1 }, { m: 2, c: 2 });
    ctx.debris.add({ g: 1, s: 2, p: 15 }, { m: 3, c: 3 });
    ctx.debris.add({ g: 1, s: 2, p: 4 }, { m: 4, c: 4 });
    expect(ctx.debris.all().map((f) => f.id)).toEqual([
      'd1_2_4',
      'd1_2_15',
      'd1_9_1',
      'd2_1_1',
    ]);
    ctx.db.close();
  });

  it('stores what is left, and deletes one field or all', () => {
    const ctx = testCtx();
    ctx.debris.add({ g: 1, s: 2, p: 3 }, { m: 100, c: 50 });
    ctx.debris.add({ g: 1, s: 2, p: 4 }, { m: 1, c: 2 });
    ctx.debris.save({ ...ctx.debris.get('d1_2_3')!, m: 60, c: 0 });
    expect(ctx.debris.get('d1_2_3')).toMatchObject({ m: 60, c: 0 });
    expect(ctx.debris.get('d1_2_4')).toMatchObject({ m: 1, c: 2 });
    ctx.debris.delete('d1_2_3');
    expect(ctx.debris.all().map((f) => f.id)).toEqual(['d1_2_4']);
    ctx.debris.deleteAll();
    expect(ctx.debris.all()).toEqual([]);
    ctx.db.close();
  });
});
