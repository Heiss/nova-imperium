// The banner over the game while the server is in maintenance (issue #80;
// formerly in main.ts): shown by the transport on a maintenance answer, it
// asks the health check every 15 seconds and goes when the game is back.
import { $ } from './dom.ts';
import { gameIsBack } from './logic/maintenance.ts';

const POLL_MS = 15000;
let text: string | null = null;
let back: () => void = () => undefined;

/** What to do when the game is back: load the state again. */
export function whenBack(action: () => void): void {
  back = action;
}

/** The text of the banner, or null when none is shown. */
export const maintenanceText = (): string | null => text;

/** A banner over the game while the server is in maintenance; checks back. */
export function showMaintenance(notice: string): void {
  let banner = $('#maintenance');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'maintenance';
    banner.className = 'maintenance';
    banner.setAttribute('role', 'status');
    document.body.prepend(banner);
  }
  banner.textContent = `Wartung – ${notice}`;
  if (text === null) setTimeout(checkBack, POLL_MS);
  text = notice;
}

async function checkBack(): Promise<void> {
  try {
    const r = await fetch('/healthz', { cache: 'no-store' });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (gameIsBack(r.status, body)) {
      text = null;
      $('#maintenance')?.remove();
      back();
      return;
    }
  } catch {
    // still down
  }
  setTimeout(checkBack, POLL_MS);
}
