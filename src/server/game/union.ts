// The attack union („Verbandsangriff“, #225, okf/features/holding-acs.md) on
// the server: opening a union from an own Sturmangriff on its way, inviting
// allies, joining with a fleet (the action `send` asks `joinPlan`), the
// recall of a fleet of a union and the arrival of all fleets at once. The
// rules (limits, timing, the split of the loot) are the pure ones of
// src/core/union.ts; here the facts are gathered and the codes worded. A
// union is the fleets that carry its ID (`fleets.union_id`); its ID is the ID
// of the fleet that opened it, whose owner leads it, and it ends at the
// arrival or when the leader recalls that fleet.
import { ALLIES } from '../../core/holding.ts';
import {
  type FoundError,
  type UnionFacts,
  type UnionLimits,
  foundError,
  inviteLimitError,
  joinLimitError,
  joinMessage,
  joinTiming,
} from '../../core/union.ts';
import type { Coords, Fleet } from '../../core/types.ts';
import type { Action } from './actions.ts';
import { addReport, coords, fail, str, type Ctx } from './context.ts';
import { isAllyOf } from './holding.ts';
import { roundRules } from './round.ts';
import type { ServerFeature } from './feature.ts';

/** The limits and the timing rules of the round (owner, 2026-11-16, D3; 2026-11-17). */
export const limitsOf = (ctx: Ctx): UnionLimits => {
  const r = roundRules(ctx);
  return {
    fleets: r.unionFleets,
    players: r.unionPlayers,
    delay: r.unionDelay,
    cutoff: r.unionCutoff,
  };
};

/** The union with the ID `id` as long as it is alive: its leader's fleet is on its way out. */
export function unionOf(
  ctx: Ctx,
  id: unknown,
): { id: string; founder: Fleet; fleets: Fleet[] } | null {
  if (typeof id !== 'string') return null;
  const founder = ctx.fleets.get(id);
  if (!founder || founder.union !== id || founder.state !== 'out') return null;
  return { id, founder, fleets: ctx.fleets.ofUnion(id) };
}

