// The view „Marktplatz“ (#171, okf/features/marketplace.md): choose what to
// give and what to get, an amount with „max“, a preview of the result and the
// fee, „Tauschen“. The preview comes from the same function as the server's
// exchange (logic/market.ts). The words are drafts [V] from the issue; the
// refusals are those of src/core/market-text.ts.
import { type Res, RES_NAME, TRADED } from '../../core/market.ts';
import { CLOSED, tradeNote } from '../../core/market-text.ts';
import { esc } from '../logic/format.ts';
import {
  type Draft,
  draft,
  fixed,
  marketOf,
  preview,
  type Preview,
  targets,
} from '../logic/market.ts';
import type { V } from './common.ts';
import { box } from './common.ts';

/** The options of a selection of resources, `chosen` selected. */
const options = (list: readonly Res[], chosen: Res): string =>
  list
    .map(
      (r) =>
        `<option value="${r}"${r === chosen ? ' selected' : ''}>${RES_NAME[r]}</option>`,
    )
    .join('');

/** The options of the resource to get for `give`: every other one. */
export const targetOptions = (d: Draft): string =>
  options(targets(d.give), d.get);

/** The preview below the fields: its lines, and the note under them. */
export function previewHTML(p: Preview): string {
  const rows = p.lines
    .map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.value)}</td></tr>`)
    .join('');
  const note = p.note
    ? `<p class="${p.ok ? 'dim' : 'bad'}">${esc(p.note)}</p>`
    : '';
  return `<table class="kv">${rows}</table>${note}`;
}

/** The view: the form while the market is open and the planet has a Handelsposten, else the reason. */
export function market(v: V): string {
  const m = marketOf(v.s, v.P);
  const head = '<h2>Marktplatz</h2>';
  if (!m?.open) return `${head}<div class="notice">${CLOSED}</div>`;
  if (m.level < 1)
    return `${head}<div class="notice">${esc(tradeNote('noPost', m, 'm'))} Baue ihn unter „Gebäude“.</div>`;
  const d = fixed(draft);
  const p = preview(m, d);
  return `${head}${box(
    'Tauschen',
    `<form id="marketform">
  <p><label for="market-give">Du gibst</label> <select id="market-give">${options(TRADED, d.give)}</select></p>
  <p><label for="market-get">Du erhältst</label> <select id="market-get">${targetOptions(d)}</select></p>
  <p><label for="market-amount">Menge</label> <input type="number" id="market-amount" min="1" step="1" inputmode="numeric" autocomplete="off" value="${esc(d.amount)}"> <button type="button" data-act="marketMax">max</button></p>
  <div id="market-preview" role="status">${previewHTML(p)}</div>
  <p><button type="submit" id="market-trade"${p.ok ? '' : ' disabled'}>Tauschen</button></p>
</form>`,
  )}`;
}
