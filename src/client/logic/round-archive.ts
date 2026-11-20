// The round archive in the browser (#235, okf/features/round-archive.md): the
// box „Rundenarchiv“ in „Optionen“ with the list of the rounds, the report of
// one round and the history across rounds, and the box „Rundenberichte“ of the
// admin, as the page the component RoundArchive renders (#118, bundle 7). The
// server decides who may see what; the page here only shows what it sent. The
// texts are drafts of Claude [V].
import { ROUND_SETTINGS, type RoundSetting } from '../../core/round.ts';
import {
  type HistoryEntry,
  rankRows,
  type ReportRow,
  resourceSum,
  type RoundEntry,
  type RoundReport,
} from '../../core/round-report.ts';
import { fmt } from './format.ts';
import { playtime as playtimeText } from './own-activity.ts';
import {
  HIGHSCORE_CATEGORIES,
  type HighscoreCategory,
  highscoreNote,
} from './highscore.ts';

/** What the browser holds of the archive; the account it was read for, and the round it was read in. */
export interface ArchiveState {
  user: string | null;
  round: number | null;
  entries: RoundEntry[] | null;
  history: HistoryEntry[] | null;
  report: RoundReport | null;
  category: HighscoreCategory;
  loading: boolean;
  error: string | null;
}

const empty = (): ArchiveState => ({
  user: null,
  round: null,
  entries: null,
  history: null,
  report: null,
  category: 'total',
  loading: false,
  error: null,
});

export const archive: ArchiveState = empty();

/**
 * What the views show for this account and round: what was read for them, else
 * nothing, so the data of another account is never drawn before the reload.
 */
export const shownArchive = (s: {
  me?: { id: string };
  round?: { number: number };
}): ArchiveState =>
  s.me &&
  s.round &&
  archive.user === s.me.id &&
  archive.round === s.round.number
    ? archive
    : empty();

/** Forgets everything read, for a new account, a new round or a reload after a change. */
export const forgetArchive = (): void => {
  Object.assign(archive, empty());
};

/**
 * Whether the archive must be read now for the account and the round of the
 * state: nothing is held, or what is held belongs to another account or round.
 */
export function needsLoad(user: string, round: number): boolean {
  if (archive.loading) return false;
  if (archive.user !== user || archive.round !== round) {
    forgetArchive();
    archive.user = user;
    archive.round = round;
  }
  return archive.entries === null;
}

const day = (t: number): string => new Date(t).toLocaleDateString('de-DE');

const daysText = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;

const COVERAGE = {
  complete: 'vollständig ab Rundenbeginn',
  partial:
    'Die Runde lief schon, als das Archiv eingeführt wurde: ihr früher Verlauf fehlt.',
} as const;

/** The value of a setting as the list shows it. */
function valueText(s: RoundSetting, value: unknown): string {
  if (s.kind === 'switch') return value ? 'an' : 'aus';
  return (
    (s.choices?.find((c) => c.value === value)?.label ?? String(value)) || '-'
  );
}

/**
 * The settings of a round that differ from the default, as „Name: Wert“; the
 * empty list when it ran on the defaults. A comparison of rounds names them,
 * so a different length or speed is no surprise (issue #235, section 4).
 */
export function rulesDiff(
  rules: Record<string, unknown>,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): string[] {
  return settings
    .filter((s) => s.name in rules && rules[s.name] !== s.def)
    .map((s) => `${s.label}: ${valueText(s, rules[s.name])}`);
}

/** Where an own or foreign place is: „2 von 3“. */
const place = (s: { rank: number; of: number }): string =>
  `${s.rank} von ${s.of}`;

/** One row of the list of rounds: its words and the buttons it offers. */
export interface RoundRow {
  number: number;
  span: string;
  status: string;
  /** „Bericht öffnen“. */
  open: boolean;
  /** „Löschen“, only for the admin and a finished round. */
  remove: boolean;
}

