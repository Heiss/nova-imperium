// „Admin“ and the dialogs „Neue Runde“ and „Endzeit einläuten“ render as
// before #118, bundle 7 („no visible change“ of the issue; each migration
// step changes no behaviour, owner, 2026-11-13). The old view is frozen here:
// admin(), settingsForm(), invitations(), endzeitBox(), roundDialog() and
// endzeitDialog() of src/client/views/misc.ts with the HTML of their parts. The
// box „Rundenberichte“ is the archive frozen in src/test/archive-frozen.ts
// (reference test of its own: round-archive-reference.test.ts). On generated
// states (fixed fast-check seed 118) both render the same markup, up to what
// a browser does not show (normalize() of markup.ts), and the same text in
// every line, cell and button (textContents(), which sees a space that
// normalize() cannot); hand-built cases reach the rare marks, and a test
// checks the ids, `data-act`s and classes that features/ and style.css read.
//
// The panels that fill themselves (#118, after bundle 7) are components in
// the page now: the old page left three empty elements for them and the DOM
// modules of views/admin-panel.ts filled them and painted the tab
// (`aria-selected`, `tabindex`, `hidden`, `aria-labelledby`) after the
// mount. The frozen `admin()` puts in what the browser showed then, from the
// frozen panels of admin-panels-frozen.ts, on the tab „Ereignisprotokoll“ or
// the one the test shows. The reference of the panels themselves is
// admin-panels-reference.test.ts.
//
// Where the old template put white space for its indentation (inside a
// fieldset of the dialog and around a conditional field), the text of the
// container is compared trimmed: it is no text a person sees.
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GIFT_MINUTES,
  GIFT_RESOURCES,
  GIFT_SHIPS_EACH,
} from '../core/endzeit.ts';
import {
  ROUND_SETTINGS,
  type RoundGroup,
  type RoundRules,
  type RoundSetting,
  roundFieldId,
  roundConfirm,
  roundPreview,
  roundShown,
} from '../core/round.ts';
import { DEFAULT_UNIVERSE, UNIVERSE_SPECS } from '../core/universe.ts';
import { ENDZEIT_NOTE } from '../client/logic/endzeit.ts';
import { errorRange, EVENT_FIELDS } from '../client/logic/admin-panels.ts';
import { panels } from '../client/logic/admin-panels.svelte.ts';
import { esc, fmt } from '../client/logic/format.ts';
import { gainWarning } from '../client/logic/market.ts';
import {
  archive,
  forgetArchive,
  shownArchive,
} from '../client/logic/round-archive.ts';
import type { AdminState, GameState } from '../client/logic/types.ts';
import { box, type Ui, type V } from '../client/views/common.ts';
import { adminArchiveHTML } from './archive-frozen.ts';
import { adminView, endzeitDialogView, roundDialogView } from './admin-view.ts';
import { diagnosticsPanel, errorsPanel } from './admin-panels-frozen.ts';
import { roundDefaults } from './fixtures.ts';
import { normalize, textContents } from './markup.ts';

// ----- frozen: the page and the dialogs before #118, bundle 7 -----

/** The options of a setting with named choices, the current one selected (#283). */
const choiceOptions = (
  choices: readonly { value: number; label: string }[],
  current: number,
): string =>
  choices
    .map(
      (c) =>
        `<option value="${c.value}"${c.value === current ? ' selected' : ''}>${esc(c.label)}</option>`,
    )
    .join('');

function settingsForm(s: GameState, a: AdminState): string {
  const rows = a.specs
    .map((x) => {
      const value = s.cfg[x.key];
      const hint = x.size
        ? ' – nur vergrößern, solange dort Planeten liegen'
        : '';
      // A setting of the round with named choices is a selection (#283).
      const field = x.choices
        ? `<select id="set_${x.key}" data-setting="${x.key}" data-nokeep>${choiceOptions(x.choices, Number(value))}</select>`
        : `<input type="number" id="set_${x.key}" data-setting="${x.key}" min="${x.min}" max="${x.max}" value="${value}" data-nokeep> <span class="dim">${fmt(x.min)} bis ${fmt(x.max)}${hint}</span>`;
      return `<tr><td><label for="set_${x.key}">${esc(x.label)}</label></td><td>${field}</td></tr>`;
    })
    .join('');
  const warning = gainWarning(s.cfg);
  const gain = warning
    ? `<p class="notice" role="alert">${esc(warning)}</p>`
    : '';
  return `<table class="kv">${rows}</table>${gain}<p class="dim">Änderungen wirken sofort. Laufende Bauaufträge und Flüge behalten ihre Endzeit.</p><button data-act="saveSettings">Einstellungen speichern</button>`;
}

