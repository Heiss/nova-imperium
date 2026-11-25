// The view „Marktplatz“ (#171), as the component Market renders it (#118,
// bundle 7): hidden in a round with it off (#404), the missing Handelsposten, the form with its
// preview, the menu entry, and the places of the settings in the dialog
// „Neue Runde“ and the admin panel.
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet, roundDefaults } from '../../test/fixtures.ts';
import { marketView } from '../../test/market-view.ts';
import { fieldsetOpen, normalize } from '../../test/markup.ts';
import { newDraft, preview, type Preview } from '../logic/market.ts';
import { draft } from '../logic/market-form.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { menu } from './index.ts';
import { offered } from './offered.ts';
import MarketPreview from './MarketPreview.svelte';
import {
  adminMarkup as admin,
  roundDialogMarkup as roundDialog,
} from '../../test/admin-view.ts';
import { ANEW, FRESH, MOUNTED } from './mount.ts';

const market = (v: V): string => normalize(marketView(v));

/** The preview below the fields (MarketPreview, #337, in place of previewHTML()), as a browser reads it. */
const previewHTML = (p: Preview): string =>
  normalize(render(MarketPreview, { props: { p } }).body);

const BASE = 1_000_000;
const PRICES = { mc: BASE, md: BASE, cm: BASE, cd: BASE, dm: BASE, dc: BASE };

/** The view of a player on a planet with a Handelsposten, 5,000 Adamant and 100 Psikristall. */
function view(
  round: Record<string, unknown> = {},
  p = planet({ b: { market: 1 }, res: { m: 5000, c: 100, d: 0 } }),
): V {
  return {
    s: {
      round: { ...roundDefaults(), number: 1, ...round },
      cfg: { ...DEFAULT_UNIVERSE },
      market: { prices: PRICES, used: 0 },
    },
    P: p,
  } as unknown as V;
}

afterEach(() => Object.assign(draft, newDraft()));

