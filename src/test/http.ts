// A real HTTP server around createApp for route tests: requests with
// fetch, the session cookie kept between calls, the server closed after
// each test.
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { afterEach, expect } from 'vitest';
import type { Config } from '../server/config.ts';
import { createApp } from '../server/http/app.ts';
import type { Mailer } from '../server/mail.ts';
import {
  addPlanet,
  addUser,
  testConfig,
  testCtx,
  type TestCtx,
} from '../server/test-helpers.ts';

const PUBLIC = path.resolve(import.meta.dirname, 'public');
let server: Server | null = null;

export const close = async (): Promise<void> => {
  server?.closeAllConnections();
  await new Promise((r) => (server ? server.close(r) : r(null)));
};

afterEach(async () => {
  await close();
  server = null;
});

export async function start(
  over: {
    cfg?: Partial<Config>;
    mailer?: Mailer | null;
    logs?: string[];
    ctx?: TestCtx;
  } = {},
) {
  const ctx = over.ctx ?? testCtx();
  const cfg = testConfig(over.cfg);
  const app = createApp({
    ctx,
    cfg,
    mailer: over.mailer ?? null,
    publicDir: PUBLIC,
    log: (m) => over.logs?.push(m),
  });
  server = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const client = fetcher(`http://127.0.0.1:${port}`);
  return { ctx, cfg, app, ...client };
}

export async function asAdmin(over: Parameters<typeof start>[0] = {}) {
  const s = await start(over);
  addUser(s.ctx, 'Boss', { admin: true });
  addPlanet(s.ctx, 'u_Boss');
  expect(
    (await s.call('POST', '/api/login', { name: 'boss', password: 'secret1' }))
      .status,
  ).toBe(200);
  return s;
}

/** Calls with JSON bodies; keeps the session cookie the server sets. */
function fetcher(base: string) {
  let cookie = '';
  const call = async (
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // not JSON
    }
    return { status: res.status, headers: res.headers, json, text, set };
  };
  return { call, setCookie: (c: string) => (cookie = c) };
}