/**
 * The link of the last invitation is no draft: a refresh that keeps the
 * inputs would put the link of the invitation before back into the field
 * (#239), so it is not kept.
 */
function invitations(ui: Ui): string {
  const link = ui.lastLink
    ? `<div class="notice mt">Einladungslink (gilt einmal, nur jetzt sichtbar):<br><input id="inv_link" class="wide" readonly value="${esc(ui.lastLink)}" aria-label="Einladungslink" data-nokeep> <button class="small" data-act="copyLink">Kopieren</button></div>`
    : '';
  return `<form id="inviteform" class="flex"><label for="inv_email">E-Mail-Adresse</label> <input id="inv_email" type="email" required autocomplete="off"> <button type="submit">Einladen</button></form>${link}<div id="admin-invitations"></div>`;
}

/** The field of one setting of the round (#283), preselected with `value`. */
function roundField(s: RoundSetting, value: number | boolean): string {
  const id = roundFieldId(s);
  const label = esc(s.label);
  if (s.kind === 'switch') {
    const note = s.note ? ` aria-describedby="${id}-note"` : '';
    return `<label><input type="checkbox" id="${id}"${note} ${value ? 'checked' : ''}> ${label}</label>`;
  }
  const field = s.choices
    ? `<select id="${id}">${choiceOptions(s.choices, Number(value))}</select>`
    : `<input type="number" id="${id}" min="${s.min}" max="${s.max}" step="1" value="${Number(value)}" required> <span class="dim">${s.min} bis ${s.max}</span>`;
  return `<label for="${id}">${label}</label> ${field}`;
}

/** One setting as its own paragraph, with the note below a checkbox. */
function roundRow(s: RoundSetting, value: number | boolean): string {
  const note =
    s.kind === 'switch' && s.note
      ? `<br>\n  <span id="${roundFieldId(s)}-note">${esc(s.note)}</span>`
      : '';
  return `<p>${roundField(s, value)}${note}</p>`;
}

/**
 * A member of a fieldset with its line break. One that is shown only while
 * another field has a value (`shownWhen`, #237) is wrapped with its break, so
 * the browser hides both together when the other field changes.
 */
function groupMember(
  s: RoundSetting,
  index: number,
  values: Readonly<Record<string, number | boolean>>,
): string {
  const field = roundField(s, values[s.name]!);
  const lead = index ? '<br>\n    ' : '\n    ';
  if (!s.shownWhen) return `${lead}${field}`;
  const hidden = roundShown(s, values) ? '' : ' hidden';
  return `<span data-round-field="${roundFieldId(s)}"${hidden}>${lead}${field}</span>`;
}

/** The preview line of a group, written again by the browser whenever a field changes. */
function groupPreview(
  group: RoundGroup,
  values: Readonly<Record<string, number | boolean>>,
  settings: readonly RoundSetting[],
): string {
  if (!group.preview) return '';
  const text = roundPreview(group, values, settings);
  return `<p class="dim" id="round-preview-${group.name}" aria-live="polite">${esc(text)}</p>`;
}

/** The confirmation lines of the groups, above the buttons (#237): the settings chosen, repeated. */
function confirmLines(
  round: RoundRules,
  settings: readonly RoundSetting[],
  fresh: Readonly<Record<string, number>>,
): string {
  const values = { ...round, ...fresh } as unknown as Record<
    string,
    number | boolean
  >;
  const groups = new Set(settings.flatMap((s) => (s.group ? [s.group] : [])));
  return [...groups]
    .filter((g) => g.legend && g.confirm)
    .map(
      (g) =>
        `\n  <p id="round-confirm-${g.name}" aria-live="polite">${esc(roundConfirm(g, values, settings))}</p>`,
    )
    .join('');
}

/**
 * The rows of the dialog „Neue Runde“, one per setting of the registry
 * (#283); the members of a group with a legend in one fieldset.
 */
