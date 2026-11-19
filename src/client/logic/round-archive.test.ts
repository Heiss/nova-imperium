import { beforeEach, describe, expect, it } from 'vitest';
import { ROUND_SETTINGS, type RoundSetting } from '../../core/round.ts';
import type {
  HistoryEntry,
  ReportRow,
  RoundEntry,
  RoundReport,
} from '../../core/round-report.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  adminArchiveHTML,
  archive,
  archiveHTML,
  closeText,
  deleteText,
  forgetArchive,
  historyHTML,
  needsLoad,
  reportHTML,
  rulesDiff,
  shownArchive,
} from './round-archive.ts';

const row = (
  seat: number,
  name: string,
  total: number,
  over: Partial<ReportRow> = {},
): ReportRow => ({
  seat,
  name,
  you: false,
  valuation: {
    total,
    buildings: 100 - total,
    research: 1,
    fleet: 2,
    defense: 3,
  },
  economy: { m: 1000, c: 500, d: 250 },
  planets: 2,
  moons: 1,
  guild: null,
  ...over,
});

const report = (over: Partial<RoundReport['round']> = {}): RoundReport => ({
  round: {
    number: 3,
    provisional: false,
    asOf: Date.UTC(2026, 10, 20, 12),
    started: Date.UTC(2026, 10, 1, 12),
    closed: Date.UTC(2026, 10, 20, 12),
    days: 19,
    coverage: 'complete',
    rules: {},
    ...over,
  },
  you: { rank: 2, of: 3, points: 8400 },
  rows: [
    row(1, 'Lea', 9100),
    row(2, 'Vex', 8400, { you: true }),
    row(3, 'Nox', 5900),
  ],
  guilds: [],
  playtime: null,
});

const entry = (over: Partial<RoundEntry>): RoundEntry => ({
  number: 1,
  status: 'closed',
  started: Date.UTC(2026, 9, 1),
  closed: Date.UTC(2026, 9, 31),
  coverage: 'complete',
  locked: false,
  participants: 3,
  you: { rank: 2, of: 3, points: 8400 },
  ...over,
});

beforeEach(() => forgetArchive());

const SETTINGS: readonly RoundSetting[] = [
  {
    kind: 'switch',
    key: 'roundGuilds',
    name: 'guilds',
    label: 'Gilden',
    order: 1,
    def: true,
    refusal: 'x',
  },
  {
    kind: 'number',
    key: 'roundHours',
    name: 'hours',
    label: 'Stunden',
    order: 2,
    min: 1,
    max: 9,
    def: 4,
  },
  {
    kind: 'number',
    key: 'roundMode',
    name: 'mode',
    label: 'Art',
    order: 3,
    min: 0,
    max: 1,
    def: 0,
    choices: [
      { value: 0, label: 'klein' },
      { value: 1, label: 'groß' },
    ],
  },
];

describe('the settings that differ from the default', () => {
  it('names none for a round on the defaults and for a round without stored rules', () => {
    expect(rulesDiff({ guilds: true, hours: 4, mode: 0 }, SETTINGS)).toEqual(
      [],
    );
    expect(rulesDiff({}, SETTINGS)).toEqual([]);
    // A round that ran on the values of a database from before the planet limit
    // (unlimited) differs from the default of a new round, 6 (#237).
    expect(rulesDiff({ ...roundDefaults(), colonyBase: 6 })).toEqual([]);
    expect(rulesDiff(roundDefaults())).toEqual([
      'Maximale Planeten ohne Forschung (0 = unbegrenzt, der Heimatplanet zählt mit): 0',
    ]);
  });

  it('names a changed switch, a changed number and the label of a named choice', () => {
    expect(rulesDiff({ guilds: false, hours: 7, mode: 1 }, SETTINGS)).toEqual([
      'Gilden: aus',
      'Stunden: 7',
      'Art: groß',
    ]);
  });

  it('shows the number of a value without a label', () => {
    expect(rulesDiff({ mode: 5 }, SETTINGS)).toEqual(['Art: 5']);
  });
});

