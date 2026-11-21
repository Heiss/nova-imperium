import { beforeEach, describe, expect, it } from 'vitest';
import { ROUND_SETTINGS, type RoundSetting } from '../../core/round.ts';
import type {
  HistoryEntry,
  ParticipantReport,
  ReportRow,
  RoundEntry,
  RoundReport,
} from '../../core/round-report.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { fmt } from './format.ts';
import {
  archive,
  archivePage,
  closeText,
  deleteText,
  forgetArchive,
  needsLoad,
  participantPage,
  reportPage,
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
    const page = reportPage(report(), 'total');
    expect(page.heading).toBe('Runde 3');
    expect(page.facts).toEqual([
      ['Zeitraum', '1.11.2026 bis 20.11.2026 · 19 Tage'],
      ['Teilnehmer', '3'],
      ['Erfassung', 'vollständig ab Rundenbeginn'],
      ['Dein Platz', '2 von 3 · 8.400 Punkte'],
    ]);
    expect(page.banner).toBeNull();
  });

  it('names one day in the singular and leaves out the own place of a spectator', () => {
    const r = { ...report({ days: 1 }), you: null };
    const page = reportPage(r, 'total');
    expect(page.facts[0]![1]).toContain('· 1 Tag');
    expect(page.facts.map(([name]) => name)).not.toContain('Dein Platz');
  });

  it('marks the own row and lists the players best first', () => {
    const rows = reportPage(report(), 'total').rows;
    expect(rows.map((x) => [x.place, x.name, x.me])).toEqual([
      [1, 'Lea', false],
      [2, 'Vex (du)', true],
      [3, 'Nox', false],
    ]);
  });

  it('ranks by the chosen category and names it in the header', () => {
    const page = reportPage(report(), 'buildings');
    expect(page.rows.map((x) => x.name)).toEqual(['Nox', 'Vex (du)', 'Lea']);
    expect(page.column).toBe('Gebäude');
    expect(page.categories.filter((c) => c.pressed).map((c) => c.key)).toEqual([
      'buildings',
    ]);
    expect(page.categories).toHaveLength(5);
  });

  it('shows the economy as an unweighted sum and says so', () => {
    const page = reportPage(report(), 'total');
    expect(page.rows[0]!.economy).toBe('1.750');
    expect(page.note).toContain('ungewichtet');
  });

  it('marks the provisional report of the admin and its time', () => {
    const page = reportPage(
      report({ provisional: true, closed: null }),
      'total',
    );
    expect(page.banner).toContain('VORLÄUFIG · nur Spielleitung');
    expect(page.banner).toContain('nicht veröffentlicht');
    expect(page.heading).toBe('Runde 3 (vorläufig)');
  });

  it('says that the early course is missing for a partial round', () => {
    expect(
      reportPage(report({ coverage: 'partial' }), 'total').facts[2]![1],
    ).toContain('ihr früher Verlauf fehlt');
  });

  it('shows the guild of a player and the table of the guilds, as plain text for the component to escape', () => {
    const r = report();
    r.rows[0] = row(1, '<img src=x>', 5, {
      guild: { tag: '<b>', name: '"x"' },
    });
    r.guilds = [{ tag: '<b>', name: '<i>', members: 1, points: 5 }];
    const page = reportPage(r, 'total');
    expect(page.rows.map((x) => x.name)).toContain('<img src=x>');
    expect(page.rows.map((x) => x.guild)).toContain('[<b>] "x"');
    expect(page.guilds).toEqual([
      { name: '[<b>] <i>', members: '1', points: '5' },
    ]);
  });

  it('leaves out the guild table without guilds and names the missing playtime', () => {
    const page = reportPage(report(), 'total');
    expect(page.guilds).toEqual([]);
    expect(page.playtime).toBe(false);
    expect(page.playtimeNote).toEqual({
      block: 'p',
      text: 'Spielzeit: in diesem Archiv noch nicht erfasst.',
    });
    expect(page.rows.every((x) => x.played === null)).toBe(true);
  });

  it('shows the playtime as a column once there is playtime, 0 Min. as a measured zero, - for a seat without a value', () => {
    const r = { ...report(), playtime: { 1: 3600000 + 5 * 60000, 2: 0 } };
    const page = reportPage(r, 'total');
    expect(page.playtime).toBe(true);
    expect(page.rows.map((x) => x.played)).toEqual([
      '1 Std. 05 Min.',
      '0 Min.',
      '-',
    ]);
    expect(page.playtimeNote).toEqual({
      block: 'div',
      text: 'Spielzeit: geschätzte aktive Zeit in dieser Runde, gleichzeitig geöffnete Fenster zählen einmal.',
    });
  });

  it('says that the time before the measurement is missing in a partly covered round', () => {
    const r = report({ coverage: 'partial' });
    expect(
      reportPage({ ...r, playtime: { 1: 0, 2: 0, 3: 0 } }, 'total').playtimeNote
        ?.text,
    ).toContain('Die Zeit vor Beginn der Erfassung fehlt.');
  });

  it('says that a provisional report shares no play time, and shows no line for a round without participants', () => {
    const page = reportPage(report({ provisional: true }), 'total');
    expect(page.playtimeNote?.text).toBe(
      'Spielzeit: wird erst nach Rundenende im Archiv geteilt.',
    );
    expect(page.playtime).toBe(false);
    expect(reportPage({ ...report(), rows: [] }, 'total').playtimeNote).toBe(
      null,
    );
  });

  it('lists the settings that differed', () => {
    const sw = ROUND_SETTINGS.find((s) => s.kind === 'switch')!;
    const page = reportPage(
      report({ rules: { [sw.name]: sw.kind === 'switch' ? !sw.def : 0 } }),
      'total',
    );
    expect(page.rules).toEqual([expect.stringContaining(`${sw.label}:`)]);
    expect(reportPage(report(), 'total').rules).toEqual([]);
  });
});