function roundRows(
  round: RoundRules,
  settings: readonly RoundSetting[],
  fresh: Readonly<Record<string, number>>,
): string[] {
  const values = { ...round, ...fresh } as unknown as Record<
    string,
    number | boolean
  >;
  const rows: string[] = [];
  for (const [i, s] of settings.entries()) {
    const legend = s.group?.legend;
    if (!legend) rows.push(roundRow(s, values[s.name]!));
    else if (settings[i - 1]?.group !== s.group) {
      const members = settings
        .filter((x) => x.group === s.group)
        .map((x, k) => groupMember(x, k, values));
      rows.push(
        `<fieldset><legend>${esc(legend)}</legend>${members.join('')}${groupPreview(s.group!, values, settings)}\n  </fieldset>`,
      );
    }
  }
  return rows;
}

/**
 * The dialog „Neue Runde“, preselected with the values of the running round;
 * where it has none of its own, with what a new round starts with (`fresh`,
 * #237).
 */
export function roundDialog(
  round: RoundRules,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
  fresh: Readonly<Record<string, number>> = {},
): string {
  return `<p><b>Wirklich eine neue Runde starten?</b><br>
  Die laufende Runde wird vorher im Rundenarchiv gespeichert. Planeten, Flotten, Forschung, Nachrichten und Belohnungsfortschritt werden zurückgesetzt. Das kann nicht rückgängig gemacht werden.</p>
  ${roundRows(round, settings, fresh).join('\n  ')}${confirmLines(round, settings, fresh)}
  <p><button class="red" data-act="doReset">Ja, neue Runde</button> <button data-act="closeModal">Abbrechen</button></p>`;
}

/** The box „Endzeit“ of the tab „Universum“ (#161): once per round. */
function endzeitBox(a: AdminState): string {
  const body = a.endzeit.done
    ? `<p>${ENDZEIT_NOTE.done}</p>`
    : '<p>Jeder Spieler mit Heimatplanet erhält einmal pro Runde die Gabe des Gottkaisers als Verlegung zu seinem Heimatplaneten.</p><button class="red" data-act="endzeit">Endzeit einläuten</button>';
  return box('Endzeit', body);
}

/** The confirmation of the „Endzeit“ with its flight time (#161). */
export function endzeitDialog(minutes: number): string {
  return `<p><b>Endzeit einläuten – alle Spieler erhalten die Gabe des Gottkaisers.</b><br>
  Jeder Spieler mit Heimatplanet bekommt eine Verlegung zu seinem Heimatplaneten: je ${fmt(GIFT_SHIPS_EACH)} Schiffe jedes flugfähigen Typs und je ${fmt(GIFT_RESOURCES)} Adamant, Psikristall und Promethium. Bei der Ankunft werden Forschung und Gebäude des Heimatplaneten so weit ausgebaut, dass alles freigeschaltet ist. Das geht nur einmal pro Runde.</p>
  <p><label for="endzeit-minutes">Flugzeit der Gabe (Minuten)</label> <input type="number" id="endzeit-minutes" min="${GIFT_MINUTES.min}" max="${GIFT_MINUTES.max}" step="1" value="${minutes}" required> <span class="dim">${fmt(GIFT_MINUTES.min)} bis ${fmt(GIFT_MINUTES.max)} (72 h), in Echtzeit</span></p>
  <p><button class="red" data-act="doEndzeit">Ja, Endzeit einläuten</button> <button data-act="closeModal">Abbrechen</button></p>`;
}

export const ADMIN_TABS = {
  events: 'Ereignisprotokoll',
  players: 'Spieler',
  orders: 'Aufträge',
  errors: 'Fehler',
  reports: 'Gemeldete Nachrichten',
  invitations: 'Einladungen',
  universe: 'Universum',
  announce: 'Servernachricht',
} as const;

export type AdminTab = keyof typeof ADMIN_TABS;
export const diagnosticTab = (
  tab: string,
): tab is 'events' | 'players' | 'orders' =>
  tab === 'events' || tab === 'players' || tab === 'orders';

/** The page as a browser reads it: Svelte writes a valueless attribute as an empty one. */
const pageView = (v: V): string =>
  adminView(v).replaceAll(' data-errors-list=""', ' data-errors-list');

