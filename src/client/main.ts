// The entry point of the browser client: it starts the parts and mounts the
// page. The state lives in logic/state.svelte.ts (#118); transport, session,
// maintenance, toasts and the error log have modules of their own (api.ts,
// session.ts, maintenance.ts, toast.ts, error-log.ts); the views are Svelte
// components (views/); the handlers of the buttons and forms are the
// features' (features/). This file is run by the E2E suite.
import {
  boot,
  inviteToken,
  resumeAfterMaintenance,
  watchLinks,
} from './boot.ts';
import { startClock } from './clock.ts';
import { startDispatch } from './dispatch.ts';
import { watchErrors } from './error-log.ts';
import { whenBack } from './maintenance.ts';
import { render } from './render.ts';
import { routeHistory } from './routing.ts';
import { whenSignedOut } from './session.ts';
import { initUi } from './ui-init.ts';

initUi();
watchErrors();
whenSignedOut(() => render(true));
whenBack(resumeAfterMaintenance);
startDispatch();
routeHistory(() => !!inviteToken());
watchLinks();
startClock();
void boot();
