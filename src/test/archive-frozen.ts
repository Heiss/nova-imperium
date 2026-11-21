// The round archive as HTML before #118, bundle 7 (the admin), frozen for the
// reference tests of the component RoundArchive (src/test/round-archive-
// reference.test.ts) and of Options (options-reference.test.ts): archiveHTML()
// and adminArchiveHTML() of logic/round-archive.ts with the HTML of the list,
// the report and the history, as the logic left them. The rules of what a
// setting differs by (`rulesDiff`) and the state stay in the logic.
import {
  type HistoryEntry,
  rankRows,
  type ReportRow,
  resourceSum,
  type RoundEntry,
  type RoundReport,
} from '../core/round-report.ts';
import { esc, fmt } from '../client/logic/format.ts';
import { playtime as playtimeText } from '../client/logic/own-activity.ts';
import {
  HIGHSCORE_CATEGORIES,
  type HighscoreCategory,
  highscoreNote,
} from '../client/logic/highscore.ts';
import { type ArchiveState, rulesDiff } from '../client/logic/round-archive.ts';
import { COVERAGE, day, daysText } from '../client/logic/round-words.ts';

const rulesHTML = (rules: Record<string, unknown>): string => {
  const diff = rulesDiff(rules);
  const body = diff.length
    ? `<ul>${diff.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p class="dim">Alle Einstellungen standen auf der Voreinstellung.</p>';
  return `<details><summary>Einstellungen dieser Runde</summary>${body}</details>`;
};

/** Where an own or foreign place is: „2 von 3“. */
const place = (s: { rank: number; of: number }): string =>
  `${s.rank} von ${s.of}`;

const openButton = (n: number): string =>
  `<button class="small" data-act="roundOpen" data-round="${n}">Bericht öffnen</button>`;

/** One row of the list of rounds; the admin also gets „Löschen“ for a finished round. */
function entryRow(e: RoundEntry, admin: boolean): string {
  const span =
    e.closed === null
      ? `seit ${day(e.started)}`
      : `${day(e.started)} bis ${day(e.closed)}`;
  let status: string;
  let action = '';
  if (e.locked) status = 'Nach Rundenende verfügbar';
  else if (e.status === 'active') {
    status = 'läuft · VORLÄUFIG · nur Spielleitung';
    action = openButton(e.number);
  } else {
    status = e.you
      ? `Platz ${place(e.you)} · ${fmt(e.you.points)} Punkte`
      : `${e.participants ?? 0} Teilnehmer`;
    action = openButton(e.number);
    // The Rewind of the thin Rewind (#235, view G): for a finished round the reader took part in.
    if (e.you)
      action += ` <button class="small" data-act="rewindOpen" data-round="${e.number}">Rewind ansehen</button>`;
    if (admin)
      action += ` <button class="small red" data-act="roundDelete" data-round="${e.number}">Löschen</button>`;
  }
  return `<tr><td class="n">${e.number}</td><td>${span}</td><td>${status}</td><td>${action}</td></tr>`;
}

const listHTML = (entries: readonly RoundEntry[], admin: boolean): string =>
  entries.length
    ? `<table class="scores"><tr><th class="n">Runde</th><th>Zeitraum</th><th>Stand</th><th></th></tr>${entries.map((e) => entryRow(e, admin)).join('')}</table>`
    : '<p class="dim">Noch keine Runde im Archiv.</p>';

const economy = (r: ReportRow): string => fmt(resourceSum(r.economy));

function rowHTML(
  r: ReportRow,
  i: number,
  cat: HighscoreCategory,
  time: RoundReport['playtime'],
  detail: string,
): string {
  const guild = r.guild ? `[${esc(r.guild.tag)}] ${esc(r.guild.name)}` : '-';
  const ms = time?.[r.seat];
  const played =
    time === null
      ? ''
      : `<td class="n">${ms === undefined ? '-' : playtimeText(ms)}</td>`;
  return `<tr class="${r.you ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(r.name)}${r.you ? ' (du)' : ''}</td><td class="n">${fmt(r.valuation[cat])}</td><td class="n">${economy(r)}</td><td class="n">${r.planets}</td><td class="n">${r.moons}</td>${played}<td>${guild}</td>${detail}</tr>`;
}

