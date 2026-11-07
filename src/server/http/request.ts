// Reading requests: JSON body with a size limit, cookies, the client address.
import type { IncomingMessage } from 'node:http';
import { GameError } from '../game/context.ts';

export const MAX_BODY = 65536;

export function readJson(
  req: IncomingMessage,
  limit = MAX_BODY,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      // Over the limit: answer at once and drop the rest of the body.
      if (size > limit) reject(new GameError('Anfrage zu groß.'));
      else chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        const value: unknown = text ? JSON.parse(text) : {};
        if (value === null || typeof value !== 'object' || Array.isArray(value))
          throw new Error('not an object');
        resolve(value as Record<string, unknown>);
      } catch {
        reject(new GameError('Ungültige Anfrage.'));
      }
    });
    req.on('error', reject);
  });
}

export function cookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of (header ?? '').split(';')) {
    const part = raw.trim();
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      out.set(
        part.slice(0, i).trim(),
        decodeURIComponent(part.slice(i + 1).trim()),
      );
    } catch {
      // a broken cookie is ignored
    }
  }
  return out;
}

/**
 * The address of the client. Behind Caddy (NOVA_TRUST_PROXY=1) it is the
 * X-Real-IP that Caddy sets from the trusted proxies; otherwise the socket.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const real = req.headers['x-real-ip'];
  if (trustProxy && typeof real === 'string' && real.trim()) return real.trim();
  return req.socket.remoteAddress ?? 'unknown';
}