/** The tab the browser showed: the old panel painted it after the mount. */
let painted: AdminTab = 'events';
const NOW = 1.7e12;

/** The panels as they stand before anything is read: the new state with its defaults. */
function resetPanels(tab: AdminTab = 'events'): void {
  painted = tab;
  Object.assign(panels, {
    tab,
    fields: { ...EVENT_FIELDS },
    notice: null,
    events: null,
    stats: null,
    record: null,
    orders: null,
    errorFields: { kind: '', limit: '10' },
    range: errorRange(NOW),
    errorNotice: null,
    errors: null,
    invitations: null,
    messageReports: null,
  });
}

export function admin(v: V): string {
  const a = v.s.admin;
  if (!a) return '<h2>Admin</h2><div class="notice">Nur für den Admin.</div>';
  const shown = diagnosticTab(painted) ? 'diagnostics' : painted;
  const hide = (panel: string): string => (panel === shown ? '' : ' hidden');
  const labelled = (panel: string): string =>
    panel === shown ? ` aria-labelledby="admin-tab-${painted}"` : '';
  return `<h2>Admin</h2>
    <div role="tablist" aria-label="Admin-Bereiche" class="flex">${Object.entries(
      ADMIN_TABS,
    )
      .map(
        ([key, label]) =>
          `<button id="admin-tab-${key}" type="button" role="tab" aria-selected="${key === painted}" aria-controls="admin-panel-${diagnosticTab(key) ? 'diagnostics' : key}" tabindex="${key === painted ? 0 : -1}" data-act="adminTab" data-tab="${key}">${label}</button>`,
      )
      .join('')}</div>
    <section id="admin-panel-diagnostics" role="tabpanel"${labelled('diagnostics')}${hide('diagnostics')}>${box('Diagnose und Protokoll', `<div id="admin-diagnostics">${diagnosticsPanel(v.s.players, { tab: diagnosticTab(painted) ? painted : ('none' as never) })}</div>`)}</section>
    <section id="admin-panel-errors" role="tabpanel" aria-labelledby="admin-tab-errors"${hide('errors')}>${box('Fehler', `<div id="admin-errors">${errorsPanel(NOW)}</div>`)}</section>
    <section id="admin-panel-reports" role="tabpanel" aria-labelledby="admin-tab-reports"${hide('reports')}>${box('Gemeldete Nachrichten', '<div id="admin-message-reports"></div>')}</section>
    <section id="admin-panel-invitations" role="tabpanel" aria-labelledby="admin-tab-invitations"${hide('invitations')}>${box('Einladungen', invitations(v.ui))}</section>
    <section id="admin-panel-universe" role="tabpanel" aria-labelledby="admin-tab-universe"${hide('universe')}>
      ${box('Universum', settingsForm(v.s, a))}
      ${endzeitBox(a)}
      ${box('Rundenberichte', adminArchiveHTML(shownArchive(v.s)))}
      ${box('Neue Runde', 'Alle Spieler behalten ihr Konto und bekommen einen frischen Planeten. <button class="red" data-act="reset">Neue Runde starten</button>')}
    </section>
    <section id="admin-panel-announce" role="tabpanel" aria-labelledby="admin-tab-announce"${hide('announce')}>${box(
      'Servernachricht',
      '<p>Die Nachricht geht an alle Spieler und per Push an Geräte mit aktivierten Benachrichtigungen.</p><form id="announceform"><label for="announce-text">Nachricht</label><br><textarea id="announce-text" maxlength="500" rows="4" required></textarea><p><button type="submit">An alle senden</button></p></form>',
    )}</section>`;
}

// ----- the comparison -----

const SPECS = UNIVERSE_SPECS;

const PLAYERS = { u1: { name: 'Sturm' }, u2: { name: 'a<b>&"c\'' } };

/** The setting values of a universe: every spec at a value inside its range. */
const universe = fc
  .tuple(...SPECS.map((s) => fc.integer({ min: s.min, max: s.max })))
  .map(
    (values) =>
      Object.fromEntries(SPECS.map((s, i) => [s.key, values[i]])) as Record<
        string,
        number
      >,
  );

const links = fc.constantFrom(
  undefined,
  null,
  'https://x/#invite=abc',
  'https://x/?a=1&b="2"#invite=<z>',
);

