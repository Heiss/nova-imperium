// The page „Marktplatz“ (#171) of the view state: the notices, the form with
// the market of the shown planet, and the HTML of the preview.
import { describe, expect, it } from 'vitest';
import { CLOSED } from '../../core/market-text.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet, roundDefaults } from '../../test/fixtures.ts';
import type { V } from '../views/common.ts';
import { marketOf } from './market.ts';
import { marketPage, previewHTML } from './market-page.ts';
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

  it('is the form of the market of the shown planet', () => {
    const v = view();
    expect(marketPage(v)).toEqual({
      kind: 'form',
      market: marketOf(v.s, v.P),
    });
    expect(marketOf(v.s, v.P)).not.toBeNull();
  });

  it('writes the preview that the form is painted with', () => {
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
