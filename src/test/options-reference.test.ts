// „Optionen“ renders as before #118, bundle 5, second part („no visible
// change“ of the issue; each migration step changes no behaviour, owner,
// 2026-11-13). The old view is frozen here: help() of
// src/client/views/misc.ts with the HTML of its boxes (the choices of the
// options, the main planet, the vacation mode, the place of the play time,
// the push kinds, the account boxes) as the views and the logic left them.
// The box „Rundenarchiv“ is the archive frozen in src/test/archive-frozen.ts
// (it has its own reference test since bundle 7), and the form „Problem
// melden“ calls the code that is still shared (reportFormHTML() of logic/error-report.ts, which the
// dialog behind an error message uses). On generated states (fixed
// fast-check seed 118) both render the same markup, up to what a browser
// does not show (normalize() of markup.ts); hand-built cases reach the rare
// marks, and a test checks the ids, `data-act`s and classes that features/,
// main.ts and style.css read.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { EXPLAIN_MODES } from '../core/explain.ts';
import { LEVEL_MODES, type LevelMode } from '../core/level-overview.ts';
import { mainLocked } from '../core/main-planet.ts';
import {
  GUILD_PUSH_TOPICS,
  PUSH_TOPICS,
  type PushTopic,
} from '../core/push.ts';
import type { RoundRules } from '../core/round.ts';
import { articleHref } from '../client/logic/address.ts';
import { reportFormHTML } from '../client/logic/error-report.ts';
import { explainMode } from '../client/logic/explain.ts';
import { coords, esc } from '../client/logic/format.ts';
import { lockEnd } from '../client/logic/main-planet.ts';
import { levelMode } from '../core/level-overview.ts';
import {
  archive,
  forgetArchive,
  shownArchive,
} from '../client/logic/round-archive.ts';
import { shownPushOff } from '../client/logic/push-options.ts';
import type { GameState } from '../client/logic/types.ts';
import { box, type Ui, type V } from '../client/views/common.ts';
import { archiveHTML } from './archive-frozen.ts';
import { normalize } from './markup.ts';
import { optionsView } from './options-view.ts';

// ----- frozen: „Hilfe & Optionen“ before #118, bundle 5, second part -----

const EXPLAIN_LABELS: Record<string, string> = {
  icon: 'Anzeigen',
  hidden: 'Ausblenden',
};
const explainOptionsHTML = (mode: unknown): string =>
  EXPLAIN_MODES.map(
    (m) =>
      `<option value="${m}"${m === explainMode(mode) ? ' selected' : ''}>${EXPLAIN_LABELS[m]}</option>`,
  ).join('');

const LEVEL_LABELS: Record<LevelMode, string> = {
  always: 'Immer anzeigen',
  icon: 'Als ▤-Symbol',
  hidden: 'Ausblenden',
};
const levelOptionsHTML = (mode: unknown): string =>
  LEVEL_MODES.map(
    (m) =>
      `<option value="${m}"${m === levelMode(mode) ? ' selected' : ''}>${LEVEL_LABELS[m]}</option>`,
  ).join('');

type MainState = Pick<
  GameState,
  'me' | 'galaxy' | 'round' | 'homePlanet' | 'mainPlanet' | 'mainLock'
>;
const days = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
function planetOptions(s: MainState): string {
  return s.galaxy
    .filter((p) => p.owner === s.me.id && p.kind === 'planet')
    .map((p) => {
      const home = p.id === s.homePlanet ? ' – Heimatplanet' : '';
      const selected = p.id === s.mainPlanet ? ' selected' : '';
      return `<option value="${esc(p.id)}"${selected}>${esc(p.name)} ${coords(p)}${home}</option>`;
    })
    .join('');
}
function mainPlanetHTML(s: MainState, now: number): string {
  const end = s.mainLock ?? null;
  const locked = mainLocked(end, now);
  const off = locked ? ' disabled' : '';
  const note = locked
    ? `<p id="o_main_lock">Wieder änderbar ab ${lockEnd(end!)}</p>`
    : '';
  return `<p>Der Hauptplanet ist das Ziel von „zum Heimatsystem“ auf der Sternenkarte und der Planet, den das Spiel ohne Auswahl zeigt. Nach jedem Wechsel ist die Wahl ${days(s.round.mainLock)} gesperrt.</p><div class="flex"><label for="o_main">Hauptplanet</label> <select id="o_main"${off}>${planetOptions(s)}</select> <button data-act="mainPlanet"${off}>Ändern</button></div>${note}`;
}