const MARKETS = [
  {},
  { roundMarketMc: 501 },
  { roundMarketMc: 1000, roundMarketCd: 900 },
];

const adminState = fc
  .record({
    cfg: universe,
    market: fc.constantFrom(...MARKETS),
    specs: fc.subarray([...SPECS]),
    endzeit: fc.record({ minutes: fc.nat(5000), done: fc.boolean() }),
    link: links,
    admin: fc.boolean(),
    archive: fc.constantFrom('loading', 'list', 'error'),
  })
  .map((x): { v: V; archived: boolean } => ({
    archived: x.archive !== 'loading',
    v: {
      s: {
        me: { id: 'u_me' },
        players: PLAYERS,
        round: { number: 4 },
        cfg: { ...DEFAULT_UNIVERSE, ...x.cfg, ...x.market },
        admin: x.admin
          ? ({
              specs: x.specs,
              endzeit: x.endzeit,
              fresh: {},
            } satisfies AdminState)
          : null,
      } as unknown as GameState,
      ui: { lastLink: x.link },
    } as unknown as V,
  }));

/** The archive the page shows: what was read for this account and round. */
function readArchive(kind: 'list' | 'error' | 'loading'): void {
  forgetArchive();
  if (kind === 'loading') return;
  Object.assign(archive, {
    user: 'u_me',
    round: 4,
    entries: [],
    ...(kind === 'error' ? { error: 'Das Archiv <ist> nicht da.' } : {}),
  });
}

beforeEach(() => resetPanels());
afterEach(() => forgetArchive());

/** The text of every line, cell and button, the white space of the old template trimmed where it holds containers. */
const texts = (html: string): string[] =>
  textContents(html).map((t) =>
    /^(fieldset|span|label|p|div|form):/.test(t)
      ? t.replace(/ +$/, '').replace(/^(div|form): +/, '$1: ')
      : t,
  );

/**
 * The same for the dialog „Neue Runde“: the old template put a line break and
 * its indentation between the members of a fieldset and before a note, which
 * a browser does not show, so the text of a fieldset, a paragraph or a
 * wrapper is compared without spaces; every label, field, legend and note is
 * compared exactly.
 */
const dialogTexts = (html: string): string[] =>
  textContents(html).map((t) =>
    /^(fieldset|span|p):/.test(t) ? t.replaceAll(' ', '') : t,
  );

const base = (over: Partial<AdminState> = {}, ui: Partial<Ui> = {}): V =>
  ({
    s: {
      me: { id: 'u_me' },
      players: PLAYERS,
      round: { number: 4 },
      cfg: { ...DEFAULT_UNIVERSE },
      admin: {
        specs: UNIVERSE_SPECS.filter((s) => s.key !== 'galaxies'),
        endzeit: { minutes: 240, done: false },
        fresh: {},
        ...over,
      },
    },
    ui: { ...ui },
  }) as unknown as V;

const HAND_BUILT: [string, () => V][] = [
  ['a plain admin', () => base()],
  ['no admin data', () => ({ ...base(), s: { ...base().s, admin: null } })],
  ['a used-up Endzeit', () => base({ endzeit: { minutes: 90, done: true } })],
  [
    'the link of an invitation with characters of markup',
    () => base({}, { lastLink: 'https://x/#invite=<a>&"b"' }),
  ],
  [
    'a round trip that gains',
    () => {
      const v = base();
      Object.assign(v.s.cfg, { roundMarketMc: 501 });
      return v;
    },
  ],
  [
    'the archive loaded, with a refusal',
    () => {
      readArchive('error');
      return base();
    },
  ],
  [
    'the archive loaded',
    () => {
      readArchive('list');
      return base();
    },
  ],
];

