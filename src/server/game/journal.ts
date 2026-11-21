// The journal of the round (#235, owner 2026-11-20): central capture at the two
// entry points of the game. `runAction` (dispatch.ts) writes one event per
// action, `tick` (arrival.ts) one per arrival, Halten end and return, each in
// the transaction of the change it records, so the event can neither be lost
// nor doubled; a refused action rolls its transaction back and is written in
// a transaction of its own. No feature file calls it: a new action or mission
// is recorded as it is. The journal changes nothing in the game: it reads the
// state, never uses the random generator or the clock, and a failure to write
// is logged and swallowed. A closed round, or one without an active row, takes
// no event (round-events.ts).
//
// What a cause produced is derived where the game commits it: a saved place
// is settled once more from its stored state to the saved time (the same pure
// function the game used), so every span of production, every finished
// building and every finished unit is recorded exactly once, at the save that
// advanced the place, whatever settled it before (a read that settles and
// saves nothing records nothing). The reports written are noted the same way.
import { prod } from '../../core/economy.ts';
import {
  EVENT_KIND,
  type JournalAction,
  type JournalBattle,
  type JournalClose,
  type JournalFleet,
  type JournalReport,
  type PlaceChanged,
  type Produced,
  researchFinished,
  unitsPaid,
} from '../../core/round-events.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import type { Repositories } from '../db/repos/index.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import { hiddenTexts, inputOf } from './journal-input.ts';
import { seatOf, writeRoundEvent } from './round-events.ts';

/** An event of its own that a cause noticed: a research that finished, a place that came or went. */
interface Fact {
  kind: string;
  seat: number | null;
  at: number;
  payload: Record<string, unknown>;
}

/** What the running cause has seen so far; null outside an action or an arrival. */
interface Cause {
  /** The logical time of the cause: the clock for an action, the due time of a fleet. */
  at: number | null;
  prod: Produced[];
  reports: JournalReport[];
  facts: Fact[];
  battle?: JournalBattle;
}
let active: Cause | null = null;

const fresh = (at: number | null): Cause => ({
  at,
  prod: [],
  reports: [],
  facts: [],
});

/**
 * Starts collecting what the next action or arrival produces. `at` is the
 * logical time of an arrival (its due time); an action has none and runs now.
 */
export function beginCause(at: number | null = null): void {
  active = fresh(at);
}

/** Forgets the running cause (the transaction rolled back or an error ended it). */
export function dropCause(): void {
  active = null;
}

/**
 * Whether a cause is still collecting: after an action or an arrival has
 * ended, written or failed, none may be left, or what a failed transaction
 * noted would hang on in memory (read by the guard tests).
 */
export const causePending = (): boolean => active !== null;

const take = (): Cause => {
  const c = active ?? fresh(null);
  active = null;
  return c;
};

/** Writes what a cause noticed as events of their own, each with the cause that led to it. */
function writeFacts(ctx: Ctx, cause: Cause, name: string): void {
  for (const f of cause.facts)
    writeRoundEvent(ctx, f.kind, f.seat, { ...f.payload, cause: name }, f.at);
}

/** The journal must never break the game: a failed write is logged and the game goes on. */
function safely(write: () => void): void {
  try {
    write();
  } catch (e) {
    console.error('Journal of the round: an event was not written', e);
  }
}

const two = (n: number): number => Math.round(n * 100) / 100;

/** The seat of an account: its own, or a new one when it holds a place; null for an account that holds nothing. */
const seatOfAccount = seatOf;

/** The levels of `now` above those of `before`: what was added. */
function added(before: Levels, now: Levels): Levels {
  const out: Levels = {};
  for (const [k, n] of Object.entries(now)) {
    const more = n - (before[k] ?? 0);
    if (more > 0) out[k] = more;
  }
  return out;
}

/** The building that finished between the stored state and the settled one, if any. */
function finishedBuilding(prev: Planet, s: Planet): Produced['built'] {
  const q = prev.bq;
  // The settlement only ever ends a queue: one that is still there has not finished.
  if (!q || s.bq) return undefined;
  return {
    key: q.key,
    lvl: q.lvl,
    end: q.end,
    cost: q.cost,
    ...(q.back && { back: q.back }),
  };
}

/** What the settlement from the stored state `prev` to the saved time produced, or null when nothing. */
function producedBy(ctx: Ctx, prev: Planet, next: Planet): Produced | null {
  const u = ctx.admin.universe();
  const owner = ctx.players.get(prev.owner);
  const s = settle(prev, next.t, u, owner);
  const credit = {
    m: two(s.res.m - prev.res.m),
    c: two(s.res.c - prev.res.c),
    d: two(s.res.d - prev.res.d),
  };
  const built = finishedBuilding(prev, s);
  const ships = added(prev.ships, s.ships);
  const defense = added(prev.def, s.def);
  const units = { ...ships, ...defense };
  const paid = unitsPaid(ships, defense);
  const credited = credit.m || credit.c || credit.d;
  if (!credited && !built && !Object.keys(units).length) return null;
  const research = owner ? settleR(owner, prev.t).research : {};
  return {
    place: prev.id,
    owner: seatOfAccount(ctx, prev.owner),
    from: prev.t,
    to: next.t,
    ...credit,
    f: Math.round(prod(prev, u, research).f * 1000) / 1000,
    ...(built && { built }),
    ...(Object.keys(units).length && { units }),
    ...(paid && { unitsCost: paid }),
  };
}

