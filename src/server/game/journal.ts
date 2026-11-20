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
  type JournalFleet,
  type JournalReport,
  type Produced,
} from '../../core/round-events.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import type { Repositories } from '../db/repos/index.ts';
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import { hiddenTexts, inputOf } from './journal-input.ts';
import { seatOf, writeRoundEvent } from './round-events.ts';

/** What the running cause has seen so far; null outside an action or an arrival. */
interface Cause {
  prod: Produced[];
  reports: JournalReport[];
  battle?: JournalBattle;
}
let active: Cause | null = null;

/** Starts collecting what the next action or arrival produces. */
export function beginCause(): void {
  active = { prod: [], reports: [] };
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
  const c = active ?? { prod: [], reports: [] };
  active = null;
  return c;
};

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
  if (!q || (s.bq && s.bq.start === q.start && s.bq.key === q.key))
    return undefined;
  return { key: q.key, lvl: q.lvl, end: q.end, cost: q.cost };
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
  const units = { ...added(prev.ships, s.ships), ...added(prev.def, s.def) };
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
): Pick<Repositories, 'planets' | 'reports'> {
  // Plain assignments, so a test can still spy on `save` and `add`.
  const planets = Object.create(repos.planets) as Repositories['planets'];
  planets.save = (next: Planet): void => {
    if (active) noteSave(ctx, repos.planets.get(next.id), next);
    repos.planets.save(next);
  };
  const reports = Object.create(repos.reports) as Repositories['reports'];
  reports.add = (uid, report, keep): void => {
    repos.reports.add(uid, report, keep);
    noteReport(ctx, uid, report);
  };
  return { planets, reports };
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
        ...(cause.battle && { battle: cause.battle }),
        ...(cause.prod.length && { prod: cause.prod }),
        ...(cause.reports.length && { reports: cause.reports }),
      } satisfies JournalFleet,
      at,
    ),
  );
}
