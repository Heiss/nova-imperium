// Maintenance mode (issue #80): while the database is backed up and migrated,
// after a refused migration, and while the operator switched it on with
// `nova maintenance on`, every request gets 503 with a German message and
// the header Nova-Maintenance, which the browser client shows as a banner.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { SECURITY_HEADERS } from './http/security.ts';

/** update: migration running; stopped: migration refused; planned: by the operator. */
export type Phase = 'update' | 'stopped' | 'planned';

export const MESSAGES: Readonly<Record<Phase, string>> = {
  update:
    'Nova Imperium wird aktualisiert. Bitte in ein paar Minuten neu laden.',
  stopped:
    'Nova Imperium ist wegen Wartung nicht erreichbar. Der Betreiber ist informiert.',
  planned: 'Nova Imperium wird gerade gewartet. Bitte später neu laden.',
};

const MAINTENANCE_HEADER = 'nova-maintenance';
const RETRY_SECONDS = '30';
const FLAG = 'maintenance';

const page = (message: string): string =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<title>Wartung – Nova Imperium</title></head>` +
  `<body><main><h1>Wartung</h1><p>${message}</p></main></body></html>`;

/**
 * Answers a request during maintenance. The health check of a planned
 * maintenance stays healthy: the process works, only players are kept out.
 */
export function maintenanceReply(
  res: ServerResponse,
  phase: Phase,
  url: string,
): void {
  const path = url.split('?')[0]!;
  const api = path.startsWith('/api/') || path === '/healthz';
  if (path === '/healthz' && phase === 'planned') {
    send(res, 200, { ok: true, maintenance: phase });
    return;
  }
  const message = MESSAGES[phase];
  res.writeHead(503, {
    ...SECURITY_HEADERS,
    'content-type': api
      ? 'application/json; charset=utf-8'
      : 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'retry-after': RETRY_SECONDS,
    [MAINTENANCE_HEADER]: phase,
  });
  res.end(
    api
      ? JSON.stringify({ error: message, maintenance: phase })
      : page(message),
  );
}

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

const flagFile = (dataDir: string): string => path.join(dataDir, FLAG);

/** True while the operator has switched maintenance on. */
export const plannedMaintenance = (dataDir: string): boolean =>
  existsSync(flagFile(dataDir));

/**
 * `nova maintenance on|off|status`. Works without the database, so it also
 * runs while a migration holds it.
 */
export function maintenanceCommand(
  dataDir: string,
  args: readonly string[],
  out: (line: string) => void,
): number {
  const file = flagFile(dataDir);
  switch (args[0]) {
    case 'on':
      writeFileSync(file, `${new Date().toISOString()}\n`);
      out(
        'Maintenance is on: players get „Wartung“ until `nova maintenance off`.',
      );
      return 0;
    case 'off':
      rmSync(file, { force: true });
      out('Maintenance is off.');
      return 0;
    case 'status':
      out(existsSync(file) ? 'Maintenance is on.' : 'Maintenance is off.');
      return 0;
    default:
      out('Usage: nova maintenance on|off|status');
      return 1;
  }
}
