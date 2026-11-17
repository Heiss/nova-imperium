// The browser side of „Zurückbauen“ (#202, okf/features/demolition.md): the
// button of a building row, the confirmation with what the demolition moves
// and the note of a refusal, from `demolitionErrors` of
// src/core/demolition.ts, the check of the server (patterns, section 7).
import {
  DEMOLITION_KEYS,
  type DemolitionError,
  type DemolitionRules,
  demolishedCost,
  demolitionErrors,
  demolitionMoves,
  demolitionTime,
  isDemolition,
} from '../../core/demolition.ts';
import { text } from '../../core/text.ts';
import type { Cost, Levels, Queue } from '../../core/types.ts';
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { V } from '../views/common.ts';
import { dur, esc, fmt } from './format.ts';

/**
 * The note of each refusal, the server's words (DEMOLITION_ERROR,
 * src/test/demolition-texts.test.ts keeps them equal).
 */
export const DEMOLITION_NOTE: Readonly<Record<DemolitionError, string>> = {
  place: 'Ungültig.',
  none: 'Ungültig.',
  fields: 'Keine freien Felder.',
  busy: 'Es wird bereits gebaut.',
  yardBusy: 'Die Schiffsschmiede arbeitet gerade.',
  labBusy: 'Das Scholarium forscht gerade.',
  cost: 'Der Zehnte reicht nicht aus.',
};

/** The codes that hide the button: a moon, no level, a running order (the row shows it). */
const HIDDEN: ReadonlySet<DemolitionError> = new Set(['place', 'none', 'busy']);

/** Whether a building row offers „Zurückbauen“; a refusal is named in the confirmation. */
export const canOfferDemolition = (v: V, key: string): boolean =>
  !demolitionErrors(v.P, v.R, key, v.s.cfg).some((code) => HIDDEN.has(code));

/** The resources with the game's names (#202, 2026-11-17). */
const resources = (c: Cost): string =>
  `${fmt(c[0])} Adamant, ${fmt(c[1])} Psikristall, ${fmt(c[2])} Promethium`;

/** What a demolition gives back or costs, in the owner's words (2026-11-17). */
export function refundSentence(cost: Cost, refund: number): string {
  const { pay, back } = demolitionMoves(cost, refund);
  if (refund > 0)
    return `Du erhältst ${resources(back)} zurück (Erstattung ${refund} %).`;
  if (refund < 0)
    return `Der Rückbau kostet ${resources(pay)} (Erstattung −${-refund} %).`;
  return 'Du erhältst nichts zurück.';
}

/**
 * The confirmation of „Zurückbauen“: the building and its new level, what
 * it moves and how long it takes; a refusal of the check instead of the
 * button that sends it.
 */
export function demolitionDialog(v: V, key: string): string {
  const { P, R, s } = v;
  const level = P.b[key] ?? 0;
  const error = demolitionErrors(P, R, key, s.cfg)[0];
  const confirm = error
    ? `<p class="req">${DEMOLITION_NOTE[error]}</p>`
    : `<button class="red" data-act="doDemolish" data-k="${esc(key)}">Zurückbauen</button> `;
  return `<p><b>${esc(text(key)!.n)}</b>: Rückbau auf Stufe ${level - 1}</p>
  <p>${refundSentence(demolishedCost(P, key), s.cfg.roundDemolitionRefund)}</p>
  <p class="dim">Rückbau-Dauer: ${dur(demolitionTime(P, key, s.cfg))}</p>
  <p>${confirm}<button data-act="closeModal">Abbrechen</button></p>`;
}

/**
 * The mark of a finished order of the build queue or the research, `label`
 * for one that went up; a demolition (#202) is „Rückbau fertig“ once the
 * level went down to its level. Null while it runs or when it was
 * cancelled.
 */
export function finishedLabel(
  order: Queue | null,
  have: number,
  now: number,
  label: string,
): string | null {
  if (!order || order.end > now) return null;
  if (isDemolition(order)) return have > order.lvl ? null : 'Rückbau fertig';
  return have < order.lvl ? null : label;
}

/** The menu mark and the notice of a finished order, or null (`finishedLabel`). */
export function completion(
  order: Queue | null,
  levels: Levels,
  now: number,
  label: string,
): { label: string; notice: string } | null {
  const done =
    order && finishedLabel(order, levels[order.key] ?? 0, now, label);
  if (!order || !done) return null;
  const name = text(order.key)?.n ?? order.key;
  return { label: done, notice: `${done}: ${name} (Stufe ${order.lvl}).` };
}

/** What the actions of „Zurückbauen“ need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
  /** The view state shown now. */
  view: () => V | null;
}

/** The data-act handlers: „Zurückbauen“ opens the confirmation, its button sends the order. */
export function demolitionActs({
  act,
  modal,
  view,
}: Deps): Record<string, (d: Record<string, string | undefined>) => unknown> {
  return {
    demolish: (d) => {
      const v = view();
      if (v && d.k) modal(demolitionDialog(v, d.k));
    },
    doDemolish: (d) => {
      modal('');
      return act('demolish', { key: d.k });
    },
  };
}

/** The settings of a round in the dialog „Neue Runde“ (X1), named as in the universe settings. */
const ROUND_INPUTS = (['refund', 'time'] as const).map((part) => ({
  part,
  id: `round-demolition-${part}`,
  spec: UNIVERSE_SPECS.find((s) => s.key === DEMOLITION_KEYS[part])!,
}));

/** The inputs of the refund factor and the time in „Neue Runde“, preselected with the current round. */
export const demolitionRoundInputs = (current: DemolitionRules): string =>
  ROUND_INPUTS.map(
    ({ part, id, spec }) =>
      `<p><label for="${id}">${esc(spec.label)}</label> <input type="number" id="${id}" min="${spec.min}" max="${spec.max}" step="1" value="${current[part]}" required> <span class="dim">${spec.min} bis ${spec.max}</span></p>`,
  ).join('');

/** A field as a number; an empty one as none, so the server refuses it. */
const num = (raw: string): number | null =>
  raw.trim() === '' ? null : Number(raw);

/** What „Ja, neue Runde“ sends of the demolition; `val` reads an input. */
export const demolitionRoundChoice = (
  val: (sel: string) => string,
): Record<'refund' | 'time', number | null> => ({
  refund: num(val('#round-demolition-refund')),
  time: num(val('#round-demolition-time')),
});
