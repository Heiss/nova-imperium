// The planned start of the leader's fleet of an attack union (#478, owner,
// 2026-11-28; okf/features/holding-acs.md): a union whose arrival X the
// leader's fleet cannot reach at once even at 10 % starts it by itself at X
// minus its flight at the step he chose. Until then the ships stay on the
// planet and defend it (they can be lost there); at the start what is left
// flies and the fuel is paid. No ship left, too little Promethium, the planet
// no longer his or the target refused: nothing starts, and the union is
// dissolved, every fleet that joined turns back as on the leader's recall.
// The leader can abort the planned start, which dissolves the union too
// (owner: when the leader aborts, the union aborts).
import { countUnits, distance, fuelFor } from '../../core/flight.ts';
import { missionRules } from '../../core/missions.ts';
import { settle } from '../../core/settle.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import { UNION_MISSION } from '../../core/union.ts';
import type { Union } from '../db/repos/unions.ts';
import { record } from '../audit.ts';
import type { Handler } from './actions.ts';
import {
  type Ctx,
  GameError,
  addReport,
  coords,
  fail,
  universe,
} from './context.ts';
import type { ServerFeature } from './feature.ts';
import {
  checkDestination,
  placeFacts,
  recalledAt,
  takeOff,
} from './fleet-actions.ts';
import { attackEvent } from './guild-events.ts';
import { dissolvedReport, RECALLED } from './union.ts';

const NONE = { m: 0, c: 0, d: 0 };

/** The words of a start that did not happen, to the leader (#478) [V]. */
export const NOT_STARTED = {
  title: (at: string) => `Geplanter Angriff nicht gestartet ${at}`,
  ships: (at: string) =>
    `Dein geplanter Sturmangriff auf ${at} ist nicht gestartet: Auf dem Planeten ist keines der geplanten Schiffe mehr. Der Angriffsverband ist aufgelöst.`,
  planet: (at: string) =>
    `Dein geplanter Sturmangriff auf ${at} ist nicht gestartet: Der Planet des Starts gehört dir nicht mehr. Der Angriffsverband ist aufgelöst.`,
  fuel: (at: string, need: number, have: number) =>
    `Dein geplanter Sturmangriff auf ${at} ist nicht gestartet: zu wenig Promethium (nötig ${need.toLocaleString('de-DE')}, vorhanden ${Math.floor(have).toLocaleString('de-DE')}). Der Angriffsverband ist aufgelöst.`,
  target: (at: string, why: string) =>
    `Dein geplanter Sturmangriff auf ${at} ist nicht gestartet: ${why} Der Angriffsverband ist aufgelöst.`,
} as const;

/** The words to each member when the leader's fleet did not start (#478) [V]. */
export const LEAD_NOT_STARTED = (at: string): string =>
  `Die Flotte des Anführers ist nicht gestartet; der Angriffsverband auf ${at} ist aufgelöst. Deine Flotte kehrt um.`;

/** The ships of the plan that are still there, each kind at most as many as planned. */
const leftOf = (planned: Levels, there: Levels): Levels =>
  Object.fromEntries(
    Object.entries(planned)
      .map(([k, n]) => [k, Math.min(n, there[k] ?? 0)] as const)
      .filter(([, n]) => n > 0),
  );

/**
 * Dissolves a union whose leader's fleet has not started, at `at`: every
 * fleet that joined turns back as on the recall, its owner gets a report
 * with `why`, and the row and its invitations go.
 */
function dissolve(
  ctx: Ctx,
  row: Union,
  at: number,
  why: (place: string) => string,
): void {
  for (const m of ctx.fleets.ofUnion(row.id)) {
    ctx.fleets.setUnion(m.id, null);
    delete m.union;
    m.ret = recalledAt(m, at);
    m.state = 'back';
    m.recalled = true;
    ctx.fleets.save(m);
    if (m.owner !== row.leader) dissolvedReport(ctx, m, at, why);
  }
  ctx.unions.delete(row.id);
}

/** A start that did not happen: the leader's report, and the union dissolved. */
function notStarted(ctx: Ctx, row: Union, at: number, text: string): void {
  dissolve(ctx, row, at, LEAD_NOT_STARTED);
  addReport(
    ctx,
    row.leader,
    {
      time: at,
      type: 'info',
      title: NOT_STARTED.title(coords(row.toC)),
      text,
    },
    { topic: 'fleet' },
  );
}

