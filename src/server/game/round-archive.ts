// The archive of a round (#235): what is written when a round ends, and the
// admin actions „Runde abschließen“ and „Runde löschen“. A round is closed
// by the admin or, at the latest, by „Neue Runde“ itself (D1, owner,
// 2026-11-17): the reset closes the running round first, in its own
// transaction, so a failed archive refuses the reset and nothing is lost
// ([V]: the issue says an incomplete event archive prevents the destructive
// reset). The close fixes the cutoff at the server time of the request; the
// due fleets were settled by `tick` before the action, so every outcome up to
// the cutoff is committed. It writes the events of the round (`player.final`
// per participant, `guild.final` per guild, `round.closed`), no totals: the
// report derives its numbers on read (okf/features/round-archive.md).
import { production } from '../../core/economy.ts';
import { ENDZEIT_EVENT } from '../../core/round-events.ts';
import {
  type FinalPlace,
  type MeasuredInterval,
  type PlayerPlaytime,
  playtimePayload,
  type GuildFinal,
  type PlayerFinal,
  type Valuation,
  type RoundClosed,
} from '../../core/round-report.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Levels, Planet, Resources } from '../../core/types.ts';
import type { RoundRow } from '../db/repos/rounds.ts';
import type { User } from '../db/repos/players.ts';
import { type Ctx, fail, universe } from './context.ts';
import { journalClose } from './journal.ts';
import { categoryModes } from '../../core/highscore-categories.ts';
import { scorePass } from './scores.ts';
import { roundRules, roundStart } from './round.ts';

/** The kinds of the events of the round that this file writes. */
export const ROUND_EVENT = {
  started: 'round.started',
  player: 'player.final',
  guild: 'guild.final',
  /** The accepted play time of one participant in the round (#232, D2): merged intervals, no total. */
  playtime: 'player.playtime',
  closed: 'round.closed',
  /** An admin intervention the history must annotate (issue #235, section 3): the settings and the Endzeit. */
  settings: 'admin.settings',
  endzeit: ENDZEIT_EVENT,
} as const;

/** What a round holds at one moment: its participants and guilds, by seat. */
export interface RoundFacts {
  players: { seat: number; user: User; final: PlayerFinal }[];
  guilds: (GuildFinal & { id: string })[];
}

/** The levels with a value above 0, so an archived place holds only what stood there. */
const standing = (levels: Levels): Levels =>
  Object.fromEntries(Object.entries(levels).filter(([, n]) => n > 0));

const addTo = (to: Levels, from: Levels): void => {
  for (const [k, n] of Object.entries(from)) to[k] = (to[k] ?? 0) + n;
};

/** What one account holds at `now`: the raw state of its places and its valuation. */
function finalOf(
  ctx: Ctx,
  user: User,
  own: readonly Planet[],
  valuation: Valuation,
): PlayerFinal {
  const now = ctx.now();
  const u = universe(ctx);
  const research = settleR(user, now).research;
  const economy: Resources = { m: 0, c: 0, d: 0 };
  const places: FinalPlace[] = own.map((p) => {
    const s = settle(p, now, u, user);
    const rate = production(s, u, research);
    economy.m += rate.m;
    economy.c += rate.c;
    economy.d += rate.d;
    return {
      kind: s.kind,
      g: s.g,
      s: s.s,
      p: s.p,
      b: standing(s.b),
      ships: standing(s.ships),
      def: standing(s.def),
    };
  });
  const flying: Levels = {};
  for (const f of ctx.fleets.all())
    if (f.owner === user.id) addTo(flying, f.ships);
  return {
    valuation,
    economy,
    research: standing(research),
    places,
    flying: standing(flying),
    vacation: user.vacation !== null,
  };
}

/**
 * Every participant and guild as the game stands now: a participant is an
 * account with at least one planet or moon ([V]). The same facts, read at
 * the cutoff, are archived; read at any time they are the provisional report
 * of the admin (nothing is written).
 */
export function roundFacts(ctx: Ctx): RoundFacts {
  // A fresh pass at the cutoff, not the stored one (#405).
  const { total, categories: scores } = scorePass(ctx);
  const modes = categoryModes(roundRules(ctx));
  const planets = ctx.planets.all();
  // A player keeps the seat they got when they joined (`participant.joined`);
  // one who has none yet (a round without those events) gets the next free one.
  const seated = ctx.rounds.participants(roundRules(ctx).number);
  const known = new Map(seated.map((p) => [p.player, p.seat]));
  let free = Math.max(0, ...seated.map((p) => p.seat)) + 1;
  const players: RoundFacts['players'] = [];
  for (const user of ctx.players.all()) {
    const own = planets.filter((p) => p.owner === user.id);
    if (!own.length) continue;
    // Wirtschaft and Militär in the mode the round sets at its end (#422, 171b).
    const c = scores[user.id]!;
    const valuation = {
      total: total[user.id] ?? 0,
      economy: modes.economy ? c.economy.points : c.economy.count,
      military: modes.military ? c.military.points : c.military.count,
      modes,
    };
    players.push({
      seat: known.get(user.id) ?? free++,
      user,
      final: finalOf(ctx, user, own, valuation),
    });
  }
  players.sort((a, b) => a.seat - b.seat);
  const seatOf = new Map(players.map((p) => [p.user.id, p.seat]));
  const members = ctx.guilds.players().filter((m) => m.status === 'member');
  const guilds = ctx.guilds.all().map((g) => ({
    id: g.id,
    tag: g.tag,
    name: g.name,
    seats: members
      .filter((m) => m.guild_id === g.id && seatOf.has(m.id))
      .map((m) => seatOf.get(m.id)!),
  }));
  return { players, guilds };
}

