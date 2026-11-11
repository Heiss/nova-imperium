// Maintenance answers (issue #80): the server and Caddy answer 503 with the
// header Nova-Maintenance; the client then shows a banner and waits.

export const MAINTENANCE_FALLBACK =
  'Nova Imperium wird gerade gewartet. Bitte in ein paar Minuten neu laden.';

/** The text to show, or null when the answer is not a maintenance answer. */
export function maintenanceNotice(
  status: number,
  header: string | null,
  body: Record<string, unknown>,
): string | null {
  if (status !== 503 || !header) return null;
  return typeof body.error === 'string' && body.error
    ? body.error
    : MAINTENANCE_FALLBACK;
}

/** The health check says the game is back: 200 and no maintenance in it. */
export const gameIsBack = (
  status: number,
  body: Record<string, unknown>,
): boolean => status === 200 && body.ok === true && !('maintenance' in body);