/**
 * The refusal of the target at the start, with every check of a Sturmangriff
 * as at a send, or null when it may start.
 */
function targetRefusal(
  ctx: Ctx,
  row: Union,
  p: Planet,
  ships: Levels,
): string | null {
  const u = ctx.players.get(row.leader)!;
  try {
    checkDestination(
      ctx,
      u,
      p,
      missionRules(UNION_MISSION)!,
      ctx.planets.get(row.target),
      ships,
      placeFacts(ctx, row.toC, row.target.startsWith('m'), row.start!.at),
      UNION_MISSION,
    );
    return null;
  } catch (e) {
    if (e instanceof GameError) return e.message;
    throw e;
  }
}

/**
 * Starts the leader's fleet of a union at its planned start (#478): what is
 * left of the planned ships on the planet flies, the fuel of its step is
 * paid then, and it arrives at X; else nothing starts and the union is
 * dissolved.
 */
export function startPlanned(ctx: Ctx, row: Union): void {
  const s = row.start!;
  const place = coords(row.toC);
  const u = ctx.players.get(row.leader);
  const p0 = ctx.planets.get(s.from);
  if (!u || !p0 || p0.owner !== u.id)
    return notStarted(ctx, row, s.at, NOT_STARTED.planet(place));
  const p = settle(p0, s.at, universe(ctx), u);
  const ships = leftOf(s.ships, p.ships);
  if (!countUnits(ships))
    return notStarted(ctx, row, s.at, NOT_STARTED.ships(place));
  const refused = targetRefusal(ctx, row, p, ships);
  if (refused)
    return notStarted(ctx, row, s.at, NOT_STARTED.target(place, refused));
  const fuel = fuelFor(ships, distance(p, row.toC), s.pct);
  if (p.res.d < fuel)
    return notStarted(ctx, row, s.at, NOT_STARTED.fuel(place, fuel, p.res.d));
  launch(ctx, row, p, ships, fuel);
}

/** The planned fleet leaves the planet `p` with `ships` and pays `fuel`; the row loses its start. */
function launch(
  ctx: Ctx,
  row: Union,
  p: Planet,
  ships: Levels,
  fuel: number,
): void {
  const s = row.start!;
  takeOff(p, ships, NONE, fuel);
  ctx.planets.save(p);
  const fleet: Fleet = {
    id: row.lead!,
    owner: row.leader,
    from: p.id,
    fromC: { g: p.g, s: p.s, p: p.p },
    to: row.target,
    toC: row.toC,
    mission: UNION_MISSION,
    ships,
    cargo: { ...NONE },
    dep: s.at,
    arr: row.arr,
    ret: row.arr + (row.arr - s.at),
    state: 'out',
    recalled: false,
    fuel,
    union: row.id,
  };
  const started = { ...row };
  delete started.start;
  ctx.unions.save(started);
  ctx.fleets.save(fleet);
  const owner = ctx.planets.get(row.target)!.owner;
  // The guild of the defender learns of the attack at its start (#169 D3).
  attackEvent(ctx, fleet, owner);
  record(ctx, {
    category: 'game',
    action: 'plannedStart',
    actor: row.leader,
    target: owner,
    detail: {
      fleet: fleet.id,
      planet: fleet.to,
      origin: fleet.from,
      start: s.at,
      due: fleet.arr,
    },
  });
}

/** The leader aborts his planned start: the union is dissolved, as on his recall (Q2). */
const cancelPlan: Handler<'cancelPlan'> = (ctx, u, d, event) => {
  const row = ctx.unions.get(String(d.id));
  if (!row?.start || row.leader !== u.id)
    return fail('Diesen geplanten Start gibt es nicht mehr.');
  dissolve(ctx, row, ctx.now(), RECALLED);
  if (event) event.detail = { union: row.id, planet: row.target };
  return 'Geplanter Start abgebrochen. Der Angriffsverband ist aufgelöst.';
};

export const serverFeature = {
  actions: { cancelPlan },
} satisfies ServerFeature;
