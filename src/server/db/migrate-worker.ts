// Backs up and migrates the database in a worker thread, so the server can
// answer "Wartung" while it runs (better-sqlite3 blocks its thread).
import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from './database.ts';

const { file } = workerData as { file: string };
try {
  openDatabase(file).close();
  parentPort!.postMessage({ ok: true });
} catch (e) {
  const error = e as Error;
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  parentPort!.postMessage({ ok: false, message: error.message + cause });
}
