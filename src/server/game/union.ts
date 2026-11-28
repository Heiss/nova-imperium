// The attack union („Verbandsangriff“, #225, #466, okf/features/holding-acs.md)
// on the server: planning a union with the leader's own Sturmangriff that
// arrives at a fixed time X (#466, A1a), inviting allies, joining with a fleet that arrives at the fixed arrival X
// (the action `send` asks `joinPlan`), the recall of a fleet of a union and
// the arrival of all fleets at once. The rules (limits, the window, the
// speed, the split of the loot) are the pure ones of src/core/union.ts; here
// the facts are gathered and the codes worded. A union is a row of
// `attack_unions` (leader, target, X, the leader's fleet that leads it) and
// the fleets that carry its ID (`fleets.union_id`); it ends at X, or when
// the leader recalls the fleet that leads it (owner, 2026-11-16, Q2).
import { ALLIES } from '../../core/holding.ts';
import {
  type UnionFacts,
  type UnionLimits,
  inviteLimitError,
  joinLimitError,
  flightRefusal,
  joinMessage,
  joinWindow,
  planError,
  planMessage,
  plannedStart,
  UNION_OFF_REFUSAL,
  unionFlight,
  unionOpen,
} from '../../core/union.ts';
import type { Union } from '../db/repos/unions.ts';
import type { Fleet, Levels } from '../../core/types.ts';
import type { Handler } from './actions.ts';
import { addReport, coords, fail, str, universe, type Ctx } from './context.ts';
import { isAllyOf } from './holding.ts';
import { roundRules } from './round.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape, UnionState } from '../../core/state/union.ts';

/** The limits and the timing rules of the round (owner, 2026-11-16, D3; 2026-11-17). */
export const limitsOf = (ctx: Ctx): UnionLimits => {
  const r = roundRules(ctx);
  return {
    fleets: r.unionFleets,
    players: r.unionPlayers,
    cutoff: r.unionCutoff,
  };
};

/** A union that is alive, with its fleets on their way out, the leading one first. */
export interface LiveUnion {
  row: Union;
  fleets: Fleet[];
}

/** The fleets of a union, its leading fleet first, then by departure. */
const fleetsOf = (ctx: Ctx, row: Union): Fleet[] => {
  const all = ctx.fleets.ofUnion(row.id);
  const lead = all.filter((f) => f.id === row.lead);
  return [...lead, ...all.filter((f) => f.id !== row.lead)];
};

/**
 * The union with the ID `id` as long as it is alive (#466): it has a row, has
 * not arrived, and its leading fleet is still on its way out in it, or its
 * start is still planned (#478). A leading fleet that turned back by another
 * way than the recall (the target deleted its account) ends the union too.
 */
export function unionOf(ctx: Ctx, id: unknown): LiveUnion | null {
  const row = ctx.unions.get(String(id));
  if (!row || row.arr <= ctx.now()) return null;
  if (row.start) return { row, fleets: fleetsOf(ctx, row) };
  const lead = ctx.fleets.get(row.lead ?? '');
  if (lead?.state !== 'out' || lead.union !== row.id) return null;
  return { row, fleets: fleetsOf(ctx, row) };
}

/** What a joining fleet meets of the union. */
const factsOf = (ctx: Ctx, union: LiveUnion): UnionFacts => ({
  leader: union.row.leader,
  // The leader first; his fleet counts from the planning, before it starts (#478).
  owners: [
    ...(union.row.start ? [union.row.leader] : []),
    ...union.fleets.map((f) => f.owner),
  ],
  invited: ctx.fleets.invited(union.row.id),
});

/** Refuses while the switch of the round is off (#466, 4). */
const switchedOn = (ctx: Ctx): void => {
  if (!unionOpen(roundRules(ctx))) fail(UNION_OFF_REFUSAL);
};

/**
 * The earliest start a refusal names, to the second in German time [V]: a
 * fleet sent at that second or later and before X makes it.
 */
export const startText = (t: number): string =>
  new Date(Math.ceil(t / 1000) * 1000).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const GONE = 'Diesen Angriffsverband gibt es nicht mehr.';

/** Who may join or be invited, as the refusal names them by the setting of the round (D2) [V]. */
function notAlly(ctx: Ctx, what: 'invite' | 'join'): string {
  const allies = roundRules(ctx).allies;
  const who =
    allies === ALLIES.guild
      ? 'Gildenmitglieder'
      : allies === ALLIES.friends
        ? 'Freunde'
        : 'Gildenmitglieder und Freunde';
  return what === 'invite'
    ? `Zum Angriffsverband laden nur ${who} ein.`
    : `Dem Angriffsverband treten nur ${who} des Anführers bei.`;
}

