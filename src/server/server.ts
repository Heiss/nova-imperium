// Starts the game: database, HTTP server and the background clock that lands
// fleets and removes old sessions while nobody is online.
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { purgeAudit } from './audit.ts';
import type { Config } from './config.ts';
import { openDatabase } from './db/database.ts';
import { Store } from './db/store.ts';
import { tick } from './game/arrival.ts';
import { type Ctx, createCtx } from './game/context.ts';
import { createApp } from './http/app.ts';
import { createMailer, type Mailer } from './mail.ts';
import {
  maintenanceReply,
  plannedMaintenance,
  type Phase,
} from './maintenance.ts';
import { announceUpdate, type News } from './news.ts';
import { startPushDelivery } from './web-push.ts';

export const DB_FILE = 'nova.sqlite';
const TICK_MS = 1000;
const SWEEP_MS = 3600000;

export interface Running {
  server: Server;
  /** Null while the server is stopped after a refused migration. */
  ctx: Ctx | null;
  port: number;
  stop: () => Promise<void>;
}

export interface StartOptions {
  cfg: Config;
  publicDir: string;
  dbFile?: string;
  mailer?: Mailer | null;
  log?: (msg: string, e?: unknown) => void;
  /** Backs up and migrates the database; by default in a worker thread. */
  migrate?: (file: string) => Promise<void>;
  /** CHANGELOG.md and VERSION of the image (news.ts); none in tests. */
  news?: News;
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

/**
 * Backs up and migrates in a worker thread, so the main thread keeps
 * answering "Wartung" meanwhile. Rejects with the reason when it refuses.
 */
export function migrateInWorker(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./db/migrate-worker.ts', import.meta.url),
      { workerData: { file } },
    );
    worker.once('message', (m: { ok: boolean; message?: string }) => {
      if (m.ok) resolve();
      else reject(new Error(m.message));
    });
    worker.once('error', reject);
    worker.once('exit', (code) =>
      reject(new Error(`The migration stopped with code ${code}.`)),
    );
  });
}

const noMigration = (): Promise<void> => Promise.resolve();

function listen(server: Server, cfg: Config): Promise<number> {
  return new Promise((resolve) =>
    server.listen(cfg.port, cfg.host, () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : cfg.port);
    }),
  );
}

function closer(server: Server): () => Promise<void> {
  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}

/**
 * Listens at once and answers "Wartung" until the database is backed up and
 * migrated. A refused migration leaves the server in the "stopped" state: it
 * keeps answering, never opens the database and stays unhealthy, so there is
 * no restart loop and the database stays as it was.
 */
export async function startServer(o: StartOptions): Promise<Running> {
  const log =
    o.log ?? ((msg: string, e?: unknown) => console.error(msg, e ?? ''));
  const file = o.dbFile ?? databaseFile(o.cfg);
  const migrate =
    o.migrate ?? (file === ':memory:' ? noMigration : migrateInWorker);
  let phase: Phase | null = 'update';
  let game: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
  const server = createServer(
    { requestTimeout: 30000, headersTimeout: 20000 },
    (req, res) => {
      const current =
        phase ?? (plannedMaintenance(o.cfg.dataDir) ? 'planned' : null);
      if (current || !game)
        maintenanceReply(res, current ?? 'update', req.url ?? '/');
      else game(req, res);
    },
  );
  const port = await listen(server, o.cfg);
  try {
    await migrate(file);
  } catch (e) {
    phase = 'stopped';
    log(`Nova Imperium stays in maintenance: ${(e as Error).message}`);
    return { server, ctx: null, port, stop: closer(server) };
  }
  const opened = openGame(o, file, log);
  game = opened.handle;
  phase = null;
  const close = closer(server);
  // Background work first, then the connections, the database last.
  const stop = async (): Promise<void> => {
    await opened.stopBackground();
    await close();
    opened.closeDatabase();
  };
  return { server, ctx: opened.ctx, port, stop };
}

/** Opens the migrated database and starts the game, its clock and push. */
function openGame(
  o: StartOptions,
  file: string,
  log: NonNullable<StartOptions['log']>,
) {
  const db = openDatabase(file);
  const ctx = createCtx(new Store(db));
  const news = o.news ?? { version: null, versions: [] };
  const told = announceUpdate(ctx, news);
  if (told) log(`Told ${told} players about version ${news.version}.`);
  const app = createApp({
    ctx,
    cfg: o.cfg,
    mailer: mailerOf(o),
    publicDir: o.publicDir,
    log,
    news,
  });
  const stopPush = o.cfg.webPush
    ? startPushDelivery(ctx, o.cfg.publicUrl, () =>
        log('Web Push delivery failed'),
      )
    : null;
  const stopClock = startGameClock(ctx, app.sweep, log);
  return {
    ctx,
    handle: (req: IncomingMessage, res: ServerResponse): void =>
      void app.handle(req, res),
    stopBackground: async (): Promise<void> => {
      stopClock();
      await stopPush?.();
    },
    closeDatabase: (): void => {
      db.close();
    },
  };
}

function mailerOf(o: StartOptions): Mailer | null {
  if (o.mailer !== undefined) return o.mailer;
  return o.cfg.smtp ? createMailer(o.cfg.smtp) : null;
}
