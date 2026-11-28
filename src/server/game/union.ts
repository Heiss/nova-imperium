// The attack union („Verbandsangriff“, #225, #466, okf/features/holding-acs.md)
// on the server: opening a union from an own Sturmangriff on its way,
// inviting allies, joining with a fleet that arrives at the fixed arrival X
// (the action `send` asks `joinPlan`), the recall of a fleet of a union and
// the arrival of all fleets at once. The rules (limits, the window, the
// speed, the split of the loot) are the pure ones of src/core/union.ts; here
// the facts are gathered and the codes worded. A union is a row of
// `attack_unions` (leader, target, X, the leader's fleet that leads it) and
// the fleets that carry its ID (`fleets.union_id`); it ends at X, or when
// the leader recalls the fleet that leads it (owner, 2026-11-16, Q2).
import { ALLIES } from '../../core/holding.ts';
import {
  type FoundError,
  type UnionFacts,
  type UnionLimits,
  foundError,
  inviteLimitError,
  joinLimitError,
  joinMessage,
  joinWindow,
  UNION_OFF_REFUSAL,
  unionFlight,
  unionOpen,
} from '../../core/union.ts';
import type { Union } from '../db/repos/unions.ts';
import type { Coords, Fleet } from '../../core/types.ts';
import type { Handler } from './actions.ts';
import { addReport, coords, fail, str, universe, type Ctx } from './context.ts';
import { isAllyOf } from './holding.ts';
import { roundRules } from './round.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape } from '../../core/state/union.ts';

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

/** The union with the ID `id` as long as it is alive: it has a row and has not arrived (#466). */
export function unionOf(ctx: Ctx, id: unknown): LiveUnion | null {
  if (typeof id !== 'string') return null;
  const row = ctx.unions.get(id);
  if (!row || row.arr <= ctx.now()) return null;
  return { row, fleets: fleetsOf(ctx, row) };
}

/** What a joining fleet meets of the union. */
const factsOf = (ctx: Ctx, union: LiveUnion): UnionFacts => ({
  leader: union.row.leader,
  // The leader first, though he may have sent no fleet yet.
  owners: union.fleets.map((f) => f.owner),
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
const startText = (t: number): string =>
  new Date(Math.ceil(t / 1000) * 1000).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const FOUND_ERROR: Readonly<Record<FoundError, string>> = {
  notAttack: 'Einen Angriffsverband eröffnet nur ein Sturmangriff.',
  notOut: 'Diese Flotte ist nicht mehr auf dem Weg zum Ziel.',
  started: 'Diese Flotte ist schon beim Ziel angekommen.',
  inUnion: 'Diese Flotte gehört schon zu einem Angriffsverband.',
};

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

/**
 * Opens an attack union with the own Sturmangriff `d.id` on its way: its
 * arrival is X, and the fleet leads it.
 */
const openUnion: Handler<'openUnion'> = (ctx, u, d) => {
  switchedOn(ctx);
  const f = ctx.fleets.get(String(d.id));
  if (!f || f.owner !== u.id) return fail('Diese Flotte gibt es nicht.');
  const error = foundError(f, ctx.now(), f.union !== undefined);
  if (error) return fail(FOUND_ERROR[error]);
  ctx.unions.save({
    id: f.id,
    leader: u.id,
    lead: f.id,
    target: f.to,
    toC: f.toC,
    arr: f.arr,
  });
  ctx.fleets.setUnion(f.id, f.id);
  return `Angriffsverband für ${coords(f.toC)} eröffnet.`;
};

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
  const flight = unionFlight({
    dist: at.dist,
    speed: at.speed,
    universe: universe(ctx),
    now,
    arr: row.arr,
  });
  if ('error' in flight)
    return fail(
      joinMessage(
        flight.error,
        limits,
        flight.error === 'early' ? `am ${startText(flight.earliest)}` : '',
      ),
    );
  return { union: row.id, arr: row.arr, pct: flight.pct };
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
 * Puts the new fleet into the union before it is saved. The first fleet of
 * the leader leads the union from then on, if none does yet.
 */
export function joinUnion(ctx: Ctx, plan: JoinPlan | null, fleet: Fleet): void {
  if (!plan) return;
  fleet.union = plan.union;
  const row = ctx.unions.get(plan.union)!;
  if (row.lead === undefined && row.leader === fleet.owner)
    ctx.unions.save({ ...row, lead: fleet.id });
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
    if (m.owner !== f.owner)
      addReport(
        ctx,
        m.owner,
        {
          time: ctx.now(),
          type: 'info',
          title: `Angriffsverband aufgelöst ${coords(m.toC)}`,
          text: `Der Anführer hat den Angriffsverband auf ${coords(m.toC)} zurückgerufen. Deine Flotte kehrt um.`,
        },
        { topic: 'fleet' },
      );
  return all;
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
  const row = ctx.unions.get(f.union);
  const all = ctx.fleets.ofUnion(f.union);
  ctx.fleets.dropInvites(f.union);
  for (const m of all) ctx.fleets.setUnion(m.id, null);
  // A fleet of a union without a row (its leading fleet was gone before
  // #466) arrives alone, as before.
  if (!row) return null;
  ctx.unions.delete(row.id);
  // The leader's fleet leads; a union he sent none to is led by the first
  // fleet that joined.
  const lead = all.find((m) => m.id === row.lead) ?? all[0];
  return lead ? { lead, rest: all.filter((m) => m !== lead) } : null;
}

/** A union as a player in it, or invited to it, sees it. */
export interface UnionView {
  id: string;
  leader: string;
  to: string;
  toC: Coords;
  arr: number;
  /** Its fleets with their owners, the leader's first; the ships stay hidden. */
  fleets: { id: string; owner: string }[];
  /** The players invited who have not joined. */
  invited: string[];
}

/**
 * The unions `uid` leads, flies in or is invited to (the defender sees
 * every fleet as before, not the union, [V]).
 */
export function unionsFor(ctx: Ctx, uid: string): UnionView[] {
  const ids = new Set([...ctx.fleets.invitedTo(uid), ...ctx.unions.ledBy(uid)]);
  for (const f of ctx.fleets.all())
    if (f.owner === uid && f.union !== undefined) ids.add(f.union);
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
  actions: { openUnion, inviteUnion },
  state: {
    order: 210,
    keys: ['unions'],
    build: (ctx, u) => ({ unions: unionsFor(ctx, u.id) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
