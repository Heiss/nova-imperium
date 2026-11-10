// Caddy (docker/Caddyfile) and the server send the same security headers.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSP, SECURITY_HEADERS } from './security.ts';
import { MIME } from './static.ts';

const caddyfile = readFileSync(
  path.resolve(import.meta.dirname, '../../../docker/Caddyfile'),
  'utf8',
);

const caddyHeaders = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of caddyfile.matchAll(/^\s*>([\w-]+) (?:"([^"]*)"|(\S+))$/gm))
    out[m[1]!.toLowerCase()] = m[2] ?? m[3]!;
  return out;
};

describe('security headers', () => {
  it('forbid inline scripts and styles and foreign sources', () => {
    expect(CSP).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    expect(SECURITY_HEADERS).toEqual({
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy':
        'camera=(), microphone=(), geolocation=(), payment=()',
    });
  });
  it('are the same in the Caddyfile', () => {
    expect(caddyHeaders()).toEqual(SECURITY_HEADERS);
    expect(caddyfile).toContain('-Server');
    expect(caddyfile).toContain('-Via');
    expect(caddyfile).toContain('header_up X-Real-IP {client_ip}');
  });
  it('serve the files of the client with their types', () => {
    expect(MIME).toEqual({
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json',
      '.woff2': 'font/woff2',
      '.txt': 'text/plain; charset=utf-8',
      '.map': 'application/json; charset=utf-8',
    });
  });
  it('know a type for every kind of file of the client', () => {
    const exts = new Set<string>();
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true }))
        if (e.isDirectory()) walk(path.join(dir, e.name));
        else exts.add(path.extname(e.name));
    };
    walk(path.resolve(import.meta.dirname, '../../client/static'));
    for (const ext of exts) expect(MIME, ext).toHaveProperty([ext]);
  });
});
