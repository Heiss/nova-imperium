import { describe, expect, it } from 'vitest';
import {
  gameIsBack,
  MAINTENANCE_FALLBACK,
  maintenanceNotice,
} from './maintenance.ts';

describe('maintenance answers', () => {
  it('take the text of a 503 with the maintenance header', () => {
    const body = { error: 'Nova Imperium wird aktualisiert.' };
    expect(maintenanceNotice(503, 'update', body)).toBe(body.error);
    expect(maintenanceNotice(503, 'unreachable', {})).toBe(
      MAINTENANCE_FALLBACK,
    );
    expect(maintenanceNotice(503, 'planned', { error: '' })).toBe(
      MAINTENANCE_FALLBACK,
    );
    expect(maintenanceNotice(503, 'planned', { error: 7 })).toBe(
      MAINTENANCE_FALLBACK,
    );
  });

  it('leave other answers alone', () => {
    expect(maintenanceNotice(503, null, { error: 'busy' })).toBeNull();
    expect(maintenanceNotice(503, '', { error: 'busy' })).toBeNull();
    expect(maintenanceNotice(502, 'update', {})).toBeNull();
    expect(maintenanceNotice(200, 'update', {})).toBeNull();
  });

  it('see the game back only on a healthy check without maintenance', () => {
    expect(gameIsBack(200, { ok: true })).toBe(true);
    expect(gameIsBack(200, { ok: true, maintenance: 'planned' })).toBe(false);
    expect(gameIsBack(503, { ok: true })).toBe(false);
    expect(gameIsBack(200, {})).toBe(false);
  });
});