describe('Admin against the view before #118, bundle 7', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(adminState, ({ v, archived }) => {
        readArchive(archived ? 'list' : 'loading');
        expect(normalize(pageView(v))).toBe(normalize(admin(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('keeps the text of every line, cell and button as before', () => {
    fc.assert(
      fc.property(adminState, ({ v, archived }) => {
        readArchive(archived ? 'error' : 'loading');
        expect(texts(pageView(v))).toEqual(texts(admin(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, make] of HAND_BUILT) {
      forgetArchive();
      const v = make();
      expect(normalize(pageView(v)), name).toBe(normalize(admin(v)));
      expect(texts(pageView(v)), name).toEqual(texts(admin(v)));
    }
  });

  it('keeps the ids, marks and classes that features/ and the panel read', () => {
    const html = pageView(base({}, { lastLink: 'https://x/#invite=a' }));
    for (const mark of [
      'role="tablist"',
      'id="admin-tab-events"',
      'data-act="adminTab"',
      'data-tab="universe"',
      'id="admin-panel-diagnostics"',
      'id="admin-diagnostics"',
      'id="admin-errors"',
      'id="admin-invitations"',
      'id="inviteform"',
      'id="inv_email"',
      'id="inv_link"',
      'data-act="copyLink"',
      'data-setting="speed"',
      'id="set_speed"',
      'data-act="saveSettings"',
      'data-act="endzeit"',
      'data-act="roundClose"',
      'data-act="reset"',
      'id="announceform"',
      'id="announce-text"',
    ])
      expect(html, mark).toContain(mark);
    // The fields of the settings and of the invitation link have no field draft
    // (logic/field-drafts.ts); the page carries no `data-nokeep` any more.
    expect(html).toMatch(/id="set_speed"/);
    expect(html).toMatch(/id="inv_link"/);
    expect(html).not.toContain('data-nokeep');
    // The address typed into the invitation form is a draft: a redraw by the
    // poll of the state (another player registered) must not empty it, or the
    // click on „Einladen“ finds an empty required field and sends nothing.
    expect(html).toMatch(/id="inv_email"/);
    // The tabs are all there, one per name, the first one selected.
    expect(html.match(/role="tab"/g)).toHaveLength(
      Object.keys(ADMIN_TABS).length,
    );
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/id="admin-tab-events"[^>]*aria-selected="true"/);
  });

  it('shows the panel of the tab, as the panel painted it before', () => {
    for (const tab of Object.keys(ADMIN_TABS) as AdminTab[]) {
      resetPanels(tab);
      const v = base({}, { lastLink: 'https://x/#invite=a' });
      expect(normalize(pageView(v)), tab).toBe(normalize(admin(v)));
      const html = pageView(v);
      expect(html.match(/aria-selected="true"/g), tab).toHaveLength(1);
    }
  });
});

// ----- the dialog „Neue Runde“ -----

/** A value inside the range of a setting of the round. */
const roundValue = (s: RoundSetting): fc.Arbitrary<number | boolean> =>
  s.kind === 'switch'
    ? fc.boolean()
    : s.choices
      ? fc.constantFrom(...s.choices.map((c) => c.value))
      : fc.integer({ min: s.min, max: s.max });

const rounds = fc.tuple(...ROUND_SETTINGS.map(roundValue)).map(
  (values) =>
    ({
      number: 1,
      ...Object.fromEntries(ROUND_SETTINGS.map((s, i) => [s.name, values[i]])),
    }) as unknown as RoundRules,
);

/** What a new round starts with where the running one has no value of its own (#237). */
const fresh = fc.constantFrom<Record<string, number>>(
  {},
  { colonyBase: 6 },
  { colonyBase: 0, colonyPerLevel: 3 },
);

const defaults = (): RoundRules =>
  ({ number: 1, ...roundDefaults() }) as RoundRules;

describe('the dialog „Neue Runde“ against the HTML before #118, bundle 7', () => {
  it('renders the dialog as before', () => {
    fc.assert(
      fc.property(rounds, fresh, (round, news) => {
        expect(normalize(roundDialogView(round, ROUND_SETTINGS, news))).toBe(
          normalize(roundDialog(round, ROUND_SETTINGS, news)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('keeps the text of every line, cell and button as before', () => {
    fc.assert(
      fc.property(rounds, fresh, (round, news) => {
        expect(
          dialogTexts(roundDialogView(round, ROUND_SETTINGS, news)),
        ).toEqual(dialogTexts(roundDialog(round, ROUND_SETTINGS, news)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  // A registry with what the real one has only in part: a switch with a note
  // inside a group, a field shown only while another one has a value, a group
  // with a preview, a selection in a group.
  const group: RoundGroup = {
    name: 'test',
    legend: 'Probe',
    preview: (v) => `Vorschau: ${v.testHours ?? '-'}`,
  };
  const CUSTOM: readonly RoundSetting[] = [
    {
      kind: 'switch',
      key: 'roundTestOn',
      name: 'testOn',
      label: 'Probe an',
      order: 1,
      def: true,
      refusal: 'x',
      note: 'Dazu <ein> Satz.',
    },
    {
      kind: 'number',
      key: 'roundTestHours',
      name: 'testHours',
      label: 'Probedauer',
      order: 2,
      min: 1,
      max: 9,
      def: 4,
      group,
    },
    {
      kind: 'number',
      key: 'roundTestMode',
      name: 'testMode',
      label: 'Probeart',
      order: 3,
      min: 0,
      max: 1,
      def: 0,
      group,
      shownWhen: { name: 'testHours', value: 4 },
      choices: [
        { value: 0, label: 'klein <x>' },
        { value: 1, label: 'groß' },
      ],
    },
    {
      kind: 'switch',
      key: 'roundTestNote',
      name: 'testNote',
      label: 'Mit Notiz',
      order: 4,
      def: false,
      refusal: 'x',
      note: 'Notiz in der Gruppe.',
      group,
    },
    {
      kind: 'number',
      key: 'roundTestSolo',
      name: 'testSolo',
      label: 'Allein',
      order: 5,
      min: 0,
      max: 5,
      def: 2,
      shownWhen: { name: 'testHours', value: 4 },
    },
  ];
  const custom = (over: Record<string, number | boolean> = {}): RoundRules =>
    ({
      number: 1,
      testOn: true,
      testHours: 4,
      testMode: 1,
      testNote: true,
      testSolo: 3,
      ...over,
    }) as unknown as RoundRules;

  const CASES: [string, () => [RoundRules, readonly RoundSetting[]]][] = [
    ['the defaults of the registry', () => [defaults(), ROUND_SETTINGS]],
    ['a custom registry', () => [custom(), CUSTOM]],
    [
      'a conditional field that is hidden, and a switch that is off',
      () => [custom({ testHours: 3, testOn: false, testNote: false }), CUSTOM],
    ],
    [
      'the colony research off',
      () => [{ ...defaults(), colonyResearch: 0 }, ROUND_SETTINGS],
    ],
    [
      'guilds off and the marketplace off',
      () => [{ ...defaults(), guilds: false, marketOn: 0 }, ROUND_SETTINGS],
    ],
  ];

  it('renders the hand-built cases as before', () => {
    for (const [name, make] of CASES) {
      const [round, settings] = make();
      expect(normalize(roundDialogView(round, settings)), name).toBe(
        normalize(roundDialog(round, settings)),
      );
      expect(dialogTexts(roundDialogView(round, settings)), name).toEqual(
        dialogTexts(roundDialog(round, settings)),
      );
    }
  });

  it('keeps the ids, marks and classes that features/round.ts reads', () => {
    const html = roundDialogView(defaults());
    for (const mark of [
      'data-act="doReset"',
      'data-act="closeModal"',
      'data-round-field="round-colony-per-level"',
      'id="round-preview-colonies"',
      'id="round-confirm-colonies"',
      'aria-live="polite"',
      'id="round-guilds-note"',
      'aria-describedby="round-guilds-note"',
    ])
      expect(html, mark).toContain(mark);
    const hidden = roundDialogView({ ...defaults(), colonyResearch: 0 });
    expect(hidden).toMatch(
      /data-round-field="round-colony-per-level"[^>]*hidden/,
    );
    expect(
      ROUND_SETTINGS.every((s) => html.includes(` id="${roundFieldId(s)}"`)),
    ).toBe(true);
  });
});

describe('the dialog „Endzeit einläuten“ against the HTML before #118, bundle 7', () => {
  it('renders the dialog as before', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 10_000 }), (minutes) => {
        expect(normalize(endzeitDialogView(minutes))).toBe(
          normalize(endzeitDialog(minutes)),
        );
        expect(textContents(endzeitDialogView(minutes))).toEqual(
          textContents(endzeitDialog(minutes)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('keeps the ids and marks that features/admin.ts reads', () => {
    const html = endzeitDialogView(240);
    for (const mark of [
      'id="endzeit-minutes"',
      'data-act="doEndzeit"',
      'data-act="closeModal"',
    ])
      expect(html, mark).toContain(mark);
  });
});
