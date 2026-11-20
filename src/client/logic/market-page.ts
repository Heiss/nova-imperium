// The page „Marktplatz“ (#171, okf/features/marketplace.md) of the view
// state, as the component Market renders it (#118): the notice while the
// market is closed or the planet has no Handelsposten, else the form with
// its draft. The words are drafts [V] from the issue; the refusals are those
// of src/core/market-text.ts. The two lists of options and the preview are
// HTML here because features/market.ts writes them into their places with
// the same functions while the player types.
import { type Res, RES_NAME, TRADED } from '../../core/market.ts';
import { CLOSED, tradeNote } from '../../core/market-text.ts';
import type { V } from '../views/common.ts';
import { esc } from './format.ts';
import {
  type Draft,
  draft,
  fixed,
  marketOf,
  preview,
  type Preview,
  targets,
} from './market.ts';

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

/** What the page shows: a notice, or the form with the draft. */
export type MarketPage =
  | { kind: 'notice'; text: string }
  | {
      kind: 'form';
      giveOptions: string;
      getOptions: string;
      /** The amount as typed. */
      amount: string;
      /** The preview, as HTML (`previewHTML`). */
      preview: string;
      /** Whether „Tauschen“ is offered: the server would take the exchange. */
      ok: boolean;
    };

/** The page of the shown planet: the form while the market is open and the planet has a Handelsposten, else the reason. */
export function marketPage(v: V): MarketPage {
  const m = marketOf(v.s, v.P);
  if (!m?.open) return { kind: 'notice', text: CLOSED };
  if (m.level < 1)
    return {
      kind: 'notice',
      text: `${tradeNote('noPost', m, undefined)} Baue ihn unter „Gebäude“.`,
    };
  const d = fixed(draft);
  const p = preview(m, d);
  return {
    kind: 'form',
    giveOptions: options(TRADED, d.give),
    getOptions: targetOptions(d),
    amount: d.amount,
    preview: previewHTML(p),
    ok: p.ok,
  };
}