describe('the report of a round', () => {
  it('shows the span, the participants, the coverage and the own place', () => {
    const html = reportHTML(report(), 'total');
    expect(html).toContain('Runde 3');
    expect(html).toContain('1.11.2026 bis 20.11.2026 · 19 Tage');
    expect(html).toContain('<td>Teilnehmer</td><td>3</td>');
    expect(html).toContain('vollständig ab Rundenbeginn');
    expect(html).toContain(
      '<td>Dein Platz</td><td>2 von 3 · 8.400 Punkte</td>',
    );
    expect(html).not.toContain('VORLÄUFIG');
  });

  it('marks the own row and lists the players best first', () => {
    const html = reportHTML(report(), 'total');
    expect(html).toContain(
      '<tr class="me"><td class="n">2</td><td>Vex (du)</td>',
    );
    expect(html.indexOf('Lea')).toBeLessThan(html.indexOf('Vex'));
    expect(html.indexOf('Vex')).toBeLessThan(html.indexOf('Nox'));
  });

  it('ranks by the chosen category and names it in the header', () => {
    const html = reportHTML(report(), 'buildings');
    expect(html.indexOf('Nox')).toBeLessThan(html.indexOf('Vex'));
    expect(html.indexOf('Vex')).toBeLessThan(html.indexOf('Lea'));
    expect(html).toContain('<th class="n">Gebäude</th>');
    expect(html).toContain(
      'data-act="roundCat" data-cat="buildings" aria-pressed="true"',
    );
    expect(html).toContain(
      'data-act="roundCat" data-cat="total" aria-pressed="false"',
    );
  });

  it('shows the economy as an unweighted sum and says so', () => {
    const html = reportHTML(report(), 'total');
    expect(html).toContain('<td class="n">1.750</td>');
    expect(html).toContain('ungewichtet');
  });

  it('marks the provisional report of the admin and its time', () => {
    const html = reportHTML(
      report({ provisional: true, closed: null }),
      'total',
    );
    expect(html).toContain('VORLÄUFIG · nur Spielleitung');
    expect(html).toContain('Runde 3 (vorläufig)');
    expect(html).toContain('nicht veröffentlicht');
  });

  it('says that the early course is missing for a partial round', () => {
    expect(reportHTML(report({ coverage: 'partial' }), 'total')).toContain(
      'ihr früher Verlauf fehlt',
    );
  });

  it('escapes names and guilds', () => {
    const r = report();
    r.rows[0] = row(1, '<img src=x>', 5, {
      guild: { tag: '<b>', name: '"x"' },
    });
    r.guilds = [{ tag: '<b>', name: '<i>', members: 1, points: 5 }];
    const html = reportHTML(r, 'total');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>]');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('<h4>Gilden</h4>');
  });

  it('leaves out the guild table without guilds and names the missing playtime', () => {
    const html = reportHTML(report(), 'total');
    expect(html).not.toContain('<h4>Gilden</h4>');
    expect(html).toContain('Spielzeit: in diesem Archiv noch nicht erfasst.');
  });

  it('shows the playtime as a column once there is playtime, 0 Min. as a measured zero, - for a seat without a value', () => {
    const r = { ...report(), playtime: { 1: 3600000 + 5 * 60000, 2: 0 } };
    const html = reportHTML(r, 'total');
    expect(html).not.toContain('noch nicht erfasst');
    expect(html).toContain('<th class="n">Spielzeit</th>');
    expect(html).toContain('<td class="n">1 Std. 05 Min.</td>');
    expect(html).toContain('<td class="n">0 Min.</td>');
    expect(html).toContain('<td class="n">-</td><td>-</td>');
    expect(html).toContain('gleichzeitig geöffnete Fenster zählen einmal.');
    expect(html).not.toContain('Die Zeit vor Beginn der Erfassung fehlt.');
  });

  it('says that the time before the measurement is missing in a partly covered round', () => {
    const r = report({ coverage: 'partial' });
    expect(
      reportHTML({ ...r, playtime: { 1: 0, 2: 0, 3: 0 } }, 'total'),
    ).toContain('Die Zeit vor Beginn der Erfassung fehlt.');
  });

  it('says that a provisional report shares no play time, and shows no line for a round without participants', () => {
    const provisional = report({ provisional: true });
    const html = reportHTML(provisional, 'total');
    expect(html).toContain(
      'Spielzeit: wird erst nach Rundenende im Archiv geteilt.',
    );
    expect(html).not.toContain('<th class="n">Spielzeit</th>');
    expect(reportHTML({ ...report(), rows: [] }, 'total')).not.toContain(
      'Spielzeit',
    );
  });

  it('lists the settings that differed', () => {
    const sw = ROUND_SETTINGS.find((s) => s.kind === 'switch')!;
    const html = reportHTML(
      report({ rules: { [sw.name]: sw.kind === 'switch' ? !sw.def : 0 } }),
      'total',
    );
    expect(html).toContain(`<li>${sw.label}:`);
    expect(reportHTML(report(), 'total')).toContain('Voreinstellung');
  });
});