describe('the view „Marktplatz“', () => {
  it('is a mounted view, kept over a render that is not fresh and mounted anew by a fresh one (#361), and in the menu after „Rohstoffe“', () => {
    expect(MOUNTED.has('market')).toBe(true);
    expect(ANEW.has('market')).toBe(false);
    expect(FRESH.has('market')).toBe(true);
    const items = menu(false, view().s.round);
    const labels = items.flatMap((i) => (i === '-' ? [] : [i.label]));
    expect(labels[labels.indexOf('Rohstoffe') + 1]).toBe('Marktplatz');
    expect(items).toContainEqual({ view: 'market', label: 'Marktplatz' });
  });

  it('is hidden in a round with it off, not shown as closed (#404; owner, 2026-11-25, 112a)', () => {
    const off = view({ marketOn: 0 }).s.round;
    for (const admin of [false, true]) {
      expect(menu(admin, off)).not.toContainEqual(
        expect.objectContaining({ view: 'market' }),
      );
      expect(offered('market', off, admin)).toBe(false);
      expect(offered('market', view().s.round, admin)).toBe(true);
    }
  });

  it('says that the planet needs a Handelsposten, and where it is built', () => {
    expect(market(view({}, planet({ b: { robot: 4 } })))).toBe(
      '<h2>Marktplatz</h2><div class="notice">Auf diesem Planeten fehlt ein Handelsposten. Baue ihn unter „Gebäude“.</div>',
    );
  });

  it('is closed while the server sent no prices', () => {
    const v = view();
    (v.s as { market?: unknown }).market = undefined;
    expect(market(v)).toContain('geschlossen');
  });

  it('shows the form: what to give, what to get, the amount with „max“, the preview and „Tauschen“', () => {
    const html = market(view());
    expect(html).toContain(
      '<h2>Marktplatz</h2><div class="box"><div class="hd">Tauschen</div>',
    );
    expect(html).toContain('<form id="marketform">');
    expect(html).toContain(
      '<label for="market-give">Du gibst</label> <select id="market-give"><option selected value="m">Adamant</option><option value="c">Psikristall</option><option value="d">Promethium</option></select>',
    );
    expect(html).toContain(
      '<label for="market-get">Du erhältst</label> <select id="market-get"><option selected value="c">Psikristall</option><option value="d">Promethium</option></select>',
    );
    expect(html).toContain(
      '<label for="market-amount">Menge</label> <input autocomplete="off" id="market-amount" inputmode="numeric" min="1" step="1" type="number" value=""> <button data-act="marketMax" type="button">max</button>',
    );
    expect(html).toContain('<div id="market-preview" role="status">');
    expect(html).toContain(
      '<button disabled id="market-trade" type="submit">Tauschen</button>',
    );
  });

  it('shows the draft: the choice, the amount, the preview of it and an offered „Tauschen“', () => {
    Object.assign(draft, { give: 'm', get: 'd', amount: '1000' });
    const html = market(view());
    expect(html).toContain('<option selected value="d">Promethium</option>');
    expect(html).toContain('value="1000"');
    expect(html).toContain('<td>Du erhältst</td><td>225 Promethium</td>');
    expect(html).toContain(
      '<button id="market-trade" type="submit">Tauschen</button>',
    );
  });

  it('never gets what it gives, and escapes what it shows', () => {
    Object.assign(draft, { give: 'c', get: 'c', amount: '"><b>' });
    const html = market(view());
    expect(html).toContain(
      '<select id="market-get"><option selected value="m">Adamant</option><option value="d">Promethium</option></select>',
    );
    expect(html).toContain('value="&quot;>&lt;b>"');
    expect(html).not.toContain('<b>');
  });

  it('lists every other resource to get, the chosen one selected', () => {
    Object.assign(draft, { give: 'd', get: 'm' });
    expect(market(view())).toContain(
      '<select id="market-get"><option selected value="m">Adamant</option><option value="c">Psikristall</option></select>',
    );
    Object.assign(draft, { give: 'm', get: 'd' });
    expect(market(view())).toContain(
      '<select id="market-get"><option value="c">Psikristall</option><option selected value="d">Promethium</option></select>',
    );
  });
});

describe('the preview of the view', () => {
  const m = view().s;
  const market1 = {
    open: true,
    level: 1,
    stock: { m: 5000, c: 100, d: 0 },
    caps: { m: 100000, c: 100000, d: 100000 },
    ratios: { mc: 500, md: 333, cm: 2000, cd: 666, dm: 3000, dc: 1500 },
    prices: PRICES,
    used: 0,
    limit: 100000,
    feeBase: 10,
    feeStep: 1,
  };

  it('is a table of its lines', () => {
    expect(
      previewHTML(preview(market1, { give: 'm', get: 'c', amount: '' })),
    ).toBe(
      '<table class="kv"><tr><td>Kurs</td><td>450 Psikristall je 1.000 Adamant</td></tr><tr><td>Gebühr</td><td>10 %</td></tr><tr><td>Heute noch</td><td>100.000 von 100.000</td></tr></table>',
    );
    expect(m).toBeDefined();
  });

  it('shows a refusal as a red note, and a cap as a dim one', () => {
    expect(
      previewHTML(preview(market1, { give: 'm', get: 'c', amount: '9999' })),
    ).toContain(
      '</table><p class="bad">So viel hast du auf diesem Planeten nicht.</p>',
    );
    const full = { ...market1, stock: { m: 5000, c: 99_700.5, d: 0 } };
    expect(
      previewHTML(preview(full, { give: 'm', get: 'c', amount: '1000' })),
    ).toContain(
      '</table><p class="dim">Begrenzt durch das freie Lager: Du gibst nur 665 Adamant ab.</p>',
    );
  });

  it('keeps a line and a note as text, as the escaped HTML did (#337)', () => {
    const p = {
      lines: [{ label: 'a<b>', value: '&"x"' }],
      note: '<i>x</i>',
      ok: false,
    } as Preview;
    const html = render(MarketPreview, { props: { p } }).body;
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('<td>a&lt;b></td><td>&amp;"x"</td>');
    expect(previewHTML(p)).toContain('<p class="bad">&lt;i>x&lt;/i></p>');
  });

  it('writes the preview that the form is painted with (ported from logic/market-page.test.ts)', () => {
    expect(
      previewHTML({
        lines: [{ label: '<Kurs>', value: 'a & b' }],
        note: 'Note "x"',
        ok: false,
      }),
    ).toBe(
      '<table class="kv"><tr><td>&lt;Kurs></td><td>a &amp; b</td></tr></table><p class="bad">Note "x"</p>',
    );
  });

  it('shows no note while there is nothing to say', () => {
    expect(
      previewHTML(preview(market1, { give: 'm', get: 'c', amount: '1000' })),
    ).not.toContain('<p');
  });
});