describe('the list of rounds', () => {
  const list = (admin = false) => {
    const page = archivePage({ ...archive }, admin);
    return page.body.kind === 'list' ? page.body.rounds : null;
  };

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
    expect(list()).toEqual([
      {
        number: 4,
        span: expect.stringMatching(/^seit /),
        status: 'Nach Rundenende verfügbar',
        open: false,
        rewind: false,
        remove: false,
      },
    ]);
  });

  it('opens a finished round with its place', () => {
    archive.entries = [entry({ number: 3 })];
    expect(list()).toEqual([
      {
        number: 3,
        span: '1.10.2026 bis 31.10.2026',
        status: 'Platz 2 von 3 · 8.400 Punkte',
        open: true,
        rewind: true,
        remove: false,
      },
    ]);
  });

  it('says so for an empty archive and while it loads', () => {
    expect(archivePage({ ...archive }).body).toEqual({ kind: 'loading' });
    archive.entries = [];
    expect(list()).toEqual([]);
  });

  it('shows a refusal in place of the list', () => {
    archive.entries = [];
    archive.error = 'Nicht <da>';
    const page = archivePage({ ...archive });
    expect(page.body).toEqual({ kind: 'error', message: 'Nicht <da>' });
    expect(page.intro).toBe(false);
  });

  it('shows the open report instead of the list', () => {
    archive.entries = [entry({})];
    archive.report = report();
    const page = archivePage({ ...archive });
    expect(page.body.kind).toBe('report');
    expect(page.intro).toBe(false);
  });

  it('shows the history below the list', () => {
    archive.entries = [entry({})];
    archive.history = [];
    const page = archivePage({ ...archive });
    expect(page.body).toMatchObject({ kind: 'list', history: [] });
    expect(page.intro).toBe(true);
  });
});

