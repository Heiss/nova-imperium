// The reading side of the round archive (#235): the list of the rounds a
// reader may open, the report of one round and the history across rounds.
// The access is decided here, on every request, from the account and the
// archive (owner, 2026-11-16: nothing locked is sent and hidden by CSS):
// a player gets a finished round they took part in, the admin every round,
// the running one as a provisional report that is never published. A round a
// reader may not open answers like one that does not exist.
import {
  type FinalPlace,
  type GuildFinal,
  type HistoryEntry,
  type ParticipantReport,
  type PlayerFinal,
  placeCounts,
  type PlayerPlaytime,
  playtimeMs,
  rankRows,
  type ReportRow,
  type RoundEntry,
  type RoundReport,
  roundDays,
  standingOf,
} from '../../core/round-report.ts';
import { type Rewind, rewindOf } from '../../core/round-rewind.ts';
import { record } from '../audit.ts';
import type { User } from '../db/repos/players.ts';
import type { RoundRow } from '../db/repos/rounds.ts';
import type { Handler, Answer } from './actions.ts';
import { type Ctx, fail, int } from './context.ts';
import type { ServerFeature } from './feature.ts';
import { ensureRound, ROUND_EVENT, roundFacts } from './round-archive.ts';
import { roundRules } from './round.ts';

/** The most rounds the history lists: the newest, so a long archive stays one bounded query ([V]). */
export const HISTORY_LIMIT = 50;
/** The most rounds the list shows: the newest. */
export const ARCHIVE_LIMIT = 100;

const UNAVAILABLE = 'Dieser Rundenbericht ist nicht verfügbar.';

/**
 * The play time of a finished round per seat, derived from its archived
 * events (D2: shared with every reader of the finished round, the sum only,
 * never the intervals). Null while the round runs (it stays private) and for a
 * round archived before the play time was written: that is unknown, not zero.
 */
function playtimeOf(ctx: Ctx, round: RoundRow): RoundReport['playtime'] {
  if (round.status !== 'closed') return null;
  const events = ctx.rounds.events(round.number, ROUND_EVENT.playtime);
  if (!events.length) return null;
  return Object.fromEntries(
    events.map((e) => [
      e.seat!,
      playtimeMs(e.payload as unknown as PlayerPlaytime),
    ]),
  );
}

/** Whether `u` may open the report of `round`: the admin any, a player a finished one they took part in. */
function may(ctx: Ctx, u: User, round: RoundRow | null): round is RoundRow {
  if (!round) return false;
  if (u.admin) return true;
  return (
    round.status === 'closed' &&
    ctx.rounds.roundsOf(u.id).includes(round.number)
  );
}

/** The rows of a finished round, from its archived events. */
function archivedRows(
  ctx: Ctx,
  number: number,
  viewer: string,
): { rows: ReportRow[]; guilds: GuildFinal[] } {
  const finals = new Map(
    ctx.rounds
      .events(number, ROUND_EVENT.player)
      .map((e) => [e.seat, e.payload as unknown as PlayerFinal]),
  );
  const guilds = ctx.rounds
    .events(number, ROUND_EVENT.guild)
    .map((e) => e.payload as unknown as GuildFinal);
  const rows: ReportRow[] = [];
  for (const p of ctx.rounds.participants(number)) {
    const final = finals.get(p.seat);
    if (final)
      rows.push(rowOf(p.seat, p.name, p.player === viewer, final, guilds));
  }
  return { rows, guilds };
}

function rowOf(
  seat: number,
  name: string,
  you: boolean,
  final: PlayerFinal,
  guilds: readonly GuildFinal[],
): ReportRow {
  const guild = guilds.find((g) => g.seats.includes(seat));
  return {
    seat,
    name,
    you,
    valuation: final.valuation,
    economy: final.economy,
    ...placeCounts(final.places as readonly FinalPlace[]),
    guild: guild ? { tag: guild.tag, name: guild.name } : null,
  };
}