describe('the list of rounds', () => {
  it('shows the lock of the running round with no button', () => {
    archive.entries = [
      entry({
        number: 4,
        status: 'active',
        closed: null,
        locked: true,
        you: null,
      }),
    ];
    const html = archiveHTML({ ...archive });
    expect(html).toContain('Nach Rundenende verfügbar');
    expect(html).not.toContain('data-act="roundOpen"');
  });

  it('opens a finished round with its place', () => {
    archive.entries = [entry({ number: 3 })];
    const html = archiveHTML({ ...archive });
    expect(html).toContain('Platz 2 von 3 · 8.400 Punkte');
    expect(html).toContain('data-act="roundOpen" data-round="3"');
    expect(html).not.toContain('roundDelete');
  });

  it('says so for an empty archive and while it loads', () => {
    expect(archiveHTML({ ...archive })).toContain('wird geladen');
    archive.entries = [];
    expect(archiveHTML({ ...archive })).toContain(
      'Noch keine Runde im Archiv.',
    );
  });

  it('shows a refusal in place of the list', () => {
    archive.entries = [];
    archive.error = 'Nicht <da>';
    const html = archiveHTML({ ...archive });
    expect(html).toContain('Nicht &lt;da&gt;');
    expect(html).not.toContain('Noch keine Runde');
  });

  it('shows the open report instead of the list', () => {
    archive.entries = [entry({})];
    archive.report = report();
    const html = archiveHTML({ ...archive });
    expect(html).toContain('roundBack');
    expect(html).not.toContain('Nach Rundenende');
  });

  it('shows the history below the list', () => {
    archive.entries = [entry({})];
    archive.history = [];
    expect(archiveHTML({ ...archive })).not.toContain('Rundenvergleich');
  });
});

describe('the box of the admin', () => {
  it('has „Runde abschließen“ at any time', () => {
    expect(adminArchiveHTML({ ...archive })).toContain('data-act="roundClose"');
    archive.entries = [];
    expect(adminArchiveHTML({ ...archive })).toContain('data-act="roundClose"');
    archive.error = 'x';
    expect(adminArchiveHTML({ ...archive })).toContain('data-act="roundClose"');
  });

  it('offers the provisional report of the running round and „Löschen“ only for a finished one', () => {
    archive.entries = [
      entry({
        number: 5,
        status: 'active',
        closed: null,
        participants: null,
        you: null,
      }),
      entry({ number: 4 }),
    ];
    const html = adminArchiveHTML({ ...archive });
    expect(html).toContain('läuft · VORLÄUFIG · nur Spielleitung');
    expect(html.match(/data-act="roundOpen"/g)).toHaveLength(2);
    expect(html.match(/data-act="roundDelete"/g)).toHaveLength(1);
    expect(html).toContain('data-act="roundDelete" data-round="4"');
  });

  it('names the participants of a round the admin did not play', () => {
    archive.entries = [entry({ you: null, participants: 7 })];
    expect(adminArchiveHTML({ ...archive })).toContain('7 Teilnehmer');
  });

  it('shows the open report', () => {
    archive.report = report();
    expect(adminArchiveHTML({ ...archive })).toContain('roundBack');
  });
});

