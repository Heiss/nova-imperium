// Static files of the client from the built folder (dist/public).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

/** The file below `root` for a URL path, or null if it would leave `root`. */
export function resolveStatic(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = path.join(
    root,
    path.normalize(decoded).replace(/^([/\\])+/, ''),
  );
  return file.startsWith(root + path.sep) ? file : null;
}

export interface StaticFile {
  status: number;
  type: string;
  body: Buffer | string;
}

export async function loadStatic(
  root: string,
  urlPath: string,
): Promise<StaticFile> {
  const file = resolveStatic(root, urlPath);
  if (!file)
    return { status: 403, type: 'text/plain; charset=utf-8', body: 'Verboten' };
  try {
    const body = await readFile(file);
    return {
      status: 200,
      type: MIME[path.extname(file)] ?? 'application/octet-stream',
      body,
    };
  } catch {
    return {
      status: 404,
      type: 'text/plain; charset=utf-8',
      body: 'Nicht gefunden',
    };
  }
}
