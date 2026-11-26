// The round archive in the browser (#235, okf/features/round-archive.md): the
// box „Rundenarchiv“ in „Optionen“ with the list of the rounds, the report of
// one round and the history across rounds, and the box „Rundenberichte“ of the
// admin, as the page the component RoundArchive renders (#118, bundle 7). The
// server decides who may see what; the page here only shows what it sent. The
// texts are drafts of Claude [V].
import { ROUND_SETTINGS, type RoundSetting } from '../../core/round.ts';
import {
  type HistoryEntry,
  isCoarse,
  type ParticipantReport,
  rankRows,
  type ReportCategory,
  type ReportRow,
  resourceSum,
  type RoundEntry,
  type RoundReport,
  valueOf,
} from '../../core/round-report.ts';
import type { Rewind } from '../../core/round-rewind.ts';
import { text } from '../../core/text.ts';
import type { Levels } from '../../core/types.ts';
import { fmt, resLine } from './format.ts';
import { rewindPage, type RewindPage } from './round-rewind.ts';
import { COVERAGE, day, daysText } from './round-words.ts';
import { playtime as playtimeText } from './own-activity.ts';
import {
  HIGHSCORE_CATEGORIES,
  highscoreNote,
} from '../../core/highscore-categories.ts';

/**
 * The four categories of #78 with their notes, as an archive written before
 * #422 shows them, unchanged (owner, 2026-11-26, 171b).
 */
const LEGACY_CATEGORIES = {
  total: 'Gesamt',
  buildings: 'Gebäude',
  research: 'Forschung',
  fleet: 'Flotte',
  defense: 'Verteidigung',
} as const;

const PER_1000 = '1 Punkt = 1.000 verbaute Rohstoffe';
const LEGACY_NOTES: Record<keyof typeof LEGACY_CATEGORIES, string> = {
  total: `${PER_1000} (Gebäude, Forschung, Schiffe, Verteidigung).`,
  buildings: `${PER_1000} (Gebäude).`,
  research: '1 Punkt pro Forschungsstufe.',
  fleet: '1 Punkt pro Schiff (auch Sonnenreliquiare).',
  defense: `${PER_1000} (Verteidigung).`,
};

/** A category of the archive: of the four of #78 or of the three of #422. */
export type ArchiveCategory = ReportCategory;

/** The category of `key` among both kinds, or „Gesamt“ for anything else. */
export const archiveCategory = (key: unknown): ArchiveCategory =>
  typeof key === 'string' &&
  (Object.hasOwn(LEGACY_CATEGORIES, key) ||
    Object.hasOwn(HIGHSCORE_CATEGORIES, key))
    ? (key as ArchiveCategory)
    : 'total';

/** The buttons and the note of a report: of #422 for a new archive, of #78 for an old one. */
interface ReportCategories {
  labels: Readonly<Record<string, string>>;
  note: (cat: ArchiveCategory) => string;
}

/**
 * The categories of a report by the shape of its records: a record of #422
 * stores its modes, so the note of each mode is shown; an old record, or a
 * report without participants, keeps the four categories of #78 [V].
 */
function reportCategories(report: RoundReport): ReportCategories {
  const coarse = report.rows.map((r) => r.valuation).find(isCoarse);
  if (!coarse)
    return {
      labels: LEGACY_CATEGORIES,
      note: (cat) => LEGACY_NOTES[cat as keyof typeof LEGACY_CATEGORIES],
    };
  return {
    labels: HIGHSCORE_CATEGORIES,
    note: (cat) =>
      highscoreNote(cat as keyof typeof HIGHSCORE_CATEGORIES, coarse.modes),
  };
}

/** What the browser holds of the archive; the account it was read for, and the round it was read in. */
export interface ArchiveState {
  user: string | null;
  round: number | null;
  entries: RoundEntry[] | null;
  history: HistoryEntry[] | null;
  report: RoundReport | null;
  /** One participant of the open report, for the admin (view H). */
  participant: ParticipantReport | null;
  /** The Rewind that is open (#235, view G), a story of its own in place of the list. */
  rewind: Rewind | null;
  category: ArchiveCategory;
  loading: boolean;
  error: string | null;
}