/**
 * What the report says about the play time (#235 × #232, D2) [V]: a column of
 * the table once the round is archived with it, else the reason it is missing.
 */
function playtimeNote(report: RoundReport): string {
  if (report.playtime !== null)
    return `<div class="dim">Spielzeit: geschätzte aktive Zeit in dieser Runde, gleichzeitig geöffnete Fenster zählen einmal.${report.round.coverage === 'partial' ? ' Die Zeit vor Beginn der Erfassung fehlt.' : ''}</div>`;
  if (report.round.provisional)
    return '<p class="dim">Spielzeit: wird erst nach Rundenende im Archiv geteilt.</p>';
  return report.rows.length
    ? '<p class="dim">Spielzeit: in diesem Archiv noch nicht erfasst.</p>'
    : '';
}

function guildsHTML(guilds: RoundReport['guilds']): string {
  if (!guilds.length) return '';
  const rows = guilds
    .map(
      (g) =>
        `<tr><td>[${esc(g.tag)}] ${esc(g.name)}</td><td class="n">${g.members}</td><td class="n">${fmt(g.points)}</td></tr>`,
    )
    .join('');
  return `<h4>Gilden</h4><table class="scores"><tr><th>Gilde</th><th class="n">Mitglieder</th><th class="n">Punkte (Summe)</th></tr>${rows}</table>`;
}

/** One button per category of the highscore (#78); the shown one is pressed. */
const categoryButtons = (cat: HighscoreCategory): string =>
  `<div class="flex" role="group" aria-labelledby="round-report-h">${Object.entries(
    HIGHSCORE_CATEGORIES,
  )
    .map(
      ([key, label]) =>
        `<button type="button" data-act="roundCat" data-cat="${key}" aria-pressed="${key === cat}">${label}</button>`,
    )
    .join('')}</div>`;

/**
 * The report of one round (#235, views B and H): the facts of the round, the
 * own place, the ranking by a category of the highscore, the guilds and the
 * settings. A provisional report of the admin is marked as such.
 */
function reportHTML(
  report: RoundReport,
  cat: HighscoreCategory,
  admin = false,
): string {
  const r = report.round;
  const banner = r.provisional
    ? `<div class="notice">VORLÄUFIG · nur Spielleitung. Stand ${new Date(r.asOf).toLocaleString('de-DE')}: die Runde läuft noch, der Bericht ist nicht veröffentlicht.</div>`
    : '';
  const mine = report.you
    ? `<tr><td>Dein Platz</td><td>${place(report.you)} · ${fmt(report.you.points)} Punkte</td></tr>`
    : '';
  const ranked = rankRows(report.rows, cat);
  const rows = ranked
    .map((x, i) =>
      rowHTML(
        x,
        i,
        cat,
        report.playtime,
        // The drilldown of the admin (#235, view H).
        admin
          ? `<td><button class="small" data-act="roundPerson" data-round="${r.number}" data-seat="${x.seat}">Einblick</button></td>`
          : '',
      ),
    )
    .join('');
  // „Vorschau aktualisieren“ of the provisional report (#235, view H).
  const refresh = r.provisional
    ? ` <button class="small" data-act="roundRefresh" data-round="${r.number}">Vorschau aktualisieren</button>`
    : '';
  return `<p><button class="small" data-act="roundBack">Zurück zum Archiv</button>${refresh}</p>
<h3 id="round-report-h" tabindex="-1">Runde ${r.number}${r.provisional ? ' (vorläufig)' : ''}</h3>${banner}
<table class="kv"><tr><td>Zeitraum</td><td>${day(r.started)} bis ${day(r.asOf)} · ${daysText(r.days)}</td></tr><tr><td>Teilnehmer</td><td>${report.rows.length}</td></tr><tr><td>Erfassung</td><td>${COVERAGE[r.coverage]}</td></tr>${mine}</table>
${categoryButtons(cat)}
<table class="scores"><tr><th class="n">Platz</th><th>Spieler</th><th class="n">${HIGHSCORE_CATEGORIES[cat]}</th><th class="n">Wirtschaft/h</th><th class="n">Planeten</th><th class="n">Monde</th>${report.playtime === null ? '' : '<th class="n">Spielzeit</th>'}<th>Gilde</th>${admin ? '<th></th>' : ''}</tr>${rows}</table>
<div class="dim">${highscoreNote(cat)} Wirtschaft/h: Summe aus Adamant, Psikristall und Promethium je Stunde am Rundenende, ungewichtet. Planeten und Monde am Rundenende.</div>
${playtimeNote(report)}
${guildsHTML(report.guilds)}${rulesHTML(r.rules)}`;
}

