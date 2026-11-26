// A context for the tests of the client features (#322): every member is a
// mock that does nothing and says it went through; a test replaces what it
// looks at.
import { vi } from 'vitest';
import type { ClientCtx } from './contract.ts';

export const fakeCtx = (over: Partial<ClientCtx> = {}): ClientCtx => ({
  act: vi.fn(async () => true),
  actHere: vi.fn(async () => true),
  quiet: vi.fn(async () => true),
  actOwn: vi.fn(async () => true),
  modal: vi.fn(),
  go: vi.fn(),
  render: vi.fn(),
  api: vi.fn(async () => ({})),
  toast: vi.fn(),
  setInput: vi.fn(),
  apply: vi.fn(),
  refresh: vi.fn(async () => undefined),
  signedOut: vi.fn((error: unknown): never => {
    throw new Error(String(error));
  }),
  ...over,
});