/** The leader invites the player `d.name` to the union `d.id`. */
const inviteUnion: Handler<'inviteUnion'> = (ctx, u, d) => {
  switchedOn(ctx);
  const union = unionOf(ctx, d.id);
  if (!union) return fail(GONE);
  const { row } = union;
  if (row.leader !== u.id)
    return fail('Nur der Anführer lädt zum Angriffsverband ein.');
  const invitee = ctx.players.byName(str(d.name, 20));
  if (!invitee) return fail('Spieler nicht gefunden.');
  if (invitee.id === u.id) return fail('Das bist du selbst.');
  if (ctx.planets.get(row.target)?.owner === invitee.id)
    return fail('Der Verteidiger kann nicht eingeladen werden.');
  if (!isAllyOf(ctx, u.id, invitee.id)) return fail(notAlly(ctx, 'invite'));
  const limits = limitsOf(ctx);
  if (inviteLimitError(factsOf(ctx, union), invitee.id, limits))
    return fail(
      `Am Angriffsverband können höchstens ${limits.players} Spieler teilnehmen.`,
    );
  ctx.fleets.invite(row.id, invitee.id);
  addReport(
    ctx,
    invitee.id,
    {
      time: ctx.now(),
      type: 'info',
      title: `Einladung zum Verbandsangriff ${coords(row.toC)}`,
      text: `${u.name} lädt dich zu einem Verbandsangriff auf ${coords(row.toC)} ein.`,
    },
    { topic: 'fleet' },
  );
  return `Einladung an ${invitee.name} gesendet.`;
};

/** The arrival of a fleet that flies to X: the speed that brings it there, or the refusal. */
function flightTo(
  ctx: Ctx,
  arr: number,
  at: { dist: number; speed: number },
  limits: UnionLimits,
): number {
  const flight = unionFlight({
    dist: at.dist,
    speed: at.speed,
    universe: universe(ctx),
    now: ctx.now(),
    arr,
  });
  if ('error' in flight) return fail(flightRefusal(flight, limits, startText));
  return flight.pct;
}

/**
 * A union the fleet plans: its arrival X and the speed that brings the
 * leader's fleet there; with `start`, the fleet cannot reach X at once even
 * at 10 % and starts by itself then, at the step `pct` the leader chose
 * (#478).
 */
export interface UnionPlan {
  arr: number;
  pct: number;
  start?: number;
}

/**
 * The checks of a Sturmangriff of the leader that plans a union arriving at
 * `plan` (#466, owner, 2026-11-28, A1a): the switch of the round, an attack,
 * no join at once, X in the future and beyond the cut-off (else nobody could
 * join [V]), and the speed that brings the fleet there at X. The checks of
 * the target are those of the attack. Returns X and the speed.
 */
export function planOf(
  ctx: Ctx,
  plan: unknown,
  at: {
    mission: string;
    union: unknown;
    dist: number;
    speed: number;
    /** The speed step of the form, tenths 1 to 10. */
    pct: number;
  },
): UnionPlan | null {
  if (plan === undefined || plan === null) return null;
  switchedOn(ctx);
  if (at.mission !== 'attack')
    return fail('Einen Angriffsverband plant man mit einem Sturmangriff.');
  if (at.union !== undefined && at.union !== null && at.union !== '')
    return fail(
      'Eine Flotte plant einen Angriffsverband oder tritt einem bei, nicht beides.',
    );
  const arr = Number(plan);
  const limits = limitsOf(ctx);
  const refused = Number.isSafeInteger(arr)
    ? planError({ now: ctx.now(), arr, limits })
    : 'past';
  if (refused) return fail(planMessage(refused, limits));
  return later(ctx, arr, at) ?? { arr, pct: flightTo(ctx, arr, at, limits) };
}

/**
 * Too early even at 10 %: the fleet starts later by itself, at the step the
 * leader chose, so that it arrives at X (owner, 2026-11-28, #478); else none.
 */
function later(
  ctx: Ctx,
  arr: number,
  at: { dist: number; speed: number; pct: number },
): Required<UnionPlan> | null {
  const world = universe(ctx);
  const flight = unionFlight({ ...at, universe: world, now: ctx.now(), arr });
  return 'error' in flight && flight.error === 'early'
    ? { arr, pct: at.pct, start: plannedStart({ ...at, universe: world, arr }) }
    : null;
}