/** The guilds with their members and the sum of their members' points. */
function guildLines(
  rows: readonly ReportRow[],
  guilds: readonly GuildFinal[],
): RoundReport['guilds'] {
  return guilds
    .map((g) => ({
      tag: g.tag,
      name: g.name,
      members: g.seats.length,
      points: rows
        .filter((r) => g.seats.includes(r.seat))
        .reduce((sum, r) => sum + r.valuation.total, 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/** The provisional report of the running round: the facts of now, nothing written. */
function provisionalRows(
  ctx: Ctx,
  viewer: string,
): { rows: ReportRow[]; guilds: GuildFinal[] } {
  const facts = roundFacts(ctx);
  const guilds = facts.guilds.map(({ tag, name, seats }) => ({
    tag,
    name,
    seats,
  }));
  return {
    rows: facts.players.map((p) =>
      rowOf(p.seat, p.user.name, p.user.id === viewer, p.final, guilds),
    ),
    guilds,
  };
}

const rulesOf = (ctx: Ctx, round: RoundRow): Record<string, unknown> =>
  round.status === 'active' ? { ...roundRules(ctx) } : round.rules;

function reportOf(ctx: Ctx, u: User, number: number): RoundReport {
  // The running round gets its row even before anyone closed one (a database from before #235).
  ensureRound(ctx);
  const round = ctx.rounds.get(number);
  if (!may(ctx, u, round)) return fail(UNAVAILABLE);
  const provisional = round.status === 'active';
  const { rows, guilds } = provisional
    ? provisionalRows(ctx, u.id)
    : archivedRows(ctx, number, u.id);
  const ranked = rankRows(rows);
  const you = ranked.find((r) => r.you);
  const asOf = round.closed ?? ctx.now();
  return {
    round: {
      number,
      provisional,
      asOf,
      started: round.started,
      closed: round.closed,
      days: roundDays(round.started, asOf),
      coverage: round.coverage,
      rules: rulesOf(ctx, round),
    },
    you: you ? standingOf(ranked, you.seat) : null,
    rows: ranked,
    guilds: guildLines(ranked, guilds),
    playtime: playtimeOf(ctx, round),
  };
}

/** The line of one round for the reader; a running round carries no data for a player. */
function entryOf(ctx: Ctx, u: User, r: RoundRow): RoundEntry {
  const rows =
    r.status === 'closed' ? archivedRows(ctx, r.number, u.id).rows : [];
  const you = rows.find((x) => x.you);
  return {
    number: r.number,
    status: r.status,
    started: r.started,
    closed: r.closed,
    coverage: r.coverage,
    locked: r.status === 'active' && !u.admin,
    participants: r.status === 'closed' ? rows.length : null,
    you: you ? standingOf(rows, you.seat) : null,
  };
}

/** The rounds the reader may see: a player their finished rounds and the lock of the running one, the admin all. */
function archiveOf(ctx: Ctx, u: User): RoundEntry[] {
  ensureRound(ctx);
  const mine = new Set(ctx.rounds.roundsOf(u.id));
  return ctx.rounds
    .all()
    .slice(0, ARCHIVE_LIMIT)
    .filter((r) => u.admin || r.status === 'active' || mine.has(r.number))
    .map((r) => entryOf(ctx, u, r));
}

/** The finished rounds across time, newest first: duration, settings, winner and the reader's own place. */
function historyOf(ctx: Ctx, u: User): HistoryEntry[] {
  const mine = new Set(ctx.rounds.roundsOf(u.id));
  return ctx.rounds
    .all()
    .filter((r) => r.status === 'closed' && (u.admin || mine.has(r.number)))
    .slice(0, HISTORY_LIMIT)
    .map((r): HistoryEntry => {
      const ranked = rankRows(archivedRows(ctx, r.number, u.id).rows);
      const own = ranked.find((x) => x.you);
      const top = ranked[0];
      const standing = own ? standingOf(ranked, own.seat) : null;
      return {
        number: r.number,
        started: r.started,
        // A closed round has its cutoff.
        closed: r.closed!,
        days: roundDays(r.started, r.closed!),
        coverage: r.coverage,
        rules: r.rules,
        participants: ranked.length,
        winner: top ? { name: top.name, points: top.valuation.total } : null,
        you:
          own && standing
            ? {
                ...standing,
                valuation: own.valuation,
                economy: own.economy,
                planets: own.planets,
                moons: own.moons,
              }
            : null,
      };
    });
}

/** The opening of a report or the history by an admin is an entry of the log (#235). */
const audit = (ctx: Ctx, u: User, action: string, detail: object): void => {
  if (u.admin)
    record(ctx, { category: 'admin.read', action, actor: u.id, detail });
};

const roundArchive: Handler<'roundArchive'> = (ctx, u): Answer => ({
  msg: null,
  data: { rounds: archiveOf(ctx, u), admin: u.admin },
});

const roundReport: Handler<'roundReport'> = (ctx, u, d): Answer => {
  const number = int(d.round, 0, Number.MAX_SAFE_INTEGER);
  const report = reportOf(ctx, u, number);
  audit(ctx, u, 'roundReport', {
    round: number,
    provisional: report.round.provisional,
  });
  return { msg: null, data: { report } };
};

/**
 * The Rewind of the reader in a finished round (#235, view G): the cards
 * come from the same report and the same access check as `roundReport`, so a
 * round the reader may not open answers like one that does not exist. The
 * running round has none (not even for the admin), and neither has a reader
 * who held no place in the round (an admin who did not play).
 */
function rewindFor(ctx: Ctx, u: User, number: number): Rewind {
  const report = reportOf(ctx, u, number);
  const seat = report.rows.find((r) => r.you)?.seat;
  // The events of a finished round feed the cards 2 to 5 and 7; the access was checked by `reportOf`.
  const events = report.round.provisional ? [] : ctx.rounds.events(number);
  const rewind = seat === undefined ? null : rewindOf(report, seat, events);
  return rewind?.cards.length ? rewind : fail(UNAVAILABLE);
}

const roundRewind: Handler<'roundRewind'> = (ctx, u, d): Answer => {
  const number = int(d.round, 0, Number.MAX_SAFE_INTEGER);
  const rewind = rewindFor(ctx, u, number);
  audit(ctx, u, 'roundRewind', { round: number });
  return { msg: null, data: { rewind } };
};

/**
 * One participant of a round for the admin (#235, view H): what the report
 * reduces to a row, in full. Admin only; a player, an unknown round and an
 * unknown seat answer like a round that does not exist. Reading writes nothing
 * but the entry of the log.
 */
function participantOf(ctx: Ctx, u: User, number: number, seat: number) {
  if (!u.admin) return fail(UNAVAILABLE);
  ensureRound(ctx);
  const round = ctx.rounds.get(number);
  if (!may(ctx, u, round)) return fail(UNAVAILABLE);
  const provisional = round.status === 'active';
  const found = provisional
    ? provisionalParticipant(ctx, seat)
    : archivedParticipant(ctx, number, seat);
  if (!found) return fail(UNAVAILABLE);
  const playtime = playtimeOf(ctx, round)?.[seat] ?? null;
  const guild = found.guilds.find((g) => g.seats.includes(seat));
  const result: ParticipantReport = {
    round: { number, provisional, asOf: round.closed ?? ctx.now() },
    seat,
    name: found.name,
    guild: guild ? { tag: guild.tag, name: guild.name } : null,
    ...found.final,
    playtime,
  };
  return result;
}

/** A participant of the running round: the facts of now. */
function provisionalParticipant(ctx: Ctx, seat: number) {
  const facts = roundFacts(ctx);
  const p = facts.players.find((x) => x.seat === seat);
  return p ? { name: p.user.name, final: p.final, guilds: facts.guilds } : null;
}

/** A participant of a finished round: their archived final state; a deleted account has the pseudonym. */
function archivedParticipant(ctx: Ctx, number: number, seat: number) {
  const person = ctx.rounds.participants(number).find((p) => p.seat === seat);
  const final = ctx.rounds
    .events(number, ROUND_EVENT.player)
    .find((e) => e.seat === seat)?.payload as unknown as
    PlayerFinal | undefined;
  if (!person || !final) return null;
  const guilds = ctx.rounds
    .events(number, ROUND_EVENT.guild)
    .map((e) => e.payload as unknown as GuildFinal);
  return { name: person.name, final, guilds };
}

const roundParticipant: Handler<'roundParticipant'> = (ctx, u, d): Answer => {
  const number = int(d.round, 0, Number.MAX_SAFE_INTEGER);
  const seat = int(d.seat, 0, Number.MAX_SAFE_INTEGER);
  const participant = participantOf(ctx, u, number, seat);
  audit(ctx, u, 'roundParticipant', { round: number, seat });
  return { msg: null, data: { participant } };
};

const roundHistory: Handler<'roundHistory'> = (ctx, u): Answer => {
  audit(ctx, u, 'roundHistory', {});
  return { msg: null, data: { history: historyOf(ctx, u) } };
};

export const serverFeature = {
  actions: {
    roundArchive,
    roundReport,
    roundParticipant,
    roundRewind,
    roundHistory,
  },
} satisfies ServerFeature;