const hours = (n: number): string => `${n} ${n === 1 ? 'Stunde' : 'Stunden'}`;
const vacationHTML = (n: number): string =>
  `<p>Im Urlaubsmodus ruht die Produktion deiner Planeten und Monde, und du kannst nichts bauen, forschen oder Flotten senden. Andere Spieler können keine neuen Flotten zu dir schicken; bereits gestartete kommen noch an. Beenden kannst du ihn frühestens nach ${hours(n)}.</p><p>Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.</p><button data-act="startVacation">Urlaubsmodus aktivieren</button>`;

const OWN_ACTIVITY_PLACEHOLDER =
  '<div id="own-activity" aria-live="polite">Wird geladen …</div><p><button type="button" data-act="reloadOwnActivity">Aktualisieren</button></p>';

const PUSH_LABELS: Record<PushTopic, string> = {
  buildings: 'Gebäude fertig',
  research: 'Forschung abgeschlossen',
  shipyard: 'Auftrag der Schiffsschmiede abgeschlossen',
  fleet: 'Eigene Flotten: Ankunft, Bericht und Rückkehr',
  attacked: 'Sturmangriff auf deine Planeten',
  spied: 'Auspex-Aktivität bei deinen Planeten',
  delivery: 'Lieferung eines anderen Spielers',
  announcement: 'Servernachrichten',
  news: 'Neue Version',
  'guild-events': 'Gildenereignisse',
  'guild-chat': 'Nachrichten im Gilden-Chat',
};
function pushOptionsHTML(
  off: readonly string[] | undefined,
  guilds: boolean,
): string {
  const shown = guilds
    ? PUSH_TOPICS
    : PUSH_TOPICS.filter((t) => !GUILD_PUSH_TOPICS.includes(t));
  const boxes = shown.map(
    (t) =>
      `<label class="switch"><input type="checkbox" id="push_${t}" data-chg="push" data-k="${t}"${off?.includes(t) ? '' : ' checked'}> ${PUSH_LABELS[t]}</label>`,
  );
  return `<fieldset class="push-kinds"><legend>Welche Meldungen per Push kommen</legend>${boxes.join('')}</fieldset>`;
}
const pushKindsHTML = (
  webPush: boolean | undefined,
  off: readonly string[] | undefined,
  guilds: boolean,
): string =>
  webPush === true
    ? `<p>Gilt für alle deine Geräte mit aktivierten Browser-Benachrichtigungen. Eine Änderung wird sofort gespeichert.</p>${pushOptionsHTML(off, guilds)}`
    : '';

const passwordMinimum = (ui: Ui): string =>
  ui.passwordMinLength === undefined
    ? ''
    : `minlength="${ui.passwordMinLength}"`;
const pushKindsBox = (s: Pick<GameState, 'me' | 'round'>, ui: Ui): string => {
  const kinds = pushKindsHTML(
    ui.webPush,
    shownPushOff(ui, s.me.pushOff),
    s.round.guilds,
  );
  return kinds ? box('Benachrichtigungen', kinds) : '';
};
const passwordBox = (ui: Ui): string =>
  box(
    'Passwort ändern',
    `<form id="passwordform" class="flex">
 <label for="pw_current">Bisheriges Passwort</label> <input id="pw_current" type="password" autocomplete="current-password" required>
 <label for="pw_next">Neues Passwort</label> <input id="pw_next" type="password" autocomplete="new-password" ${passwordMinimum(ui)} required>
 <label for="pw_confirm">Neues Passwort wiederholen</label> <input id="pw_confirm" type="password" autocomplete="new-password" ${passwordMinimum(ui)} required>
 <button type="submit">Passwort ändern</button></form>`,
  );