/**
 * Founds the union of a fleet planned to start later (#478): the union has
 * the ID the fleet will have and carries its start; nothing leaves the
 * planet until then.
 */
export function planLater(
  ctx: Ctx,
  plan: Required<UnionPlan>,
  fleet: Pick<Fleet, 'id' | 'owner' | 'from' | 'to' | 'toC' | 'ships'>,
): void {
  ctx.unions.save({
    id: fleet.id,
    leader: fleet.owner,
    lead: fleet.id,
    target: fleet.to,
    toC: fleet.toC,
    arr: plan.arr,
    start: {
      at: plan.start,
      from: fleet.from,
      ships: fleet.ships,
      pct: plan.pct,
    },
  });
}

/**
 * The ships of the planet `planet` that a planned start holds back (#478):
 * they stay on the planet and defend it, but no other order takes them.
 */
export function reservedAt(ctx: Ctx, planet: string): Levels {
  const out: Levels = {};
  for (const row of ctx.unions.startsFrom(planet))
    for (const [k, n] of Object.entries(row.start!.ships))
      out[k] = (out[k] ?? 0) + n;
  return out;
}

/** The planned starts of `uid` that have not started yet: each takes a fleet slot (#478). */
export const plannedBy = (ctx: Ctx, uid: string): number =>
  ctx.unions.ledBy(uid).filter((id) => ctx.unions.get(id)?.start !== undefined)
    .length;

/**
 * Founds the union of a planned fleet before it is saved: the fleet carries
 * the union's ID, its own, and leads it.
 */
export function foundUnion(ctx: Ctx, plan: UnionPlan, fleet: Fleet): void {
  fleet.union = fleet.id;
  ctx.unions.save({
    id: fleet.id,
    leader: fleet.owner,
    lead: fleet.id,
    target: fleet.to,
    toC: fleet.toC,
    arr: plan.arr,
  });
}

/** A fleet that joins a union: the union, its arrival X and the speed that brings the fleet there. */
export interface JoinPlan {
  union: string;
  arr: number;
  /** The speed in tenths, between 1 (10 %) and 10 (100 %), not only the steps (#466, 7b). */
  pct: number;
}

/**
 * The checks of a fleet of `uid` that joins the union `id` with a Sturmangriff
 * to `to`, flying `dist` at the speed `speed`, before anything is spent: the
 * switch of the round, the union is alive and flies to that place, the
 * player is an ally of the leader and invited (the leader and every player
 * already in need no invitation), the limits of fleets and players, the
 * cut-off, and the speed that brings the fleet there at X (too early even at
 * 10 % and too late even at 100 % are refused, #466). Returns the arrival
 * and the speed.
 */
export function joinPlan(
  ctx: Ctx,
  uid: string,
  id: unknown,
  at: { mission: string; to: string; dist: number; speed: number },
): JoinPlan | null {
  // A fleet of no union: the form sends no union, or an empty one.
  if (id === undefined || id === null || id === '') return null;
  switchedOn(ctx);
  const union = unionOf(ctx, id);
  if (!union) return fail(GONE);
  const { row } = union;
  if (at.mission !== 'attack')
    return fail(
      'Einem Angriffsverband schließt man sich mit einem Sturmangriff an.',
    );
  if (at.to !== row.target)
    return fail(`Der Angriffsverband fliegt nach ${coords(row.toC)}.`);
  const limits = limitsOf(ctx);
  mayJoin(ctx, uid, union, limits);
  const now = ctx.now();
  const closed = joinWindow({ now, arr: row.arr, limits });
  if (closed) return fail(joinMessage(closed, limits));
  return {
    union: row.id,
    arr: row.arr,
    pct: flightTo(ctx, row.arr, at, limits),
  };
}

/**
 * Refuses a player who may not bring one more fleet: he must be an ally of
 * the leader unless he is in the union already, and the invitation and the
 * limits of fleets and players must allow it.
 */
function mayJoin(
  ctx: Ctx,
  uid: string,
  union: LiveUnion,
  limits: UnionLimits,
): void {
  const facts = factsOf(ctx, union);
  if (!facts.owners.includes(uid) && !isAllyOf(ctx, facts.leader, uid))
    fail(notAlly(ctx, 'join'));
  const refused = joinLimitError(facts, uid, limits);
  if (refused) fail(joinMessage(refused, limits));
}

/**
 * Puts the new fleet into the union before it is saved; the fleet the
 * leader planned it with leads it (#466, A1a).
 */
