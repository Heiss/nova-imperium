// The shipyard: ordering ships, the max button and the queue.
import { expect, test } from '@playwright/test';
import {
  lastToast,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('playing', () => {
  test('ships are ordered, a fleet flies, spies and comes home', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Flotte');
    const b = uniqueName('Ziel');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({
      name: a,
      b: { yard: 3, robot: 2, metal: 10 },
      research: { comb: 3, spy: 2 },
      ships: { probe: 2, sc: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    seed({ name: b, b: { metal: 12 } });
    await page.reload();
    await nav(page, 'shipyard');
    await page.fill('#q_lf', '2');
    await page.click('[data-act=order][data-k=lf]');
    await expect(page.locator('.toast').last()).toContainText(
      '2× Abfangjäger in Auftrag gegeben.',
    );
    await nav(page, 'fleet');
    await page.fill('#f_sc', '1');
    await expect(page.locator('#i_cap')).toContainText('5.000');
    await page.click('[data-act=send]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'dein eigener Planet',
    );
    await nav(page, 'highscore');
    const target = page.locator('tr', { hasText: b }).locator('[data-act=gto]');
    await target.click();
    await expect(page.locator('h2')).toHaveText('Sternenkarte');
    await page.locator('tr', { hasText: b }).locator('[data-act=gspy]').click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await nav(page, 'overview');
    await expect(page.locator('.fl-spy')).toContainText('Auspex-Erkundung');
    await expect(page.locator('#menu [data-v=messages] .badge')).toBeVisible({
      timeout: 30000,
    });
    await nav(page, 'messages');
    await page
      .locator('.rep .t', { hasText: 'Auspex-Bericht' })
      .first()
      .click();
    await expect(page.locator('.rep.open')).toContainText('Rohstoffe auf');
    // The target registered just now: its activity, by the rule of #229 (#175 D5).
    await expect(
      page.locator('.rep.open .mt', { hasText: 'Aktivität' }),
    ).toHaveText(/^Aktivität\s*Aktiv$/);
    expect(w.problems).toEqual([]);
  });
});

test.describe('galaxy, shipyard and options (#68)', () => {
  test('the shipyard max button fills the order; the queue finishes unit by unit', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Werft');
    await register(page, name);
    // Abfangjäger cost 3,000 Adamant and 1,000 Psikristall: two can be paid.
    seed({
      name,
      b: { robot: 2, yard: 2 },
      research: { comb: 1 },
      res: { m: 7000, c: 2500, d: 0 },
    });
    await page.goto('/?view=shipyard');
    const fighter = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Abfangjäger/ }),
    });
    const max = fighter.locator('[data-act=maxq]');
    await expect(max).toHaveText('(max 2)');
    await max.click();
    await expect(page.locator('#q_lf')).toHaveValue('2');
    await fighter.getByRole('button', { name: 'Bauen' }).click();
    await expect(lastToast(page)).toContainText(
      '2× Abfangjäger in Auftrag gegeben.',
    );
    const queue = page.locator('.box', {
      hasText: 'Bauauftrag der Schiffsschmiede',
    });
    await expect(queue).toContainText('2× Abfangjäger');
    await expect(queue).toContainText('nächste fertig in');
    await expect(max).toHaveText('(max 0)');
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 0)');

    seed({ name, finishUnits: 1 });
    await page.reload();
    await expect(queue).toContainText('1× Abfangjäger');
    await expect(queue).toContainText('nächste fertig in');
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 1)');
    seed({ name, finishUnits: 2 });
    await page.reload();
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 2)');
    await expect(queue).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });
});
