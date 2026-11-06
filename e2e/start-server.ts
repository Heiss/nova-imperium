// Starts the server for the E2E suite on an empty data folder.
import { rmSync } from 'node:fs';
import { E2E_DATA } from './env.ts';

rmSync(E2E_DATA, { recursive: true, force: true });
await import('../src/server/main.ts');