export function joinUnion(plan: JoinPlan | null, fleet: Fleet): void {
  if (plan) fleet.union = plan.union;
}

/**
 * The fleets that turn back when `f` is recalled (#225): a fleet of a union
 * leaves it and turns back alone (a participant's recall, [V]); the leader's
 * own fleet, which opened the union, ends it, and every fleet of it turns
 * back (owner, 2026-11-16, Q2). The owner of each of those fleets other than
 * the leader gets an info report.
 */
export function recalledWith(ctx: Ctx, f: Fleet): Fleet[] {
  if (f.union === undefined) return [f];
  const row = ctx.unions.get(f.union);
  const leads = row?.lead === f.id;
  const all = leads ? ctx.fleets.ofUnion(f.union) : [f];
  for (const m of all) {
    ctx.fleets.setUnion(m.id, null);
    delete m.union;
  }
  if (leads) ctx.unions.delete(row.id);
  for (const m of all)
    if (m.owner !== f.owner) dissolvedReport(ctx, m, ctx.now(), RECALLED);
  return all;
}

/** Why a union is dissolved, in the report to each member: the leader's recall or abort (Q2). */
export const RECALLED = (at: string): string =>
  `Der Anführer hat den Angriffsverband auf ${at} zurückgerufen. Deine Flotte kehrt um.`;

/** The report to the owner of a fleet whose union is dissolved, with `why` at its coordinates. */
export function dissolvedReport(
  ctx: Ctx,
  m: Fleet,
  time: number,
  why: (at: string) => string,
): void {
  addReport(
    ctx,
    m.owner,
    {
      time,
      type: 'info',
      title: `Angriffsverband aufgelöst ${coords(m.toC)}`,
      text: why(coords(m.toC)),
    },
    { topic: 'fleet' },
  );
}

/** What the arrival of a fleet of a union has: the leader's fleet leading the battle and the others. */
export interface Arriving {
  lead: Fleet;
  rest: Fleet[];
}

/**
 * The union a fleet arrives with, all fleets at once (#225): the fleet that
 * opened it leads the battle and the others follow it in the order they
 * joined. The union is over from here: the fleets leave it and the
 * invitations go. A fleet whose union is gone (its leader's fleet no longer
 * exists) arrives alone.
 */
export function arriving(ctx: Ctx, f: Fleet): Arriving | null {
  if (f.union === undefined) return null;
  const all = ctx.fleets.ofUnion(f.union);
  for (const m of all) ctx.fleets.setUnion(m.id, null);
  // The row and the invitations go; the invitations of a fleet whose union
  // has no row (its leading fleet was gone before #466) too.
  ctx.unions.delete(f.union);
  // The leader's fleet leads, the one he planned the union with: its ID is
  // the union's (`lead`, #466). A union whose leading fleet is gone arrives
  // as single fleets, as before.
  const lead = all.find((m) => m.id === f.union);
  return lead ? { lead, rest: all.filter((m) => m !== lead) } : null;
}

/** A union as a player in it, or invited to it, sees it: the shape of the state (#225, #478). */
export type UnionView = UnionState;

/**
 * The unions `uid` leads, flies in or is invited to (the defender sees
 * every fleet as before, not the union, [V]).
 */
export function unionsFor(ctx: Ctx, uid: string): UnionView[] {
  // A player in a union is its leader or was invited to it: the
  // invitation stays when he joins.
  const ids = new Set([...ctx.fleets.invitedTo(uid), ...ctx.unions.ledBy(uid)]);
  const views: UnionView[] = [];
  for (const id of ids) {
    const union = unionOf(ctx, id);
    if (!union) continue;
    const { row } = union;
    views.push({
      id,
      leader: row.leader,
      to: row.target,
      toC: row.toC,
      arr: row.arr,
      ...(row.start && { start: row.start.at }),
      ...(row.start &&
        row.leader === uid && {
          held: { from: row.start.from, ships: row.start.ships },
        }),
      fleets: union.fleets.map((f) => ({ id: f.id, owner: f.owner })),
      // Whoever has joined is no longer „invited“.
      invited: ctx.fleets
        .invited(id)
        .filter((i) => !union.fleets.some((f) => f.owner === i)),
    });
  }
  return views.sort((a, b) => a.arr - b.arr || a.id.localeCompare(b.id));
}

export const serverFeature = {
  actions: { inviteUnion },
  state: {
    order: 210,
    keys: ['unions'],
    build: (ctx, u) => ({ unions: unionsFor(ctx, u.id) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
