// A real HTTP server around createApp for route tests: requests with
// fetch, the session cookie kept between calls, the server closed after
// each test.
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { afterEach, expect } from 'vitest';
import type { Config } from '../server/config.ts';
import { createApp } from '../server/http/app.ts';
import type { Mailer } from '../server/mail.ts';
import type { News } from '../server/news.ts';
import {
  addPlanet,
  addUser,
  testConfig,
  testCtx,
  type TestCtx,
} from '../server/test-helpers.ts';

const PUBLIC = path.resolve(import.meta.dirname, 'public');
// Every server a test starts; a test may start several.
const servers: Server[] = [];

export const close = async (): Promise<void> => {
  const open = servers.splice(0);
  for (const s of open) s.closeAllConnections();
  await Promise.all(open.map((s) => new Promise((r) => s.close(r))));
};

afterEach(close);

export async function start(
  over: {
    cfg?: Partial<Config>;
    mailer?: Mailer | null;
    logs?: string[];
    ctx?: TestCtx;
    news?: News;
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
    news: over.news,
  });
  const server = createServer((req, res) => void app.handle(req, res));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const client = fetcher(`http://127.0.0.1:${port}`, cfg.publicUrl);
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

/**
 * The cookies by name, as a browser keeps them; Max-Age=0 removes one. The
 * sign-in by mail code adds `nova_login` next to the session (#401).
 */
function cookieJar() {
  const jar = new Map<string, string>();
  const keep = (line: string): void => {
    const [pair = ''] = line.split(';');
    const at = pair.indexOf('=');
    if (at < 1) return;
    const name = pair.slice(0, at).trim();
    if (/;\s*Max-Age=0\b/i.test(line)) jar.delete(name);
    else jar.set(name, pair.slice(at + 1));
  };
  return { jar, keep };
}

/**
 * Calls with JSON bodies; keeps the session cookie the server sets. A POST
 * carries the `Origin` of the game like a browser does (#328); a header given
 * as `null` is left out, so a test can send a POST without one.
 */
function fetcher(base: string, origin: string) {
  const { jar, keep } = cookieJar();
  const call = async (
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string | null> = {},
  ) => {
    const sent: Record<string, string | null> = {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(method === 'POST' ? { origin } : {}),
      ...(jar.size
        ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }
        : {}),
      ...headers,
    };
    const res = await fetch(base + url, {
      method,
      headers: Object.fromEntries(
        Object.entries(sent).filter(
          (e): e is [string, string] => e[1] !== null,
        ),
      ),
      body:
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    for (const line of res.headers.getSetCookie()) keep(line);
    // The bytes too, for the ZIP of the error log download.
    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // not JSON
    }
    return { status: res.status, headers: res.headers, json, text, bytes, set };
  };
  /** Replaces every cookie by the one given (`''`: none). */
  const setCookie = (c: string): void => {
    jar.clear();
    keep(c);
  };
  return { call, setCookie };
}
