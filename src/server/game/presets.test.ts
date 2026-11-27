// A save after „Umstellen“ of a preset (#441, [V]): it is the save of the
// universe settings as before, audited with the values before and after;
// the preset itself sends nothing.
import { describe, expect, it } from 'vitest';
import { presetValues } from '../../core/round.ts';
import { addPlanet, addUser } from '../test-helpers.ts';
import { asAdmin } from '../../test/http.ts';

describe('the save of the universe settings after a preset (#441)', () => {
  it('takes the „Standard“ values of the live settings and audits before and after', async () => {
    const s = await asAdmin();
    addUser(s.ctx, 'Pilot');
    addPlanet(s.ctx, 'u_Pilot', { g: 1, s: 4, p: 4 });
    // A changed live setting, then the preset's values as the fields hold them.
    s.ctx.admin.saveUniverse({ ...s.ctx.admin.universe(), roundMarketOn: 0 });
    const settings = {
      ...s.ctx.admin.universe(),
      ...presetValues('standard', true),
    };
    const saved = await s.call('POST', '/api/action', {
      type: 'settings',
      settings,
    });
    expect(saved.status).toBe(200);
    expect(s.ctx.admin.universe().roundMarketOn).toBe(1);
    const row = s.ctx.db
      .prepare(
        "SELECT detail FROM audit_events WHERE action = 'settings' ORDER BY id DESC",
      )
      .get() as { detail: string };
    const detail = JSON.parse(row.detail) as {
      before: Record<string, number>;
      after: Record<string, number>;
    };
    expect(detail.before.roundMarketOn).toBe(0);
    expect(detail.after.roundMarketOn).toBe(1);
  });
});