describe('the box of the admin', () => {
  it('has „Runde abschließen“ at any time except above a report', () => {
    expect(archivePage({ ...archive }, true).close).toBe(true);
    archive.entries = [];
    expect(archivePage({ ...archive }, true).close).toBe(true);
    archive.error = 'x';
    expect(archivePage({ ...archive }, true).close).toBe(true);
    archive.report = report();
    expect(archivePage({ ...archive }, true).close).toBe(false);
    expect(archivePage({ ...archive }).close).toBe(false);
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
    const body = archivePage({ ...archive }, true).body;
    const rounds = body.kind === 'list' ? body.rounds : [];
    expect(rounds[0]).toMatchObject({
      status: 'läuft · VORLÄUFIG · nur Spielleitung',
      open: true,
      remove: false,
    });
    expect(rounds.filter((x) => x.open)).toHaveLength(2);
    expect(rounds.filter((x) => x.remove).map((x) => x.number)).toEqual([4]);
  });

  it('offers the Rewind only for a finished round the reader took part in', () => {
    archive.entries = [
      entry({
        number: 6,
        status: 'active',
        closed: null,
        locked: true,
        you: null,
      }),
      entry({ number: 5, status: 'active', closed: null, you: null }),
      entry({ number: 4, you: null }),
      entry({ number: 3 }),
    ];
    const body = archivePage({ ...archive }, true).body;
    const rounds = body.kind === 'list' ? body.rounds : [];
    expect(rounds.filter((x) => x.rewind).map((x) => x.number)).toEqual([3]);
  });

  it('shows the Rewind in the place of the list, before nothing else, and a report before it', () => {
    archive.entries = [entry({ number: 3 })];
    archive.rewind = { round: 3, cards: [] };
    const shown = archivePage({ ...archive }, true);
    expect(shown.body).toMatchObject({ kind: 'rewind', rewind: { round: 3 } });
    expect(shown.close).toBe(false);
    expect(shown.intro).toBe(false);
    archive.report = report();
    expect(archivePage({ ...archive }).body.kind).toBe('report');
  });

  it('names the participants of a round the admin did not play', () => {
    archive.entries = [entry({ you: null, participants: 7 })];
    const body = archivePage({ ...archive }, true).body;
    expect(body.kind === 'list' && body.rounds[0]!.status).toBe('7 Teilnehmer');
  });

  it('shows the open report', () => {
    archive.report = report();
    expect(archivePage({ ...archive }, true).body.kind).toBe('report');
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
  const rows = (...history: HistoryEntry[]) => {
    archive.entries = [];
    archive.history = history;
    const body = archivePage({ ...archive }).body;
    return body.kind === 'list' ? body.history : [];
  };

  it('is empty without a round', () => {
    expect(rows()).toEqual([]);
  });

  it('puts the rounds side by side with length, winner and the own values', () => {
    expect(rows(h())).toEqual([
      {
        number: 2,
        days: 12,
        participants: 5,
        winner: 'Lea (9.100)',
        place: '2 von 5',
        points: '8.400',
        economy: '6',
        planets: '4',
        settings: 'Voreinstellung',
      },
    ]);
  });

  it('shows a dash for a round without own values or winner and marks a partial one', () => {
    expect(
      rows(h({ you: null, winner: null, coverage: 'partial' })),
    ).toMatchObject([
      {
        winner: '-',
        place: '-',
        points: '-',
        economy: '-',
        planets: '-',
        settings: 'Voreinstellung · Verlauf lückenhaft',
      },
    ]);
  });

  it('names a setting that differed', () => {
    const sw = ROUND_SETTINGS.find((s) => s.kind === 'switch')!;
    const [first] = rows(
      h({ rules: { [sw.name]: sw.kind === 'switch' ? !sw.def : 0 } }),
    );
    expect(first!.settings).toContain(sw.label);
    expect(first!.settings).not.toContain('Voreinstellung');
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

describe('view H: the provisional report and the drilldown of the admin (#235)', () => {
  const provisional = report({ provisional: true, closed: null });

  it('offers „Vorschau aktualisieren“ for a provisional report only', () => {
    expect(reportPage(provisional, 'total', true).refresh).toBe(3);
    expect(reportPage(report(), 'total', true).refresh).toBeNull();
  });

  it('offers the drilldown to the admin only, with the seat of each row', () => {
    const admin = reportPage(report(), 'total', true);
    expect(admin.detail).toBe(true);
    expect(admin.rows.map((r) => r.seat)).toEqual([1, 2, 3]);
    expect(reportPage(report(), 'total').detail).toBe(false);
    expect(reportPage(report(), 'total', false).detail).toBe(false);
  });

  const person = (
    over: Partial<ParticipantReport> = {},
  ): ParticipantReport => ({
    round: { number: 3, provisional: false, asOf: Date.UTC(2026, 10, 20, 12) },
    seat: 2,
    name: 'Vex',
    guild: { tag: 'ABC', name: 'Die Alten' },
    valuation: {
      total: 8400,
      buildings: 5000,
      research: 1000,
      fleet: 2000,
      defense: 400,
    },
    economy: { m: 1000, c: 500, d: 250 },
    research: { energy: 3, laser: 0 },
    places: [
      {
        kind: 'planet',
        g: 1,
        s: 2,
        p: 3,
        b: { metal: 12 },
        ships: { lc: 8 },
        def: {},
      },
      { kind: 'moon', g: 1, s: 2, p: 3, b: {}, ships: {}, def: { rocket: 20 } },
    ],
    flying: { lc: 2 },
    vacation: false,
    playtime: 3600000,
    ...over,
  });

  it('shows all facts of one participant and each place with what stood there', () => {
    const page = participantPage(person());
    expect(page.heading).toBe('Runde 3 · Vex');
    expect(page.banner).toBeNull();
    const facts = Object.fromEntries(page.facts);
    expect(facts['Gilde']).toBe('[ABC] Die Alten');
    expect(facts['Punkte gesamt']).toBe(fmt(8400));
    expect(facts['Wirtschaft/h']).toBe(
      'Adamant 1.000 · Psikristall 500 · Promethium 250',
    );
    expect(facts['Urlaubsmodus']).toBe('nein');
    expect(facts['Spielzeit']).toBe('1 Std. 00 Min.');
    // A research without a level is not listed.
    expect(facts['Forschungsstufen']).not.toContain('0');
    expect(page.places.map((x) => x.where)).toEqual([
      'Planet 1:2:3',
      'Mond 1:2:3',
    ]);
    expect(page.places[1]).toMatchObject({ buildings: '-', ships: '-' });
    expect(page.places[1]!.defense).toContain('20');
  });

  it('marks a participant of the running round as provisional and says that the play time is not shared yet', () => {
    const page = participantPage(
      person({
        round: {
          number: 3,
          provisional: true,
          asOf: Date.UTC(2026, 10, 20, 12),
        },
        playtime: null,
      }),
    );
    expect(page.heading).toBe('Runde 3 · Vex (vorläufig)');
    expect(page.banner).toContain('VORLÄUFIG · nur Spielleitung');
    expect(Object.fromEntries(page.facts)['Spielzeit']).toBe(
      'wird erst nach Rundenende im Archiv geteilt',
    );
  });

  it('shows the drilldown instead of the report, without the button to close the round', () => {
    forgetArchive();
    archive.report = provisional;
    archive.participant = person();
    const body = archivePage(archive, true);
    expect(body.body.kind).toBe('participant');
    expect(body.close).toBe(false);
    forgetArchive();
  });
});