const passkeysBox = (): string =>
  box(
    'Passkeys',
    '<p>Auf unterstützten Geräten kannst du dich mit einem Passkey anmelden.</p><form id="passkeyform" class="flex"><label for="passkey-password">Passwort für neuen Passkey</label><input id="passkey-password" type="password" autocomplete="current-password" required><button type="submit">Passkey hinzufügen</button></form><p><button type="button" data-act="listPasskeys">Gespeicherte Passkeys anzeigen</button></p><div id="passkey-list"></div>',
  );
const notificationBoxes = (
  s: Pick<GameState, 'me' | 'round'>,
  ui: Ui,
): string =>
  `${pushKindsBox(s, ui)}
 ${box('Browser-Benachrichtigungen', '<p>Meldungen zu Aufträgen, Flotten und neuen Nachrichten auf diesem Gerät.</p><button data-act="pushEnable">Aktivieren</button> <button data-act="pushDisable">Deaktivieren</button>')}`;
const guildNote = (round: RoundRules, sentence: string): string =>
  round.guilds ? ` ${sentence}` : '';
const deleteAccountBox = (round: RoundRules): string =>
  box(
    'Account löschen',
    `<p>Dein Konto und deine Spielstände werden dauerhaft gelöscht.${guildNote(round, 'Leitest du eine Gilde, wird sie aufgelöst.')}</p><button type="button" class="red" data-act="deleteAccount">Account löschen</button>`,
  );

// The link is frozen with its & written as &amp; (the HTML view wrote it raw):
// a browser reads both as the same address; Svelte writes the escaped one.
const UNIVERSE_ARTICLE = 'rule-universe';

const help = (v: V): string => `<h2>Optionen</h2>
 ${box('Optionen', `<div class="flex">Spähschädel pro Auspex-Erkundung von der Sternenkarte: <input type="number" id="o_probes" min="1" value="${v.s.me.probes || 1}" aria-label="Spähschädel pro Auspex-Erkundung"></div><div class="flex mt"><label for="o_explain">(?)-Symbol:</label> <select id="o_explain">${explainOptionsHTML(v.s.me.explain)}</select></div><div class="flex mt"><label for="o_levels">Stufenübersicht:</label> <select id="o_levels">${levelOptionsHTML(v.s.me.levelTable)}</select></div><p><button data-act="saveopt">Speichern</button></p>`)}
 ${box('Hauptplanet', mainPlanetHTML(v.s, v.now))}
 ${box('Urlaubsmodus', vacationHTML(v.s.round.vacationHours))}
 ${box('Meine Aktivität &amp; Spielzeit', OWN_ACTIVITY_PLACEHOLDER)}
 ${box('Rundenarchiv', archiveHTML(shownArchive(v.s)))}
 ${box('Darstellung', `<label class="switch"><input type="checkbox" id="o_anim" ${v.ui.animations ? 'checked' : ''}> Animationen</label><p class="dim">Planeten drehen sich, Wolken ziehen. Gilt für dieses Gerät; ist im System „Bewegung reduzieren“ eingestellt, bleibt alles ruhig.</p>`)}
 ${passwordBox(v.ui)}
 ${passkeysBox()}
 ${box('App installieren', '<p>Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Auf iPhone und iPad öffne Nova Imperium in Safari, tippe auf „Teilen“ und wähle „Zum Home-Bildschirm“ und „Als Web-App öffnen“. Zum Spielen brauchst du eine Internetverbindung.</p><button data-act="installApp" id="pwa-install" hidden>App installieren</button>')}
 ${notificationBoxes(v.s, v.ui)}
 ${box(
   'Problem melden',
   reportFormHTML('reportform', {
     source: 'form',
     page: v.ui.view,
     version: v.ui.news?.version ?? '',
     requestId: v.ui.lastRequestId ?? null,
   }),
 )}
 ${deleteAccountBox(v.s.round)}
 <p>Tempo, Größe und alle Einstellungen dieser Runde stehen im Lexicanum: <a class="lx-a" href="${esc(articleHref(UNIVERSE_ARTICLE))}" data-act="lex" data-a="${UNIVERSE_ARTICLE}">Dieses Universum</a>.</p>`;

