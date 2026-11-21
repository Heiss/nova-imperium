// The vacation mode („Urlaubsmodus“, #223, okf/features/vacation-mode.md):
// the player starts and ends it in the options. The rules are those of
// src/core/vacation.ts (patterns, section 7); the server gathers what runs,
// settles the planets at the start and the end and words the codes. The
// own game actions are refused in dispatch.ts, a new mission of another
// player by `sendError` (code `vacation`); a new round ends every vacation
// with a notice (admin.ts).
import { settle, settleR } from '../../core/settle.ts';
import {
  type VacationEntryError,
  vacationEnd,
  vacationEntryError,
  vacationExitError,
} from '../../core/vacation.ts';
import type { User } from '../db/repos/players.ts';
import type { Handler } from './actions.ts';
import { addReport, type Ctx, fail, universe } from './context.ts';
import { heldAt, sendHome } from './holding.ts';
import { lockEndText } from './main-planet.ts';
import { roundRules } from './round.ts';
import type { ServerFeature } from './feature.ts';

/** The refusal of an own game action during the vacation mode (Q2) [V]. */
export const VACATION_REFUSED = 'Im Urlaubsmodus nicht möglich.';

/** The German message of each code of `vacationEntryError` (Q1) [V]. */
export const VACATION_ENTRY_ERROR: Readonly<
  Record<VacationEntryError, string>
> = {
  fleets:
    'Der Urlaubsmodus kann nicht aktiviert werden, solange eigene Flotten unterwegs sind.',
  building:
    'Der Urlaubsmodus kann nicht aktiviert werden, solange gebaut wird.',
  research:
    'Der Urlaubsmodus kann nicht aktiviert werden, solange geforscht wird.',
  shipyard:
    'Der Urlaubsmodus kann nicht aktiviert werden, solange die Schiffsschmiede arbeitet.',
};

/** The refusal of an end before the minimum duration: when it is possible [V]. */
export const earlyText = (end: number): string =>
  `Der Urlaubsmodus ist frühestens beendbar am ${lockEndText(end)}.`;

/** The notice of a new round to a player whose vacation it ended (D3) [V]. */
export const VACATION_NOTICE = {
  title: 'Urlaubsmodus beendet',
  text: 'Die neue Runde hat deinen Urlaubsmodus beendet.',
} as const;

/** Whether the player `uid` is in vacation mode; for the protection of a target. */
export const inVacation =
  (ctx: Ctx) =>
  (uid: string): boolean =>
    (ctx.players.get(uid)?.vacation ?? null) !== null;

/** Every planet and moon of `u` settled to now, with the vacation as stored. */
const settledPlaces = (ctx: Ctx, u: User) =>
  ctx.planets.ofOwner(u.id).map((p) => settle(p, ctx.now(), universe(ctx), u));

/**
 * The fleets of other players that hold at a planet or moon of `u` fly home
 * at once (owner, 2026-11-19), the same flight home as at the end of their
 * holding time. Fleets still on their way are turned home at their arrival
 * (the arrival of a Wache stellen).
 */
const sendGuardsHome = (ctx: Ctx, places: readonly { id: string }[]): void => {
  for (const p of places) for (const f of heldAt(ctx, p.id)) sendHome(ctx, f);
};

/** Starts the vacation now, once nothing runs (Q1); the production up to now is kept. */
const startVacation: Handler<'startVacation'> = (ctx, u, _d, event) => {
  const now = ctx.now();
  const places = settledPlaces(ctx, u);
  const research = settleR(u, now);
  const error = vacationEntryError({
    fleets: ctx.fleets.count(u.id),
    building: places.some((p) => p.bq !== null),
    research: research.rq !== null,
    shipyard: places.some((p) => p.sq.length > 0),
  });
  if (error) return fail(VACATION_ENTRY_ERROR[error]);
  for (const p of places) ctx.planets.save(p);
  u.research = research.research;
  u.rq = null;
  u.vacation = now;
  ctx.players.save(u);
  sendGuardsHome(ctx, places);
  if (event)
    event.detail = {
      since: now,
      end: vacationEnd(now, roundRules(ctx).vacationHours),
    };
  return 'Urlaubsmodus aktiviert.';
};

/** Ends the vacation once the minimum duration of the round is over; the production goes on from now. */
const endVacation: Handler<'endVacation'> = (ctx, u) => {
  const hours = roundRules(ctx).vacationHours;
  const error = vacationExitError(u.vacation, hours, ctx.now());
  if (error === 'early')
    return fail(earlyText(vacationEnd(u.vacation!, hours)));
  if (error) return fail('Du bist nicht im Urlaubsmodus.');
  // Settled with the vacation, so the planets move to now without production.
  for (const p of settledPlaces(ctx, u)) ctx.planets.save(p);
  u.vacation = null;
  ctx.players.save(u);
  return 'Urlaubsmodus beendet.';
};

/** The notice of a new round to `uid`, whose vacation it ended (D3). */
export function vacationNotice(ctx: Ctx, uid: string): void {
  addReport(
    ctx,
    uid,
    { time: ctx.now(), type: 'info', ...VACATION_NOTICE },
    { topic: 'announcement' },
  );
}

export const serverFeature = {
  actions: { startVacation, endVacation },
} satisfies ServerFeature;