/** One row of the list of rounds; the admin also gets „Löschen“ for a finished round. */
function roundRow(e: RoundEntry, admin: boolean): RoundRow {
  const span =
    e.closed === null
      ? `seit ${day(e.started)}`
      : `${day(e.started)} bis ${day(e.closed)}`;
  const row = { number: e.number, span, open: true, remove: false };
  if (e.locked)
    return { ...row, status: 'Nach Rundenende verfügbar', open: false };
  if (e.status === 'active')
    return { ...row, status: 'läuft · VORLÄUFIG · nur Spielleitung' };
  const status = e.you
    ? `Platz ${place(e.you)} · ${fmt(e.you.points)} Punkte`
    : `${e.participants ?? 0} Teilnehmer`;
  return { ...row, status, remove: admin };
}

/** One row of the ranking of a report. */
export interface ReportRowPage {
  me: boolean;
  place: number;
  name: string;
  points: string;
  economy: string;
  planets: number;
  moons: number;
  /** The play time of the seat, „-“ without a value; null while the report has no play time column. */
  played: string | null;
  guild: string;
}

function reportRow(
  r: ReportRow,
  i: number,
  cat: HighscoreCategory,
  time: RoundReport['playtime'],
): ReportRowPage {
  const ms = time?.[r.seat];
  return {
    me: r.you,
    place: i + 1,
    name: `${r.name}${r.you ? ' (du)' : ''}`,
    points: fmt(r.valuation[cat]),
    economy: fmt(resourceSum(r.economy)),
    planets: r.planets,
    moons: r.moons,
    played: time === null ? null : ms === undefined ? '-' : playtimeText(ms),
    guild: r.guild ? `[${r.guild.tag}] ${r.guild.name}` : '-',
  };
}

/** A note below the table: the first is a block of its own (`div`), the others a paragraph. */
interface ReportNote {
  block: 'div' | 'p';
  text: string;
}

/**
 * What the report says about the play time (#235 × #232, D2) [V]: a column of
 * the table once the round is archived with it, else the reason it is missing.
 */
function playtimeNote(report: RoundReport): ReportNote | null {
  if (report.playtime !== null)
    return {
      block: 'div',
      text: `Spielzeit: geschätzte aktive Zeit in dieser Runde, gleichzeitig geöffnete Fenster zählen einmal.${report.round.coverage === 'partial' ? ' Die Zeit vor Beginn der Erfassung fehlt.' : ''}`,
    };
  if (report.round.provisional)
    return {
      block: 'p',
      text: 'Spielzeit: wird erst nach Rundenende im Archiv geteilt.',
    };
  return report.rows.length
    ? { block: 'p', text: 'Spielzeit: in diesem Archiv noch nicht erfasst.' }
    : null;
}

/** The report of one round (#235, views B and H) as the component shows it. */
export interface ReportPage {
  heading: string;
  /** The line of a provisional report of the admin. */
  banner: string | null;
  /** The facts of the round as „Name“ and „Wert“. */
  facts: [string, string][];
  categories: { key: HighscoreCategory; label: string; pressed: boolean }[];
  /** The header of the points column: the name of the category. */
  column: string;
  /** Whether the table has the column „Spielzeit“. */
  playtime: boolean;
  rows: ReportRowPage[];
  note: string;
  playtimeNote: ReportNote | null;
  guilds: { name: string; members: string; points: string }[];
  /** The settings that differed, each as „Name: Wert“; none when the round ran on the defaults. */
  rules: string[];
}

/**
 * The report of one round (#235, views B and H): the facts of the round, the
 * own place, the ranking by a category of the highscore, the guilds and the
 * settings. A provisional report of the admin is marked as such.
 */