describe('the history across rounds', () => {
  const h = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
    number: 2,
    started: 0,
    closed: 1,
    days: 12,
    coverage: 'complete',
    rules: {},
    participants: 5,
    winner: { name: 'Lea', points: 9100 },
    you: {
      rank: 2,
      of: 5,
      points: 8400,
      valuation: {
        total: 8400,
        buildings: 1,
        research: 2,
        fleet: 3,
        defense: 4,
      },
      economy: { m: 1, c: 2, d: 3 },
      planets: 4,
      moons: 1,
    },
    ...over,
  });

  it('is empty without a round', () => {
    expect(historyHTML([])).toBe('');
  });

  it('puts the rounds side by side with length, winner and the own values', () => {
    const html = historyHTML([h()]);
    expect(html).toContain(
      '<td class="n">2</td><td class="n">12</td><td class="n">5</td><td>Lea (9.100)</td><td class="n">2 von 5</td><td class="n">8.400</td><td class="n">6</td><td class="n">4</td>',
    );
    expect(html).toContain('Voreinstellung');
  });

  it('shows a dash for a round without own values or winner and marks a partial one', () => {
    const html = historyHTML([
      h({ you: null, winner: null, coverage: 'partial' }),
    ]);
    expect(html).toContain(
      '<td>-</td><td class="n">-</td><td class="n">-</td><td class="n">-</td><td class="n">-</td>',
    );
    expect(html).toContain('Verlauf lückenhaft');
  });

  it('names a setting that differed', () => {
    const sw = ROUND_SETTINGS.find((s) => s.kind === 'switch')!;
    const html = historyHTML([
      h({ rules: { [sw.name]: sw.kind === 'switch' ? !sw.def : 0 } }),
    ]);
    expect(html).toContain(sw.label);
    expect(html).not.toContain('>Voreinstellung<');
  });
});

const who = (id: string, number: number) => ({
  me: { id },
  round: { number },
});

describe('what the browser holds', () => {
  it('shows nothing for a state without account or round', () => {
    archive.entries = [entry({})];
    expect(shownArchive({}).entries).toBeNull();
  });

  it('shows nothing of another account or round', () => {
    archive.user = 'u1';
    archive.round = 3;
    archive.entries = [entry({})];
    expect(shownArchive(who('u1', 3)).entries).toHaveLength(1);
    expect(shownArchive(who('u2', 3)).entries).toBeNull();
    expect(shownArchive(who('u1', 4)).entries).toBeNull();
  });

  it('reads once for an account and a round, again for another', () => {
    expect(needsLoad('u1', 3)).toBe(true);
    archive.entries = [];
    expect(needsLoad('u1', 3)).toBe(false);
    expect(needsLoad('u1', 4)).toBe(true);
    expect(archive.round).toBe(4);
    archive.entries = [entry({})];
    archive.report = report();
    expect(needsLoad('u2', 4)).toBe(true);
    expect(archive.report).toBeNull();
    expect(archive.entries).toBeNull();
  });

  it('does not read twice at once', () => {
    expect(needsLoad('u1', 3)).toBe(true);
    archive.loading = true;
    expect(needsLoad('u1', 3)).toBe(false);
  });
});

describe('the questions', () => {
  it('name the round', () => {
    expect(closeText(4)).toContain('Runde 4 jetzt abschließen?');
    expect(deleteText('2')).toContain('Runde 2 mit allen Berichten');
    expect(deleteText(undefined)).toContain('Runde  mit');
  });
});
