import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { RateLimiter } from './rate-limit.ts';
import { clientIp, cookies } from './request.ts';
import { loadStatic, resolveStatic } from './static.ts';

describe('rate limiter', () => {
  it('counts per key in a window', () => {
    const clock = { t: 0 };
    const r = new RateLimiter(2, 100, () => clock.t);
    expect([
      r.limited('a'),
      r.limited('a'),
      r.limited('a'),
      r.limited('b'),
    ]).toEqual([false, false, true, false]);
    clock.t = 99;
    expect(r.limited('a')).toBe(true);
    clock.t = 100;
    expect(r.limited('a')).toBe(false);
    expect(r.size).toBe(2);
    r.sweep();
    expect(r.size).toBe(1);
  });
});

describe('request helpers', () => {
  it('parse cookies and skip broken ones', () => {
    expect(cookies('a=1; b = x%20y ;broken; c=%E0%A4%A; =z')).toEqual(
      new Map([
        ['a', '1'],
        ['b', 'x y'],
      ]),
    );
    expect(cookies('a=1=2')).toEqual(new Map([['a', '1=2']]));
    expect(cookies(undefined)).toEqual(new Map());
    expect(cookies('__proto__=value; constructor=another').get('__proto__')).toBe(
      'value',
    );
    expect(cookies('a=first; a=last').get('a')).toBe('last');
  });
  it('choose the client address', () => {
    const req = (ip: string | undefined, real?: string) =>
      ({
        socket: { remoteAddress: ip },
        headers: real ? { 'x-real-ip': real } : {},
      }) as never;
    expect(clientIp(req('1.1.1.1', '2.2.2.2'), false)).toBe('1.1.1.1');
    expect(clientIp(req('1.1.1.1', ' 2.2.2.2 '), true)).toBe('2.2.2.2');
    expect(clientIp(req('1.1.1.1', '  '), true)).toBe('1.1.1.1');
    expect(clientIp(req(undefined), true)).toBe('unknown');
  });
});

describe('static files', () => {
  const root = path.resolve(import.meta.dirname, '../../test/public');
  it('stay inside the folder', () => {
    expect(resolveStatic(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolveStatic(root, '/a/../app.css')).toBe(
      path.join(root, 'app.css'),
    );
    expect(resolveStatic(root, '/..%2f..%2fsecret')).toBe(
      path.join(root, 'secret'),
    );
    expect(resolveStatic(root, '/../../etc/passwd')).toBe(
      path.join(root, 'etc/passwd'),
    );
    expect(resolveStatic(root, '/%E0%A4%A')).toBeNull();
    expect(resolveStatic(root, '/a%00b')).toBeNull();
  });
  it('load with the right type', async () => {
    expect(await loadStatic(root, '/app.css')).toMatchObject({
      status: 200,
      type: 'text/css; charset=utf-8',
    });
    expect(await loadStatic(root, '/%E0%A4%A')).toMatchObject({
      status: 403,
      body: 'Verboten',
    });
    expect(await loadStatic(root, '/nope.html')).toMatchObject({ status: 404 });
  });
});