export function reportPage(
  report: RoundReport,
  cat: HighscoreCategory,
): ReportPage {
  const r = report.round;
  const facts: [string, string][] = [
    ['Zeitraum', `${day(r.started)} bis ${day(r.asOf)} · ${daysText(r.days)}`],
    ['Teilnehmer', String(report.rows.length)],
    ['Erfassung', COVERAGE[r.coverage]],
  ];
  if (report.you)
    facts.push([
      'Dein Platz',
      `${place(report.you)} · ${fmt(report.you.points)} Punkte`,
    ]);
  return {
    heading: `Runde ${r.number}${r.provisional ? ' (vorläufig)' : ''}`,
    banner: r.provisional
      ? `VORLÄUFIG · nur Spielleitung. Stand ${new Date(r.asOf).toLocaleString('de-DE')}: die Runde läuft noch, der Bericht ist nicht veröffentlicht.`
      : null,
    facts,
    categories: Object.entries(HIGHSCORE_CATEGORIES).map(([key, label]) => ({
      key: key as HighscoreCategory,
      label,
      pressed: key === cat,
    })),
    column: HIGHSCORE_CATEGORIES[cat],
    playtime: report.playtime !== null,
    rows: rankRows(report.rows, cat).map((x, i) =>
      reportRow(x, i, cat, report.playtime),
    ),
    note: `${highscoreNote(cat)} Wirtschaft/h: Summe aus Adamant, Psikristall und Promethium je Stunde am Rundenende, ungewichtet. Planeten und Monde am Rundenende.`,
    playtimeNote: playtimeNote(report),
    guilds: report.guilds.map((g) => ({
      name: `[${g.tag}] ${g.name}`,
      members: String(g.members),
      points: fmt(g.points),
    })),
    rules: rulesDiff(r.rules),
  };
}

/** One row of the history across rounds. */
export interface HistoryRow {
  number: number;
  days: number;
  participants: number;
  winner: string;
  /** The own values of the round, „-“ where the player did not take part. */
  place: string;
  points: string;
  economy: string;
  planets: string;
  settings: string;
}

function historyRow(h: HistoryEntry): HistoryRow {
  const own = h.you;
  const diff = rulesDiff(h.rules);
  return {
    number: h.number,
    days: h.days,
    participants: h.participants,
    winner: h.winner ? `${h.winner.name} (${fmt(h.winner.points)})` : '-',
    place: own ? place(own) : '-',
    points: own ? fmt(own.valuation.total) : '-',
    economy: own ? fmt(resourceSum(own.economy)) : '-',
    planets: own ? String(own.planets) : '-',
    settings: `${diff.length ? diff.join(', ') : 'Voreinstellung'}${h.coverage === 'partial' ? ' · Verlauf lückenhaft' : ''}`,
  };
}

/** What the box shows: a report, a refusal, the wait for the list, or the list with the history. */
export type ArchiveBody =
  | { kind: 'report'; report: ReportPage }
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'list'; rounds: RoundRow[]; history: HistoryRow[] };

/** The box „Rundenarchiv“ of a player and „Rundenberichte“ of the admin. */
export interface ArchivePage {
  /** The admin's sentence and „Runde abschließen“ above the body, but not above a report. */
  close: boolean;
  /** The sentence of the player's list above it. */
  intro: boolean;
  body: ArchiveBody;
}

function archiveBody(a: ArchiveState, admin: boolean): ArchiveBody {
  if (a.report)
    return { kind: 'report', report: reportPage(a.report, a.category) };
  if (a.error) return { kind: 'error', message: a.error };
  if (a.entries === null) return { kind: 'loading' };
  return {
    kind: 'list',
    rounds: a.entries.map((e) => roundRow(e, admin)),
    history: (a.history ?? []).map(historyRow),
  };
}

/** The box „Rundenarchiv“ of a player, or with `admin` the box „Rundenberichte“ (closing, every round, deleting). */
export function archivePage(a: ArchiveState, admin = false): ArchivePage {
  const body = archiveBody(a, admin);
  return {
    close: admin && body.kind !== 'report',
    intro: !admin && body.kind === 'list',
    body,
  };
}

/** The question before „Runde abschließen“. */
export const closeText = (n: number): string =>
  `Runde ${n} jetzt abschließen? Ihr Stand wird im Archiv gespeichert, das Spiel läuft weiter, bis eine neue Runde startet. Das kann nicht rückgängig gemacht werden.`;

/** The question before „Löschen“ of an archived round. */
export const deleteText = (n: string | undefined): string =>
  `Runde ${n ?? ''} mit allen Berichten aus dem Archiv löschen? Das kann nicht rückgängig gemacht werden.`;
