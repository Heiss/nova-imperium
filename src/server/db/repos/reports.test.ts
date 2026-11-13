import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

const report = (i: number) => ({
  id: `r${i}`,
  time: 100 - i,
  type: 'spy' as const,
  title: `T${i}`,
  text: `x${i}`,
  loot: { m: i },
});

describe('reports repository', () => {
  it('keeps the newest reports of a player up to the limit', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    ctx.reports.add('u_Bert', report(9), 1);
    for (let i = 1; i <= 5; i++) ctx.reports.add('u_Anna', report(i), 3);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([
      report(5),
      report(4),
      report(3),
    ]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([report(9)]);
    expect(ctx.reports.ofPlayer('nobody')).toEqual([]);
  });

  it('numbers the reports per player in the order they were written', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    ctx.reports.add('u_Bert', report(1), 10);
    ctx.reports.add('u_Anna', report(2), 10);
    ctx.reports.add('u_Anna', { ...report(3), time: 500 }, 10);
    expect(
      ctx.db.prepare('SELECT id, seq FROM reports ORDER BY id').all(),
    ).toEqual([
      { id: 'r1', seq: 1 },
      { id: 'r2', seq: 1 },
      { id: 'r3', seq: 2 },
    ]);
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.id)).toEqual([
      'r3',
      'r2',
    ]);
  });

  it('deletes one report or all of a player', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    for (let i = 1; i <= 3; i++) ctx.reports.add('u_Anna', report(i), 10);
    ctx.reports.add('u_Bert', report(4), 10);
    ctx.reports.delete('u_Bert', 'r2');
    ctx.reports.delete('u_Anna', 'r2');
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.id)).toEqual([
      'r3',
      'r1',
    ]);
    ctx.reports.deleteAll('u_Anna');
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([report(4)]);
  });
});