describe('the settings of the marketplace in the dialog and the admin panel', () => {
  it('stand in one fieldset „Marktplatz“ of the dialog „Neue Runde“, preselected with the round', () => {
    const html = roundDialog({
      ...roundDefaults(),
      number: 1,
      marketMc: 700,
      marketOn: 0,
    } as never);
    // Named by the heading of its group since #357 (owner, 2026-11-22).
    const open = fieldsetOpen(html, 'Marktplatz');
    expect(open).toMatch(/aria-labelledby/);
    expect(html).toContain(open);
    expect(html).not.toContain('<legend>Marktplatz</legend>');
    expect(html).toContain(
      normalize(
        '<label for="round-market-on">Marktplatz aktiv</label> <select id="round-market-on"><option value="1">Ja</option><option value="0" selected>Nein</option></select>',
      ),
    );
    expect(html).toContain(
      normalize(
        '<label for="round-market-fee">Marktplatz Gebühr auf Stufe 1 des Handelspostens (Prozent)</label> <input type="number" id="round-market-fee" min="0" max="100" step="1" value="10" required> <span class="dim">0 bis 100</span>',
      ),
    );
    expect(html).toContain(
      normalize(
        '<input type="number" id="round-market-fee-step" min="0" max="100" step="1" value="1" required>',
      ),
    );
    expect(html).toContain(
      normalize(
        '<label for="round-market-mc">Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant)</label> <input type="number" id="round-market-mc" min="1" max="100000" step="1" value="700" required> <span class="dim">1 bis 100000</span>',
      ),
    );
    expect(html).toContain(
      normalize(
        '<input type="number" id="round-market-limit" min="0" max="10000000" step="1" value="100000" required>',
      ),
    );
  });

  const adminHTML = (cfg: Record<string, number>): string =>
    admin({
      s: {
        cfg: { ...DEFAULT_UNIVERSE, ...cfg },
        admin: { specs: [], endzeit: { minutes: 1, done: false } },
      },
      ui: {},
    } as unknown as V);

  it('warn about a round trip that gains, in the universe settings (D2)', () => {
    expect(adminHTML({})).not.toContain('Achtung');
    const html = adminHTML({ roundMarketMc: 501 });
    expect(html).toContain(
      '<p class="notice" role="alert">Achtung: Ein Tausch im Kreis bringt selbst ohne Gebühr Gewinn: Adamant → Psikristall → Adamant; Adamant → Psikristall → Promethium → Adamant. Bitte die Kurse anpassen.</p>',
    );
    // Below the settings (in their groups since #357; this state has no
    // rows), right above the note of the box.
    expect(html).toMatch(
      /<p class="notice" role="alert">Achtung:[^<]*<\/p><p class="dim">Änderungen wirken sofort/,
    );
  });
});

describe('the state of the view', () => {
  it('has a typed place in the state', () => {
    const s = view().s as GameState;
    expect(s.market).toEqual({ prices: PRICES, used: 0 });
  });
});