/**
 * Called by the planet repository before a place is saved (`journaled`
 * below): when the save advances the place in time, what the span produced
 * joins the running cause.
 */
function noteSave(ctx: Ctx, prev: Planet | null, next: Planet): void {
  if (!active || !prev || next.t <= prev.t) return;
  safely(() => {
    const made = producedBy(ctx, prev, next);
    if (made) active!.prod.push(made);
  });
}

/** The logical time of the running cause: a fleet's due time, else now. */
const causeTime = (ctx: Ctx): number => active?.at ?? ctx.now();

/** A colony or a moon that came into being, or one that is gone, joins the running cause. */
function notePlace(ctx: Ctx, kind: string, place: Planet): void {
  if (!active) return;
  safely(() => {
    active!.facts.push({
      kind,
      seat: seatOfAccount(ctx, place.owner),
      at: causeTime(ctx),
      payload: {
        place: place.id,
        kind: place.kind,
        g: place.g,
        s: place.s,
        p: place.p,
      } satisfies Omit<PlaceChanged, 'cause'>,
    });
  });
}

/**
 * A new place is a creation unless it is the first place of its owner: that
 * one is their joining (`participant.joined`, the home planet of a new round).
 */
const isCreation = (repos: Repositories, next: Planet): boolean =>
  next.kind === 'moon' || repos.planets.ofOwner(next.owner).length > 0;

/** A research that finished with a save of the player joins the running cause. */
function noteResearch(ctx: Ctx, prev: User | null, next: User): void {
  if (!active || !prev) return;
  safely(() => {
    const done = researchFinished(prev, next, causeTime(ctx));
    if (done)
      active!.facts.push({
        kind: EVENT_KIND.research,
        seat: seatOfAccount(ctx, next.id),
        at: done.end,
        payload: done,
      });
  });
}

/** The facts of a battle report that are numbers: no name, no text. */
function battleOf(report: Record<string, unknown>): JournalBattle {
  const out: Record<string, unknown> = {};
  for (const k of [
    'rounds',
    'winner',
    'attBefore',
    'attAfter',
    'defBefore',
    'defAfter',
    'rebuilt',
    'loot',
    'debris',
  ])
    if (report[k] !== undefined) out[k] = report[k];
  return out as JournalBattle;
}

function noteReport(ctx: Ctx, uid: string, report: Record<string, unknown>) {
  if (!active) return;
  safely(() => {
    const type = String(report.type);
    active!.reports.push({
      id: String(report.id),
      type,
      to: seatOfAccount(ctx, uid),
    });
    // The attacker's and the defender's report are one battle: counted once.
    if (type === 'battle' && !active!.battle) active!.battle = battleOf(report);
  });
}

/**
 * The places and the reports of a context as the journal wants them: the same
 * objects with `save` of the places and `add` of the reports noting what they
 * commit to the running cause. Only the two methods differ.
 */
export function journaled(
  ctx: Ctx,
  repos: Repositories,
): Pick<Repositories, 'planets' | 'reports' | 'players'> {
  // Plain assignments, so a test can still spy on `save` and `add`.
  const planets = Object.create(repos.planets) as Repositories['planets'];
  planets.save = (next: Planet): void => {
    if (active) {
      const prev = repos.planets.get(next.id);
      noteSave(ctx, prev, next);
      if (!prev && isCreation(repos, next))
        notePlace(ctx, EVENT_KIND.created, next);
    }
    repos.planets.save(next);
  };
  planets.delete = (id: string): void => {
    const prev = active ? repos.planets.get(id) : null;
    if (prev) {
      // What the place produced up to its end still counts.
      noteSave(ctx, prev, { ...prev, t: causeTime(ctx) });
      notePlace(ctx, EVENT_KIND.removed, prev);
    }
    repos.planets.delete(id);
  };
  const players = Object.create(repos.players) as Repositories['players'];
  players.save = (next: User): void => {
    if (active) noteResearch(ctx, repos.players.get(next.id), next);
    repos.players.save(next);
  };
  const reports = Object.create(repos.reports) as Repositories['reports'];
  reports.add = (uid, report, keep): void => {
    repos.reports.add(uid, report, keep);
    noteReport(ctx, uid, report);
  };
  return { planets, reports, players };
}

/**
 * The part of the message a refusal may keep: it never quotes a text the
 * player typed, and no account name (a refusal such as „Anna hat dir bereits
 * eine Anfrage geschickt“ would break the pseudonym of a deleted account).
 */
function scrubbed(
  ctx: Ctx,
  message: string,
  d: Record<string, unknown>,
  type: string,
): string {
  const names = ctx.players.all().map((p) => p.name);
  let out = message;
  for (const text of [...hiddenTexts(type, d), ...names])
    if (text.length >= 2) out = out.split(text).join('…');
  return out.slice(0, 200);
}