// ----- the comparison -----

const NOW = Date.UTC(2026, 10, 19, 12, 0);
const IDS = ['u_a', 'u_b', 'u_me'] as const;
/** What a name may hold that is not plain text. */
const NAMES = [
  'Heimat',
  'Kolonie <1>',
  'Cleo & Co',
  'D"ora',
  "Emil's",
  'a > b',
];

/** A planet or a moon, of the player or of another, a moon sometimes first. */
const place = fc.record({
  owner: fc.constantFrom(...IDS),
  kind: fc.constantFrom('planet' as const, 'moon' as const),
  name: fc.constantFrom(...NAMES),
  g: fc.integer({ min: 1, max: 4 }),
  s: fc.integer({ min: 1, max: 40 }),
  p: fc.integer({ min: 1, max: 15 }),
});

const topics = fc.subarray([...PUSH_TOPICS]);

const state = fc
  .record({
    places: fc.array(place, { maxLength: 8 }),
    home: fc.nat(8),
    main: fc.option(fc.nat(8), { nil: undefined }),
    lock: fc.constantFrom(
      undefined,
      null,
      NOW - 1000,
      NOW,
      NOW + 3_600_000,
      NOW + 7 * 86_400_000,
    ),
    me: fc.record({
      probes: fc.constantFrom(undefined, 0, 1, 3, 250),
      explain: fc.constantFrom(undefined, ...EXPLAIN_MODES, 'always', 'x'),
      levelTable: fc.constantFrom(undefined, ...LEVEL_MODES, 'x'),
      pushOff: fc.option(topics, { nil: undefined }),
    }),
    round: fc.record({
      mainLock: fc.constantFrom(1, 3, 7),
      vacationHours: fc.constantFrom(1, 2, 24, 48),
      guilds: fc.boolean(),
    }),
    ui: fc.record({
      animations: fc.boolean(),
      passwordMinLength: fc.constantFrom(undefined, 8, 12),
      webPush: fc.constantFrom(undefined, true, false),
      pushChoice: fc.option(topics, { nil: undefined }),
      view: fc.constantFrom('help', 'other <x>', 'a"b'),
      version: fc.constantFrom(undefined, '1.2.3', '2.0 <b>'),
      lastRequestId: fc.constantFrom(undefined, null, 'r_1', 'r_<2>"'),
    }),
  })
  .map((x) => viewOf(x));

function viewOf(x: {
  places: Record<string, unknown>[];
  home: number;
  main?: number | undefined;
  lock?: number | null | undefined;
  me: Record<string, unknown>;
  round: Record<string, unknown>;
  ui: {
    version?: string | undefined;
  } & Record<string, unknown>;
}): V {
  const galaxy = x.places.map((p, i) => ({ ...p, id: `x${i}`, temp: 0 }));
  const { version, ...ui } = x.ui;
  return {
    s: {
      me: { id: 'u_me', ...x.me },
      round: { number: 4, ...x.round },
      galaxy,
      homePlanet: galaxy[x.home]?.id ?? null,
      mainPlanet:
        x.main === undefined ? undefined : (galaxy[x.main]?.id ?? null),
      mainLock: x.lock,
    },
    ui: {
      ...ui,
      news: version === undefined ? undefined : { version },
    },
    now: NOW,
  } as unknown as V;
}

const base = (over: Record<string, unknown> = {}): V =>
  viewOf({
    places: [
      { owner: 'u_me', kind: 'planet', name: 'Heimat', g: 1, s: 2, p: 3 },
      { owner: 'u_me', kind: 'moon', name: 'Mond', g: 1, s: 2, p: 3 },
      { owner: 'u_me', kind: 'planet', name: 'Kolonie', g: 2, s: 5, p: 9 },
      { owner: 'u_a', kind: 'planet', name: 'Fremd', g: 1, s: 4, p: 7 },
    ],
    home: 0,
    main: 2,
    lock: null,
    me: {
      probes: 3,
      explain: 'hidden',
      levelTable: 'always',
      pushOff: ['news'],
    },
    round: { mainLock: 7, vacationHours: 24, guilds: true },
    ui: {
      animations: true,
      webPush: true,
      view: 'help',
      lastRequestId: 'r_7',
    },
    ...over,
  } as Parameters<typeof viewOf>[0]);

