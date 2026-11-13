// Settings of the servers under test. The data folders are new for every run.
import { tmpdir } from 'node:os';
import path from 'node:path';

export const E2E_PORT = 8099;
export const E2E_DATA = path.join(
  tmpdir(),
  `nova-e2e-${process.env.E2E_RUN ?? 'run'}`,
);

export const E2E_ENV: Record<string, string> = {
  NOVA_PUBLIC_URL: `http://localhost:${E2E_PORT}`,
  NOVA_PORT: String(E2E_PORT),
  NOVA_HOST: '127.0.0.1',
  NOVA_DATA_DIR: E2E_DATA,
  // All tests come from one address; the limit itself is tested in
  // src/server/http/app.test.ts.
  NOVA_RATE_LIMIT_ATTEMPTS: '1000',
};

// The second server, for the mails (#68): its normal SMTP settings send to
// the mail sink of e2e/mail.ts, which its start runs on 127.0.0.1, and a
// login needs the code from the mail. It has its own universe, so a new
// round started there resets no planet of the other tests.
const E2E_MAIL_PORT = 8098;
const E2E_SMTP_PORT = 8025;
export const E2E_MAIL_URL = `http://localhost:${E2E_MAIL_PORT}`;
export const E2E_MAILBOX = `${E2E_DATA}-mailbox.jsonl`;

export const E2E_MAIL_ENV: Record<string, string> = {
  ...E2E_ENV,
  NOVA_PUBLIC_URL: E2E_MAIL_URL,
  NOVA_PORT: String(E2E_MAIL_PORT),
  NOVA_DATA_DIR: `${E2E_DATA}-mail`,
  NOVA_EMAIL_LOGIN_CODES: '1',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(E2E_SMTP_PORT),
  SMTP_TLS: 'false',
  MAIL_FROM: 'nova@example.org',
  E2E_MAILBOX,
};
