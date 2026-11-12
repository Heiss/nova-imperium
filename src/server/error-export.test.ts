import { describe, expect, it } from 'vitest';
import { DAY, record } from './audit.ts';
import { errorExport, exportRange } from './error-export.ts';
import {
  readReport,
  recordClientError,
  recordReport,
  recordServerError,
} from './error-log.ts';
import { unzipLines } from '../test/zip.ts';
import { addUser, testCtx } from './test-helpers.ts';

describe('export range', () => {
  it('defaults to the last 7 days and stays inside 0 and now', () => {
    const now = 100 * DAY;
    expect(exportRange({}, now)).toEqual({ since: 93 * DAY, until: now });
    expect(exportRange({ until: 50 * DAY }, now)).toEqual({
      since: 43 * DAY,
      until: 50 * DAY,
    });
    // An explicit 0 is a value, not a missing one (CodeRabbit on #128).
    expect(exportRange({ since: 0 }, now)).toEqual({ since: 0, until: now });
    expect(exportRange({ since: 0, until: 0 }, now)).toEqual({
      since: 0,
      until: 0,
    });
    expect(exportRange({ until: 0 }, now)).toEqual({ since: 0, until: 0 });
    expect(exportRange({ since: null, until: null }, now)).toEqual({
      since: 93 * DAY,
      until: now,
    });
    expect(exportRange({ since: 10, until: 20 }, now)).toEqual({
      since: 10,
      until: 20,
    });
    expect(exportRange({ since: 30, until: 20 }, now)).toEqual({
      since: 20,
      until: 20,
    });
    expect(exportRange({ until: 200 * DAY }, now).until).toBe(now);
    expect(exportRange({}, DAY)).toEqual({ since: 0, until: DAY });
    expect(exportRange({ since: -5 }, now).since).toBe(0);
  });
});

describe('error export', () => {
  it('writes one JSON Lines file per kind with player names', () => {
    const ctx = testCtx(20 * DAY);
    const anna = addUser(ctx, 'Anna');
    const boss = addUser(ctx, 'Boss', { admin: true });
    recordServerError(ctx, { action: 'too old', error: 'x' });
    record(ctx, { category: 'game', action: 'too old', actor: anna.id });
    ctx.clock.t += 1;
    const since = ctx.now();
    recordServerError(ctx, {
      action: 'GET /api/state',
      error: new Error('boom'),
      player: anna.id,
      requestId: '0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
    });
    recordClientError(ctx, anna, { kind: 'error', message: 'm' }, '1.0');
    recordClientError(ctx, anna, { kind: 'error', message: 'm' }, '1.0');
    recordReport(ctx, anna, readReport({ text: 'Hilfe', page: 'fleet' }, ''));
    record(ctx, {
      category: 'admin.read',
      action: 'player',
      actor: boss.id,
      target: anna.id,
      detail: { page: 1 },
    });
    record(ctx, { category: 'system', action: 'x' });
    const until = ctx.now();
    ctx.clock.t += 1;
    recordServerError(ctx, { action: 'too new', error: 'x' });

    const { name, zip, counts } = errorExport(ctx, { since, until });
    expect(name).toBe('nova-imperium-fehler-1970-01-21-1970-01-21.zip');
    expect(counts).toEqual({ errors: 2, reports: 1, audit: 2 });
    const files = unzipLines(zip);
    expect(Object.keys(files).sort()).toEqual([
      'audit.jsonl',
      'errors.jsonl',
      'reports.jsonl',
    ]);
    const time = new Date(since).toISOString();
    expect(files['errors.jsonl']).toEqual([
      {
        id: 2,
        kind: 'server',
        time,
        first: time,
        player: 'Anna',
        playerId: anna.id,
        requestId: '0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
        action: 'GET /api/state',
        page: '',
        version: '',
        browser: '',
        message: 'Error: boom',
        detail: expect.stringMatching(/^Error: boom\n/),
        count: 1,
      },
      expect.objectContaining({
        kind: 'client',
        action: 'error',
        message: 'm',
        version: '1.0',
        count: 2,
        player: 'Anna',
      }),
    ]);
    expect(files['reports.jsonl']).toEqual([
      {
        id: 4,
        kind: 'report',
        time,
        player: 'Anna',
        playerId: anna.id,
        requestId: null,
        action: 'form',
        page: 'fleet',
        version: '',
        browser: '',
        message: '',
        text: 'Hilfe',
      },
    ]);
    expect(files['audit.jsonl']).toEqual([
      {
        id: 2,
        time,
        actor: 'Boss',
        actorId: boss.id,
        category: 'admin.read',
        action: 'player',
        outcome: 'ok',
        target: 'Anna',
        targetId: anna.id,
        requestId: null,
        detail: { page: 1 },
      },
      expect.objectContaining({ actor: null, target: null, detail: {} }),
    ]);
    const all = JSON.stringify(files);
    expect(all).not.toContain('@example.org');
    expect(all).not.toContain('secret1');
  });

  it('writes empty files for an empty range', () => {
    const ctx = testCtx(20 * DAY);
    const { zip, counts } = errorExport(ctx, { since: 0, until: 5 });
    expect(counts).toEqual({ errors: 0, reports: 0, audit: 0 });
    expect(unzipLines(zip)).toEqual({
      'errors.jsonl': [],
      'reports.jsonl': [],
      'audit.jsonl': [],
    });
  });
});