afterEach(() => forgetArchive());

/** The cases the sample reaches rarely: no planet, a lock, an archive that is loaded, … */
const HAND_BUILT: [string, () => V][] = [
  ['a player with a plain state', () => base()],
  [
    'no planet of the own',
    () =>
      base({
        places: [
          { owner: 'u_a', kind: 'planet', name: 'Fremd', g: 1, s: 4, p: 7 },
        ],
        main: undefined,
      }),
  ],
  ['the lock of the main planet', () => base({ lock: NOW + 86_400_000 })],
  [
    'no push, no guilds',
    () =>
      base({
        round: { mainLock: 1, vacationHours: 1, guilds: false },
        ui: { view: 'help', webPush: false, animations: false },
      }),
  ],
  [
    'push with a pending choice and no guilds',
    () =>
      base({
        round: { mainLock: 3, vacationHours: 2, guilds: false },
        ui: {
          view: 'help',
          webPush: true,
          animations: false,
          passwordMinLength: 10,
          pushChoice: ['fleet', 'guild-chat'],
        },
      }),
  ],
  [
    'the archive after an error',
    () => {
      Object.assign(archive, {
        user: 'u_me',
        round: 4,
        entries: [],
        error: 'Das Archiv <ist> nicht erreichbar.',
      });
      return base();
    },
  ],
  [
    'the archive with rounds',
    () => {
      Object.assign(archive, {
        user: 'u_me',
        round: 4,
        entries: [
          {
            number: 1,
            status: 'closed',
            started: Date.UTC(2026, 9, 1),
            closed: Date.UTC(2026, 9, 31),
            coverage: 'complete',
            locked: false,
            participants: 3,
            you: { rank: 2, of: 3, points: 8400 },
          },
        ],
        history: [],
      });
      return base();
    },
  ],
];

describe('Optionen against the view before #118, bundle 5, second part', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        forgetArchive();
        expect(normalize(optionsView(v))).toBe(normalize(help(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, make] of HAND_BUILT) {
      const v = make();
      expect(normalize(optionsView(v)), name).toBe(normalize(help(v)));
    }
  });

  it('keeps the ids, marks and classes that features/, main.ts and style.css read', () => {
    const html = optionsView(base());
    for (const mark of [
      'id="o_probes"',
      'id="o_explain"',
      'id="o_levels"',
      'data-act="saveopt"',
      'id="o_main"',
      'data-act="mainPlanet"',
      'data-act="startVacation"',
      'id="own-activity"',
      'data-act="reloadOwnActivity"',
      'id="o_anim"',
      'id="passwordform"',
      'id="pw_current"',
      'id="pw_next"',
      'id="pw_confirm"',
      'id="passkeyform"',
      'id="passkey-password"',
      'data-act="listPasskeys"',
      'id="passkey-list"',
      'id="pwa-install"',
      'data-act="installApp"',
      'data-chg="push"',
      'class="push-kinds"',
      'data-act="pushEnable"',
      'data-act="pushDisable"',
      'id="reportform"',
      'class="report-form"',
      'id="reportform-text"',
      'name="text"',
      'data-act="deleteAccount"',
      'data-act="lex"',
      'data-a="rule-universe"',
    ])
      expect(html, mark).toContain(mark);
    expect(html).toMatch(/id="pwa-install"[^>]*\bhidden\b/);
  });

  it('shows the archive as the box of the admin does, from the same markup', () => {
    const v = HAND_BUILT[5]![1]();
    expect(normalize(optionsView(v))).toContain(
      normalize(archiveHTML(shownArchive(v.s))),
    );
  });
});