/** The row of the running round; a round without one (a database from before #235) gets it now, as a partial one. */
export function ensureRound(ctx: Ctx): RoundRow {
  const number = roundRules(ctx).number;
  const row = ctx.rounds.get(number);
  if (row) return row;
  ctx.rounds.open({
    number,
    started: roundStart(ctx),
    coverage: 'partial',
    rules: roundRules(ctx),
  });
  return ctx.rounds.get(number)!;
}

/**
 * Writes an event into the history of the running round, in the transaction of
 * the change it records. A round that is closed is frozen at its cutoff: the
 * game goes on, its later events are not part of the archive.
 */
export function recordRoundEvent(
  ctx: Ctx,
  kind: string,
  payload: object,
  seat: number | null = null,
): void {
  const round = ensureRound(ctx);
  if (round.status !== 'active') return;
  const at = ctx.now();
  ctx.rounds.addEvent(round.number, at, { at, kind, seat, payload });
}

/** Starts the archive of the round that `startRoundRules` just began. */
export function openRound(ctx: Ctx): void {
  const rules = roundRules(ctx);
  const started = roundStart(ctx);
  ctx.rounds.open({
    number: rules.number,
    started,
    coverage: 'complete',
    rules,
  });
  ctx.rounds.addEvent(rules.number, ctx.now(), {
    at: started,
    kind: ROUND_EVENT.started,
  });
}

/**
 * The play time of #232 as events of the round, so the archive's lifetime
 * and the pseudonym apply to it: per participant the merged intervals of the
 * round, frozen at the cutoff. The rows of `playtime_events` stay (they go
 * when the admin deletes the round).
 */
function playtimeEvents(
  ctx: Ctx,
  round: number,
  cutoff: number,
  facts: RoundFacts,
): [number, PlayerPlaytime][] {
  const measured = new Map<string, MeasuredInterval[]>();
  for (const [user, interval] of ctx.playtime.activeInRound(round, cutoff))
    measured.set(user, [...(measured.get(user) ?? []), interval]);
  return facts.players.map((p) => [
    p.seat,
    playtimePayload(measured.get(p.user.id) ?? [], cutoff),
  ]);
}

/**
 * Closes the running round and writes its archive; a round that is closed
 * already stays as it is. Everything or nothing: a check that fails throws,
 * and the transaction of the caller rolls back.
 */
export function closeActiveRound(ctx: Ctx): RoundRow {
  const round = ensureRound(ctx);
  if (round.status === 'closed') return round;
  const number = round.number;
  const cutoff = ctx.now();
  const rules = roundRules(ctx);
  // The last spans up to the cutoff go into the journal first (version 2).
  journalClose(ctx, cutoff);
  const facts = roundFacts(ctx);
  const before = ctx.rounds.countEvents(number);
  let written = 0;
  const emit = (kind: string, seat: number | null, payload: object): void => {
    ctx.rounds.addEvent(number, cutoff, { at: cutoff, kind, seat, payload });
    written++;
  };
  for (const p of facts.players) {
    // A player who joined while the round ran has their seat already.
    if (ctx.rounds.seatOf(number, p.user.id) === null)
      ctx.rounds.addParticipant({
        round: number,
        seat: p.seat,
        player: p.user.id,
        name: p.user.name,
      });
    emit(ROUND_EVENT.player, p.seat, p.final);
  }
  for (const [seat, payload] of playtimeEvents(ctx, number, cutoff, facts))
    emit(ROUND_EVENT.playtime, seat, payload);
  for (const g of facts.guilds)
    emit(ROUND_EVENT.guild, null, { tag: g.tag, name: g.name, seats: g.seats });
  emit(ROUND_EVENT.closed, null, {
    cutoff,
    participants: facts.players.length,
  } satisfies RoundClosed);
  // The archive is complete only when every participant has a seat and a
  // final event and every event is there; else the reset must not go on.
  const finals = ctx.rounds.events(number, ROUND_EVENT.player);
  const seated = ctx.rounds.participants(number);
  const complete =
    facts.players.every((p) =>
      seated.some((s) => s.seat === p.seat && s.player === p.user.id),
    ) &&
    finals.length === facts.players.length &&
    ctx.rounds.events(number, ROUND_EVENT.playtime).length ===
      facts.players.length &&
    ctx.rounds.countEvents(number) === before + written;
  if (!complete)
    fail('Das Archiv der Runde ist unvollständig. Es wurde nichts geändert.');
  ctx.rounds.close(number, cutoff, rules, before + written);
  return ctx.rounds.get(number)!;
}