const empty = (): ArchiveState => ({
  user: null,
  round: null,
  entries: null,
  history: null,
  report: null,
  participant: null,
  rewind: null,
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
interface RoundRow {
  number: number;
  span: string;
  status: string;
  /** „Bericht öffnen“. */
  open: boolean;
  /** „Rewind ansehen“, for a finished round the reader took part in. */
  rewind: boolean;
  /** „Löschen“, only for the admin and a finished round. */
  remove: boolean;
}

/** One row of the list of rounds; the admin also gets „Löschen“ for a finished round. */
function roundRow(e: RoundEntry, admin: boolean): RoundRow {
  const span =
    e.closed === null
      ? `seit ${day(e.started)}`
      : `${day(e.started)} bis ${day(e.closed)}`;
  const row = {
    number: e.number,
    span,
    open: true,
    rewind: false,
    remove: false,
  };
  if (e.locked)
    return { ...row, status: 'Nach Rundenende verfügbar', open: false };
  if (e.status === 'active')
    return { ...row, status: 'läuft · VORLÄUFIG · nur Spielleitung' };
  const status = e.you
    ? `Platz ${place(e.you)} · ${fmt(e.you.points)} Punkte`
    : `${e.participants ?? 0} Teilnehmer`;
  return { ...row, status, rewind: e.you !== null, remove: admin };
}

/** One row of the ranking of a report. */
interface ReportRowPage {
  me: boolean;
  /** The seat the admin opens the drilldown with (view H). */
  seat: number;
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
  cat: ArchiveCategory,
  time: RoundReport['playtime'],
): ReportRowPage {
  const ms = time?.[r.seat];
  return {
    me: r.you,
    seat: r.seat,
    place: i + 1,
    name: `${r.name}${r.you ? ' (du)' : ''}`,
    points: fmt(valueOf(r.valuation, cat)),
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
  /** The number of the round, for the buttons of the page. */
  round: number;
  /** The line of a provisional report of the admin. */
  banner: string | null;
  /** „Vorschau aktualisieren“ of a provisional report: the round it reads again (view H). */
  refresh: number | null;
  /** Whether the rows open the drilldown of a participant: the admin only (view H). */
  detail: boolean;
  /** The facts of the round as „Name“ and „Wert“. */
  facts: [string, string][];
  categories: { key: ArchiveCategory; label: string; pressed: boolean }[];
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
  wanted: ArchiveCategory,
  admin = false,
): ReportPage {
  const r = report.round;
  const kinds = reportCategories(report);
  // A category of the other kind of archive is „Gesamt“ here.
  const cat: ArchiveCategory = Object.hasOwn(kinds.labels, wanted)
    ? wanted
    : 'total';
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
    round: r.number,
    banner: r.provisional
      ? `VORLÄUFIG · nur Spielleitung. Stand ${new Date(r.asOf).toLocaleString('de-DE')}: die Runde läuft noch, der Bericht ist nicht veröffentlicht.`
      : null,
    refresh: r.provisional ? r.number : null,
    detail: admin,
    facts,
    categories: Object.entries(kinds.labels).map(([key, label]) => ({
      key: key as ArchiveCategory,
      label,
      pressed: key === cat,
    })),
    column: kinds.labels[cat]!,
    playtime: report.playtime !== null,
    rows: rankRows(report.rows, cat).map((x, i) =>
      reportRow(x, i, cat, report.playtime),
    ),
    note: `${kinds.note(cat)} Wirtschaft/h: Summe aus Adamant, Psikristall und Promethium je Stunde am Rundenende, ungewichtet. Planeten und Monde am Rundenende.`,
    playtimeNote: playtimeNote(report),
    guilds: report.guilds.map((g) => ({
      name: `[${g.tag}] ${g.name}`,
      members: String(g.members),
      points: fmt(g.points),
    })),
    rules: rulesDiff(r.rules),
  };
}

const name = (key: string): string => text(key)?.n ?? key;

/** „Name Stufe 3, Name 5“ for the levels or numbers of a list; „-“ for none. */
const levelsText = (levels: Levels, unit: string): string => {
  const list = Object.entries(levels).filter(([, n]) => n > 0);
  return list.length
    ? list.map(([key, n]) => `${name(key)} ${unit}${fmt(n)}`).join(', ')
    : '-';
};

/** One place of a participant in the drilldown. */
interface PlaceLine {
  where: string;
  buildings: string;
  ships: string;
  defense: string;
}

/**
 * One participant of a report for the admin (#235, view H, the drilldown) as
 * the component shows it: the facts of the cutoff, or of the moment of reading
 * for the running round, in full. The words are drafts of Claude [V].
 */
export interface ParticipantPage {
  heading: string;
  banner: string | null;
  facts: [string, string][];
  places: PlaceLine[];
}

export function participantPage(p: ParticipantReport): ParticipantPage {
  const v = p.valuation;
  const facts: [string, string][] = [
    ['Gilde', p.guild ? `[${p.guild.tag}] ${p.guild.name}` : '-'],
    ['Punkte gesamt', fmt(v.total)],
    // The categories the archive was written with (#422, 171b).
    ...(isCoarse(v)
      ? ([
          ['Wirtschaft', fmt(v.economy)],
          ['Militär', fmt(v.military)],
        ] as [string, string][])
      : ([
          ['Gebäude', fmt(v.buildings)],
          ['Forschung', fmt(v.research)],
          ['Flotte', fmt(v.fleet)],
          ['Verteidigung', fmt(v.defense)],
        ] as [string, string][])),
    ['Wirtschaft/h', resLine(p.economy)],
    ['Forschungsstufen', levelsText(p.research, 'Stufe ')],
    ['Flotten unterwegs', levelsText(p.flying, '')],
    ['Urlaubsmodus', p.vacation ? 'ja' : 'nein'],
    [
      'Spielzeit',
      p.playtime === null
        ? 'wird erst nach Rundenende im Archiv geteilt'
        : playtimeText(p.playtime),
    ],
  ];
  return {
    heading: `Runde ${p.round.number} · ${p.name}${p.round.provisional ? ' (vorläufig)' : ''}`,
    banner: p.round.provisional
      ? `VORLÄUFIG · nur Spielleitung. Stand ${new Date(p.round.asOf).toLocaleString('de-DE')}.`
      : null,
    facts,
    places: p.places.map((x) => ({
      where: `${x.kind === 'moon' ? 'Mond' : 'Planet'} ${x.g}:${x.s}:${x.p}`,
      buildings: levelsText(x.b, 'Stufe '),
      ships: levelsText(x.ships, ''),
      defense: levelsText(x.def, ''),
    })),
  };
}

/** One row of the history across rounds. */
interface HistoryRow {
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
type ArchiveBody =
  | { kind: 'report'; report: ReportPage }
  | { kind: 'participant'; participant: ParticipantPage }
  | { kind: 'rewind'; rewind: RewindPage }
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
  if (a.participant)
    return { kind: 'participant', participant: participantPage(a.participant) };
  if (a.report)
    return {
      kind: 'report',
      report: reportPage(a.report, a.category, admin),
    };
  if (a.rewind) return { kind: 'rewind', rewind: rewindPage(a.rewind) };
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
    close:
      admin &&
      body.kind !== 'report' &&
      body.kind !== 'participant' &&
      body.kind !== 'rewind',
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