/** One row of the history across rounds. */
function historyRow(h: HistoryEntry): string {
  const own = h.you;
  const diff = rulesDiff(h.rules);
  return `<tr><td class="n">${h.number}</td><td class="n">${h.days}</td><td class="n">${h.participants}</td><td>${h.winner ? `${esc(h.winner.name)} (${fmt(h.winner.points)})` : '-'}</td><td class="n">${own ? place(own) : '-'}</td><td class="n">${own ? fmt(own.valuation.total) : '-'}</td><td class="n">${own ? fmt(resourceSum(own.economy)) : '-'}</td><td class="n">${own ? own.planets : '-'}</td><td>${diff.length ? esc(diff.join(', ')) : 'Voreinstellung'}${h.coverage === 'partial' ? ' · Verlauf lückenhaft' : ''}</td></tr>`;
}

/** The history across rounds (slice 3): the rounds side by side, with what differs between them. */
function historyHTML(history: readonly HistoryEntry[]): string {
  if (!history.length) return '';
  return `<h3>Rundenvergleich</h3><table class="scores"><tr><th class="n">Runde</th><th class="n">Tage</th><th class="n">Teilnehmer</th><th>Sieger (Punkte)</th><th class="n">Dein Platz</th><th class="n">Deine Punkte</th><th class="n">Wirtschaft/h</th><th class="n">Planeten</th><th>Einstellungen</th></tr>${history.map(historyRow).join('')}</table>`;
}

/** The content of the box „Rundenarchiv“ of a player. */
export function archiveHTML(a: ArchiveState): string {
  if (a.report) return reportHTML(a.report, a.category);
  if (a.error) return `<p class="notice">${esc(a.error)}</p>`;
  if (a.entries === null) return '<p class="dim">Das Archiv wird geladen …</p>';
  const intro =
    '<p>Jede beendete Runde, an der du teilgenommen hast, bleibt hier mit ihrem Bericht stehen. Die laufende Runde ist bis zu ihrem Ende gesperrt.</p>';
  return `${intro}${listHTML(a.entries, false)}${historyHTML(a.history ?? [])}`;
}

/** The content of the admin box „Rundenberichte“: closing, every round, deleting. */
export function adminArchiveHTML(a: ArchiveState): string {
  const close =
    '<p>„Runde abschließen“ speichert die laufende Runde im Archiv. Das Spiel läuft danach weiter, bis du eine neue Runde startest; „Neue Runde“ schließt eine noch laufende Runde selbst ab. Die Endzeit schließt keine Runde ab.</p><p><button class="red" data-act="roundClose">Runde abschließen</button></p>';
  if (a.report) return reportHTML(a.report, a.category, true);
  if (a.error) return `${close}<p class="notice">${esc(a.error)}</p>`;
  if (a.entries === null)
    return `${close}<p class="dim">Das Archiv wird geladen …</p>`;
  return `${close}${listHTML(a.entries, true)}${historyHTML(a.history ?? [])}`;
}
