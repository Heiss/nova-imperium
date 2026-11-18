import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

// Surveyed free positions (#190): one row per position with its values.
describe('surveys repository', () => {
  const v = {
    id: 'v1',
    g: 1,
    s: 2,
    p: 9,
    temp: 52,
    diameter: 14600,
    created: 10,
  };

  it('stores the values of a position and deletes them', () => {
    const ctx = testCtx();
    expect(ctx.surveys.get(v)).toBeNull();
    ctx.surveys.add(v);
    expect(ctx.surveys.get({ g: 1, s: 2, p: 9 })).toEqual(v);
    expect(ctx.surveys.get({ g: 1, s: 2, p: 8 })).toBeNull();
    expect(ctx.surveys.get({ g: 2, s: 2, p: 9 })).toBeNull();
    expect(ctx.surveys.get({ g: 1, s: 3, p: 9 })).toBeNull();
    ctx.surveys.delete({ g: 1, s: 2, p: 8 });
    expect(ctx.surveys.get(v)).toEqual(v);
    ctx.surveys.delete(v);
    expect(ctx.surveys.get(v)).toBeNull();
    ctx.db.close();
  });

  it('expires the surveys made before a time and names them', () => {
    const ctx = testCtx();
    ctx.surveys.add(v);
    ctx.surveys.add({ ...v, id: 'v0', p: 3, created: 5 });
    ctx.surveys.add({ ...v, id: 'v2', p: 4, created: 11 });
    expect(ctx.surveys.expire(10)).toEqual(['v0']);
    expect(ctx.surveys.expire(11)).toEqual(['v1']);
    expect(ctx.surveys.get({ g: 1, s: 2, p: 4 })).toMatchObject({ id: 'v2' });
    ctx.surveys.deleteAll();
    expect(ctx.surveys.get({ g: 1, s: 2, p: 4 })).toBeNull();
    expect(ctx.surveys.expire(100)).toEqual([]);
    ctx.db.close();
  });

  it('deletes the survey reports of every player that name an expired survey', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    const add = (
      uid: string,
      id: string,
      type: 'survey' | 'info',
      survey: string,
    ) => ctx.reports.add(uid, { id, time: 1, type, title: id, survey }, 50);
    add('u_Anna', 'a1', 'survey', 'v1');
    add('u_Anna', 'a2', 'survey', 'v2');
    add('u_Anna', 'a3', 'info', 'v1');
    add('u_Bert', 'b1', 'survey', 'v1');
    ctx.reports.deleteSurveys(['v1', 'v9']);
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.id)).toEqual([
      'a3',
      'a2',
    ]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
    ctx.reports.deleteSurveys([]);
    expect(ctx.reports.ofPlayer('u_Anna')).toHaveLength(2);
    ctx.db.close();
  });
});
