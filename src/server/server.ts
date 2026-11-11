// Starts the game: database, HTTP server and the background clock that lands
// fleets and removes old sessions while nobody is online.
import { createServer, type Server } from 'node:http';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { purgeAudit } from './audit.ts';
import type { Config } from './config.ts';
import { openDatabase } from './db/database.ts';
import { Store } from './db/store.ts';
import { tick } from './game/arrival.ts';
import { type Ctx, createCtx } from './game/context.ts';
import { createApp } from './http/app.ts';
import { createMailer, type Mailer } from './mail.ts';
import { startPushDelivery } from './web-push.ts';

export const DB_FILE = 'nova.sqlite';
const TICK_MS = 1000;
const SWEEP_MS = 3600000;

export interface Running {
  server: Server;
  ctx: Ctx;
  port: number;
  stop: () => Promise<void>;
}

export interface StartOptions {
  cfg: Config;
  publicDir: string;
  dbFile?: string;
  mailer?: Mailer | null;
  log?: (msg: string, e?: unknown) => void;
}

export function databaseFile(cfg: Config): string {
  mkdirSync(cfg.dataDir, { recursive: true });
  return path.join(cfg.dataDir, DB_FILE);
}

function startGameClock(
  ctx: Ctx,
  sweepApp: () => void,
  log: NonNullable<StartOptions['log']>,
): () => void {
  const clock = setInterval(() => {
    try {
      tick(ctx, log);
    } catch (e) {
      log('Tick failed', e);
    }
  }, TICK_MS);
  const sweep = setInterval(() => {
    ctx.store.purgeSessions(ctx.now());
    purgeAudit(ctx);
    sweepApp();
  }, SWEEP_MS);
  return () => {
    clearInterval(clock);
    clearInterval(sweep);
  };
}

export async function startServer(o: StartOptions): Promise<Running> {
  const log =
    o.log ?? ((msg: string, e?: unknown) => console.error(msg, e ?? ''));
  const db = openDatabase(o.dbFile ?? databaseFile(o.cfg));
  const ctx = createCtx(new Store(db));
  const mailer =
    o.mailer !== undefined
      ? o.mailer
      : o.cfg.smtp
        ? createMailer(o.cfg.smtp)
        : null;
  const app = createApp({
    ctx,
    cfg: o.cfg,
    mailer,
    publicDir: o.publicDir,
    log,
  });
  const server = createServer(
    { requestTimeout: 30000, headersTimeout: 20000 },
    (req, res) => void app.handle(req, res),
  );
  const stopPush = o.cfg.webPush
    ? startPushDelivery(ctx, o.cfg.publicUrl, () =>
        log('Web Push delivery failed'),
      )
    : null;
  const stopClock = startGameClock(ctx, app.sweep, log);
  await new Promise<void>((resolve) =>
    server.listen(o.cfg.port, o.cfg.host, resolve),
  );
  const address = server.address();
  const port =
    typeof address === 'object' && address ? address.port : o.cfg.port;
  const stop = async (): Promise<void> => {
    stopClock();
    await stopPush?.();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  };
  return { server, ctx, port, stop };
}
