// The view „Marktplatz“ (#171), as the component Market renders it (#118,
// bundle 7): the closed notice, the missing Handelsposten, the form with its
// preview, the menu entry, and the places of the settings in the dialog
// „Neue Runde“ and the admin panel.
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet, roundDefaults } from '../../test/fixtures.ts';
import { marketView } from '../../test/market-view.ts';
import { normalize } from '../../test/markup.ts';
import { draft, newDraft, preview } from '../logic/market.ts';
import { previewHTML, targetOptions } from '../logic/market-page.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { menu } from './index.ts';
import { admin, roundDialog } from './misc.ts';
import { ANEW, MOUNTED } from './mount.ts';

const market = (v: V): string => normalize(marketView(v));

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
  it('is a mounted view, mounted anew on every render, and in the menu after „Rohstoffe“', () => {
    expect(MOUNTED.has('market')).toBe(true);
    expect(ANEW.has('market')).toBe(true);
    const items = menu(false, view().s.round);
    const labels = items.flatMap((i) => (i === '-' ? [] : [i.label]));
    expect(labels[labels.indexOf('Rohstoffe') + 1]).toBe('Marktplatz');
    expect(items).toContainEqual({ view: 'market', label: 'Marktplatz' });
  });

  it('says that the market is closed in a round with it off (the issue)', () => {
    expect(market(view({ marketOn: 0 }))).toBe(
      '<h2>Marktplatz</h2><div class="notice">Der Marktplatz ist in dieser Runde geschlossen.</div>',
    );
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

  it('lists the resources to get for a resource: every other one, the chosen selected', () => {
    expect(targetOptions({ give: 'm', get: 'd', amount: '' })).toBe(
      '<option value="c">Psikristall</option><option value="d" selected>Promethium</option>',
    );
    expect(targetOptions({ give: 'd', get: 'm', amount: '' })).toBe(
      '<option value="m" selected>Adamant</option><option value="c">Psikristall</option>',
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
    expect(html).toContain('<fieldset><legend>Marktplatz</legend>');
    expect(html).toContain(
      '<label for="round-market-on">Marktplatz aktiv</label> <select id="round-market-on"><option value="1">Ja</option><option value="0" selected>Nein</option></select>',
    );
    expect(html).toContain(
      '<label for="round-market-fee">Marktplatz Gebühr auf Stufe 1 des Handelspostens (Prozent)</label> <input type="number" id="round-market-fee" min="0" max="100" step="1" value="10" required> <span class="dim">0 bis 100</span>',
    );
    expect(html).toContain(
      'id="round-market-fee-step" min="0" max="100" step="1" value="1"',
    );
    expect(html).toContain(
      '<label for="round-market-mc">Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant)</label> <input type="number" id="round-market-mc" min="1" max="100000" step="1" value="700" required> <span class="dim">1 bis 100000</span>',
    );
    expect(html).toContain(
      'id="round-market-limit" min="0" max="10000000" step="1" value="100000"',
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
    expect(
      html.indexOf('</table><p class="notice" role="alert">'),
    ).toBeGreaterThan(0);
  });
});

describe('the state of the view', () => {
  it('has a typed place in the state', () => {
    const s = view().s as GameState;
    expect(s.market).toEqual({ prices: PRICES, used: 0 });
  });
});
