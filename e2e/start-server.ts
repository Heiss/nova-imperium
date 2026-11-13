// Starts a server for the E2E suite on an empty data folder; with
// E2E_MAILBOX (e2e/env.ts) also the mail sink its SMTP settings point to.
import { rmSync } from 'node:fs';
import { E2E_DATA } from './env.ts';
import { startMailSink } from './mail.ts';

rmSync(process.env.NOVA_DATA_DIR ?? E2E_DATA, { recursive: true, force: true });
const mailbox = process.env.E2E_MAILBOX;
if (mailbox) {
  rmSync(mailbox, { force: true });
  await startMailSink(Number(process.env.SMTP_PORT), mailbox);
}
await import('../src/server/main.ts');
