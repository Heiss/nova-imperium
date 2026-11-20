// The call to the server of the whole client: the transport rules
// (logic/transport.ts) wired to the page, the banner, the error log and the
// session.
import { reportError } from './error-log.ts';
import { createApi } from './logic/transport.ts';
import { client } from './logic/state.svelte.ts';
import { showMaintenance } from './maintenance.ts';
import { signedOut } from './session.ts';

export const api = createApi({
  fetch: (...args) => fetch(...args),
  report: reportError,
  maintenance: showMaintenance,
  signedOut,
  requestId: (id) => void (client.ui.lastRequestId = id),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});
