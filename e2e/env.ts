// Settings of the server under test. The data folder is new for every run.
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