/** What a joining fleet meets of the union. */
const factsOf = (
  ctx: Ctx,
  union: { id: string; founder: Fleet; fleets: Fleet[] },
): UnionFacts => ({
  leader: union.founder.owner,
  owners: union.fleets.map((f) => f.owner),
  invited: ctx.fleets.invited(union.id),
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

/** Opens an attack union with the own Sturmangriff `d.id` on its way. */
const openUnion: Action = (ctx, u, d) => {
  const f = ctx.fleets.get(String(d.id));
  if (!f || f.owner !== u.id) return fail('Diese Flotte gibt es nicht.');
  const error = foundError(f, ctx.now(), f.union !== undefined);
  if (error) return fail(FOUND_ERROR[error]);
  ctx.fleets.setUnion(f.id, f.id);
  return `Angriffsverband für ${coords(f.toC)} eröffnet.`;
};

/** The leader invites the player `d.name` to the union `d.id`. */
const inviteUnion: Action = (ctx, u, d) => {
  const union = unionOf(ctx, d.id);
  if (!union) return fail(GONE);
  const { founder } = union;
  if (founder.owner !== u.id)
    return fail('Nur der Anführer lädt zum Angriffsverband ein.');
  const invitee = ctx.players.byName(str(d.name, 20));
  if (!invitee) return fail('Spieler nicht gefunden.');
  if (invitee.id === u.id) return fail('Das bist du selbst.');
  if (ctx.planets.get(founder.to)?.owner === invitee.id)
    return fail('Der Verteidiger kann nicht eingeladen werden.');
  if (!isAllyOf(ctx, u.id, invitee.id)) return fail(notAlly(ctx, 'invite'));
  const limits = limitsOf(ctx);
  if (inviteLimitError(factsOf(ctx, union), invitee.id, limits))
    return fail(
      `Am Angriffsverband können höchstens ${limits.players} Spieler teilnehmen.`,
    );
  ctx.fleets.invite(union.id, invitee.id);
  addReport(
    ctx,
    invitee.id,
    {
      time: ctx.now(),
      type: 'info',
      title: `Einladung zum Verbandsangriff ${coords(founder.toC)}`,
      text: `${u.name} lädt dich zu einem Verbandsangriff auf ${coords(founder.toC)} ein.`,
    },
    { topic: 'fleet' },
  );
  return `Einladung an ${invitee.name} gesendet.`;
};

/** A fleet that joins a union: the union and the arrival all its fleets get. */
export interface JoinPlan {
  union: string;
  arr: number;
  /** How much later than before the union arrives, 0 when the fleet is there in time. */
  delay: number;
}

/**
 * The checks of a fleet of `uid` that joins the union `id` with a Sturmangriff
 * to `to` and a flight of `flight` milliseconds, before anything is spent:
 * the union is alive and flies to that place, the player is an ally of the
 * leader and invited (the leader and every player already in need no
 * invitation), the limits of fleets and players, and the timing. Returns
 * the arrival all fleets of the union get.
 */
export function joinPlan(
  ctx: Ctx,
  uid: string,
  id: unknown,
  at: { mission: string; to: string; toC: Coords; flight: number },
): JoinPlan | null {
  // A fleet of no union: the form sends no union, or an empty one.
  if (id === undefined || id === null || id === '') return null;
  const union = unionOf(ctx, id);
  if (!union) return fail(GONE);
  const { founder } = union;
  if (at.mission !== 'attack')
    return fail(
      'Einem Angriffsverband schließt man sich mit einem Sturmangriff an.',
    );
  if (at.to !== founder.to)
    return fail(`Der Angriffsverband fliegt nach ${coords(founder.toC)}.`);
  const limits = limitsOf(ctx);
  mayJoin(ctx, uid, union, limits);
  const timing = joinTiming({
    now: ctx.now(),
    arr: founder.arr,
    flight: at.flight,
    limits,
  });
  if ('error' in timing) return fail(joinMessage(timing.error, limits));
  return { union: union.id, arr: timing.arr, delay: timing.arr - founder.arr };
}

/**
 * Refuses a player who may not bring one more fleet: he must be an ally of
 * the leader unless he is in the union already, and the invitation and the
 * limits of fleets and players must allow it.
 */
function mayJoin(
  ctx: Ctx,
  uid: string,
  union: { id: string; founder: Fleet; fleets: Fleet[] },
  limits: UnionLimits,
): void {
  const facts = factsOf(ctx, union);
  if (!facts.owners.includes(uid) && !isAllyOf(ctx, facts.leader, uid))
    fail(notAlly(ctx, 'join'));
  const refused = joinLimitError(facts, uid, limits);
  if (refused) fail(joinMessage(refused, limits));
}

/** Puts the new fleet into the union before it is saved: a later arrival moves the others. */
export function joinUnion(ctx: Ctx, plan: JoinPlan | null, fleet: Fleet): void {
  if (!plan) return;
  if (plan.delay > 0) ctx.fleets.delayUnion(plan.union, plan.delay);
  fleet.union = plan.union;
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
  const all = f.union === f.id ? ctx.fleets.ofUnion(f.id) : [f];
  for (const m of all) {
    ctx.fleets.setUnion(m.id, null);
    delete m.union;
  }
  ctx.fleets.dropInvites(f.id);
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
  return all.length ? all : [f];
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
  const lead = all.find((m) => m.id === f.union);
  ctx.fleets.dropInvites(f.union);
  for (const m of all) ctx.fleets.setUnion(m.id, null);
  if (!lead) return null;
  return { lead, rest: all.filter((m) => m.id !== lead.id) };
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
  const ids = new Set(ctx.fleets.invitedTo(uid));
  for (const f of ctx.fleets.all())
    if (f.owner === uid && f.union !== undefined) ids.add(f.union);
  const views: UnionView[] = [];
  for (const id of ids) {
    const union = unionOf(ctx, id);
    if (!union) continue;
    const { founder } = union;
    views.push({
      id,
      leader: founder.owner,
      to: founder.to,
      toC: founder.toC,
      arr: founder.arr,
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
    order: 200,
    keys: ['unions'],
    build: (ctx, u) => ({ unions: unionsFor(ctx, u.id) }),
  },
} satisfies ServerFeature;
