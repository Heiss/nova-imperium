// The page „Marktplatz“ (#171) of the view state: the notices, the form with
// the draft, and the HTML of the options and the preview that the form is
// painted with.
import { afterEach, describe, expect, it } from 'vitest';
import { CLOSED } from '../../core/market-text.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet, roundDefaults } from '../../test/fixtures.ts';
import type { V } from '../views/common.ts';
import { draft, newDraft } from './market.ts';
import { marketPage, previewHTML, targetOptions } from './market-page.ts';
import type { GameState } from './types.ts';

const BASE = 1_000_000;
const PRICES = { mc: BASE, md: BASE, cm: BASE, cd: BASE, dm: BASE, dc: BASE };

function view(
  round: Record<string, unknown> = {},
  p = planet({ b: { market: 1 }, res: { m: 5000, c: 100, d: 0 } }),
  prices = true,
): V {
  return {
    s: {
      round: { ...roundDefaults(), number: 1, ...round },
      cfg: { ...DEFAULT_UNIVERSE },
      market: prices ? { prices: PRICES, used: 0 } : undefined,
    } as unknown as GameState,
    P: p,
  } as unknown as V;
}

afterEach(() => Object.assign(draft, newDraft()));

describe('the page of the marketplace', () => {
  it('is the closed notice in a round with the market off, and while no prices came', () => {
    expect(marketPage(view({ marketOn: 0 }))).toEqual({
      kind: 'notice',
      text: CLOSED,
    });
    expect(marketPage(view({}, undefined, false))).toEqual({
      kind: 'notice',
      text: CLOSED,
    });
  });

  it('says where a missing Handelsposten is built', () => {
    expect(marketPage(view({}, planet({ b: { robot: 4 } })))).toEqual({
      kind: 'notice',
      text: 'Auf diesem Planeten fehlt ein Handelsposten. Baue ihn unter „Gebäude“.',
    });
  });

  it('is the form with the draft: both lists, the amount as typed, the preview, and whether „Tauschen“ is offered', () => {
    const empty = marketPage(view());
    expect(empty).toMatchObject({
      kind: 'form',
      amount: '',
      ok: false,
      giveOptions:
        '<option value="m" selected>Adamant</option><option value="c">Psikristall</option><option value="d">Promethium</option>',
      getOptions:
        '<option value="c" selected>Psikristall</option><option value="d">Promethium</option>',
    });
    Object.assign(draft, { give: 'm', get: 'd', amount: '1000' });
    const page = marketPage(view());
    expect(page).toMatchObject({ kind: 'form', amount: '1000', ok: true });
    expect(page.kind === 'form' && page.preview).toContain(
      '<td>Du erhältst</td><td>225 Promethium</td>',
    );
  });

  it('never gets what it gives', () => {
    Object.assign(draft, { give: 'c', get: 'c' });
    const page = marketPage(view());
    expect(page.kind === 'form' && page.getOptions).toBe(
      '<option value="m" selected>Adamant</option><option value="d">Promethium</option>',
    );
  });

  it('writes the options and the preview that the form is painted with', () => {
    expect(targetOptions({ give: 'd', get: 'm', amount: '' })).toBe(
      '<option value="m" selected>Adamant</option><option value="c">Psikristall</option>',
    );
    expect(
      previewHTML({
        lines: [{ label: '<Kurs>', value: 'a & b' }],
        note: 'Note "x"',
        ok: false,
      }),
    ).toBe(
      '<table class="kv"><tr><td>&lt;Kurs&gt;</td><td>a &amp; b</td></tr></table><p class="bad">Note &quot;x&quot;</p>',
    );
  });
});
