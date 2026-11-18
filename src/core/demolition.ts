// Tearing down a building level („Zurückbauen“, #202,
// okf/features/demolition.md), used by the server and the browser. One level
// per order (D1), based on the cost of the demolished level (D2), for a share
// of its build time (D3) and a refund factor from −100 % to +100 % (D7),
// both set by the admin per round (D4) as two entries of the registry
// `ROUND_SETTINGS` (#283): in the dialog „Neue Runde“ and, `live`, in the
// universe settings (X1). A positive factor gives that share of the cost
// back when the demolition is done; a negative one costs that share when it
// starts (owner, 2026-11-16). The check returns codes (patterns, section 7;
// #214); the server and the browser word them.
import { BUILD } from './catalog.ts';
import { afford, buildTime, lvlCost } from './economy.ts';
import { holding } from './economy-checks.ts';
import { maxFields, usedFields } from './fields.ts';
import { waitsForLab } from './lab.ts';
import type { RoundGroup, RoundSetting } from './round.ts';
import type { Cost, Planet, Queue, ResearchState, Universe } from './types.ts';
import { waitsForYard } from './yard.ts';

/** The refund factor in whole percent (D7): its range and the owner's default. */
export const DEMOLITION_REFUND = { min: -100, max: 100, default: 50 } as const;

/** The time as whole percent of the build time (D3, 2026-11-17). */
export const DEMOLITION_TIME = { min: 1, max: 200, default: 50 } as const;

/**
 * The two settings are sent as one object `demolition` and refused together
 * (as before #283, #214); the dialog shows them in one fieldset with the
 * legend „Rückbau“ (owner, 2026-11-18).
 */
const DEMOLITION: RoundGroup = { name: 'demolition', legend: 'Rückbau' };

/**
 * The refund factor as a setting of the round (#283, D4, D7): a number field
 * of the dialog „Neue Runde“ and, `live`, a row of the universe settings,
 * changed during the round (X1). Refused with the range wording of the
 * universe settings.
 */
export const DEMOLITION_REFUND_SETTING = {
  kind: 'number',
  key: 'roundDemolitionRefund',
  name: 'demolitionRefund',
  label: 'Rückbau-Erstattung (%)',
  order: 180,
  group: DEMOLITION,
  min: DEMOLITION_REFUND.min,
  max: DEMOLITION_REFUND.max,
  def: DEMOLITION_REFUND.default,
  live: true,
} as const satisfies RoundSetting;

/** The duration of a demolition as a setting of the round (#283, D3), like the refund factor. */
export const DEMOLITION_TIME_SETTING = {
  kind: 'number',
  key: 'roundDemolitionTime',
  name: 'demolitionTime',
  label: 'Rückbau-Dauer (% der Bauzeit)',
  order: 190,
  group: DEMOLITION,
  min: DEMOLITION_TIME.min,
  max: DEMOLITION_TIME.max,
  def: DEMOLITION_TIME.default,
  live: true,
} as const satisfies RoundSetting;

/**
 * The refund factor of the universe in percent. A `live` setting is always
 * a row of the universe settings (`universeOf` reads every row).
 */
export const refundOf = (u: Universe): number =>
  u[DEMOLITION_REFUND_SETTING.key] as number;

/** The duration of a demolition of the universe in percent of the build time. */
export const timeOf = (u: Universe): number =>
  u[DEMOLITION_TIME_SETTING.key] as number;

/**
 * Why a level cannot be torn down: on a moon (out of scope of #202, the
 * Mondzitadelle never), no level stands, a level without it would leave the
 * planet with more used fields than it has (the Weltenschmiede, D5), the
 * build queue runs, the building is in use (the shipyard builds, the lab
 * researches, D5), or a negative factor costs more than the planet has.
 */
export type DemolitionError =
  'place' | 'none' | 'fields' | 'busy' | 'yardBusy' | 'labBusy' | 'cost';

/** The cost of the level that a demolition of `key` removes (D2). */
export const demolishedCost = (p: Pick<Planet, 'b'>, key: string): Cost =>
  lvlCost(BUILD[key]!, p.b[key] ?? 0);

/** The share of a cost, rounded down to whole resources. */
const share = (c: Cost, pct: number): Cost =>
  c.map((x) => Math.floor((x * pct) / 100)) as unknown as Cost;

const NOTHING: Cost = [0, 0, 0];

/**
 * What a demolition with the factor `refund` moves: `pay` when it starts
 * (a negative factor), `back` when it is done (a positive factor). At 0 %
 * both are nothing.
 */
export function demolitionMoves(
  cost: Cost,
  refund: number,
): { pay: Cost; back: Cost } {
  return refund < 0
    ? { pay: share(cost, -refund), back: NOTHING }
    : { pay: NOTHING, back: share(cost, refund) };
}

/** Whether the planet would hold more levels than fields without one level of `key`. */
function overflows(p: Planet, key: string, u: Universe): boolean {
  const after = { ...p, b: { ...p.b, [key]: (p.b[key] ?? 0) - 1 } };
  const max = maxFields(after, u);
  return max !== null && usedFields(after) > max;
}

/** Every reason why a level of `key` cannot be torn down on `p`, in the order of the server. */
export function demolitionErrors(
  p: Planet,
  r: Pick<ResearchState, 'rq'>,
  key: string,
  u: Universe,
): DemolitionError[] {
  const level = p.b[key] ?? 0;
  const { pay } = demolitionMoves(
    level ? demolishedCost(p, key) : NOTHING,
    refundOf(u),
  );
  return holding<DemolitionError>({
    place: p.kind === 'moon',
    none: level < 1,
    fields: level > 0 && overflows(p, key, u),
    busy: !!p.bq,
    yardBusy: waitsForYard(p, key),
    labBusy: waitsForLab(r, key),
    cost: !afford(p, pay),
  });
}

/** How long tearing down a level of `key` takes: the share of its build time (D3). */
export const demolitionTime = (
  p: Pick<Planet, 'b'>,
  key: string,
  u: Universe,
): number =>
  Math.ceil((buildTime(demolishedCost(p, key), p, u) * timeOf(u)) / 100);

/**
 * The entry of the build queue that tears down one level of `key` from
 * `start`: the level goes down by one, `cost` is what the start pays (a
 * cancel gives it back, as for building), `back` what the end gives.
 */
export function demolitionOrder(
  p: Pick<Planet, 'b'>,
  key: string,
  u: Universe,
  start: number,
): Queue & { back: Cost } {
  const { pay, back } = demolitionMoves(demolishedCost(p, key), refundOf(u));
  return {
    key,
    lvl: (p.b[key] ?? 0) - 1,
    start,
    end: start + demolitionTime(p, key, u),
    cost: pay,
    back,
  };
}

/** Whether an entry of the build queue tears down instead of building. */
export const isDemolition = (
  q: Pick<Queue, 'back'> | null | undefined,
): boolean => !!q?.back;