/**
 * Writes the event of an action that succeeded, in its transaction: the
 * cause, the input as the allow-list keeps it, and what the places it saved
 * produced and the reports it wrote.
 */
export function journalAction(
  ctx: Ctx,
  u: User,
  type: string,
  d: Record<string, unknown>,
): void {
  const cause = take();
  safely(() =>
    writeRoundEvent(ctx, EVENT_KIND.action, seatOfAccount(ctx, u.id), {
      cause: type,
      input: inputOf(ctx, (id) => seatOfAccount(ctx, id), type, d),
      ok: true,
      ...(cause.prod.length && { prod: cause.prod }),
      ...(cause.reports.length && { reports: cause.reports }),
    } satisfies JournalAction),
  );
  safely(() => writeFacts(ctx, cause, type));
}

/**
 * Writes the event of a refused action, after its transaction rolled back, in
 * a transaction of its own: what the player asked and the refusal they saw.
 * Not recorded for a request without a known account.
 */
export function journalRefusal(
  ctx: Ctx,
  uid: string,
  type: string,
  d: Record<string, unknown>,
  message: string,
): void {
  dropCause();
  safely(() =>
    ctx.tx(() => {
      if (!ctx.players.get(uid)) return;
      writeRoundEvent(ctx, EVENT_KIND.action, seatOfAccount(ctx, uid), {
        cause: type,
        input: inputOf(ctx, (id) => seatOfAccount(ctx, id), type, d),
        ok: false,
        msg: scrubbed(ctx, message, d, type),
      } satisfies JournalAction);
    }),
  );
}

/** What became of a fleet after its arrival, return or end of holding. */
const fateOf = (ctx: Ctx, id: string): JournalFleet['fate'] => {
  const now = ctx.fleets.get(id);
  if (!now) return 'gone';
  return now.state === 'back' ? 'back' : now.state === 'hold' ? 'hold' : 'out';
};

/** What `tick` knows before it hands a fleet to its mission: the ships, the cargo and the owner of the target. */
export interface FleetBefore {
  ships: Levels;
  cargo: Fleet['cargo'];
  target: string | null;
}

export const fleetBefore = (ctx: Ctx, f: Fleet): FleetBefore => ({
  ships: { ...f.ships },
  cargo: { ...f.cargo },
  target: ctx.planets.get(f.to)?.owner ?? null,
});

/**
 * Writes the event of one fleet that arrived, ended its holding or came home,
 * in the transaction of `tick`, at the logical time `at`. The seat is the
 * owner of the fleet; the reports written are listed by id (the battle report
 * holds the losses, the loot and the debris, the event keeps one copy of those
 * numbers).
 */
export function journalFleet(
  ctx: Ctx,
  kind:
    | typeof EVENT_KIND.arrival
    | typeof EVENT_KIND.hold
    | typeof EVENT_KIND.return,
  f: Fleet,
  at: number,
  before: FleetBefore,
): void {
  const cause = take();
  safely(() =>
    writeRoundEvent(
      ctx,
      kind,
      seatOfAccount(ctx, f.owner),
      {
        cause: kind.slice('journal.'.length),
        mission: f.mission,
        fleet: f.id,
        from: f.from,
        to: f.to,
        target: before.target ? seatOfAccount(ctx, before.target) : null,
        ships: before.ships,
        cargo: before.cargo,
        fate: fateOf(ctx, f.id),
        ...(f.gift && { gift: true as const }),
        ...(cause.battle && { battle: cause.battle }),
        ...(cause.prod.length && { prod: cause.prod }),
        ...(cause.reports.length && { reports: cause.reports }),
      } satisfies JournalFleet,
      at,
    ),
  );
  safely(() => writeFacts(ctx, cause, kind.slice('journal.'.length)));
}

/**
 * Settles every place and every finished research up to the cutoff of a
 * closing round and writes what that produced as `journal.close` (version 2).
 * Without it the span from the last save of a place to the cutoff would be
 * missing from the journal. The settled state is the one the game reads at
 * that time anyway (the same pure function), so nothing changes in the game.
 * It is written even when it produced nothing: it marks a journal that was
 * closed with its last spans. The cause that is collecting (the action that
 * closes) is kept as it was.
 */
export function journalClose(ctx: Ctx, cutoff: number): void {
  const outer = active;
  active = fresh(cutoff);
  safely(() => {
    const u = ctx.admin.universe();
    for (const place of ctx.planets.all())
      ctx.planets.save(settle(place, cutoff, u, ctx.players.get(place.owner)));
    for (const player of ctx.players.all()) {
      if (!player.rq || player.rq.end > cutoff) continue;
      const r = settleR(player, cutoff);
      player.research = r.research;
      player.rq = r.rq;
      ctx.players.save(player);
    }
  });
  const cause = take();
  active = outer;
  safely(() => {
    writeRoundEvent(
      ctx,
      EVENT_KIND.close,
      null,
      {
        cause: 'close',
        ...(cause.prod.length && { prod: cause.prod }),
      } satisfies JournalClose,
      cutoff,
    );
    writeFacts(ctx, cause, 'close');
  });
}
