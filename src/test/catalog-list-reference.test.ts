// CatalogList renders the four lists as they were before #118 („no visible
// change“ of the issue; each migration step changes no behaviour, owner,
// 2026-11-13). The old views are frozen here: research(), shipyard() and
// defense() of src/client/views/economy.ts and yard.ts with itemHTML() of
// common.ts, and src/test/catalog-reference/Buildings.svelte, with
// buildState() and researchState() of src/client/logic/game.ts before #214
// in src/test/catalog-reference/states.ts (the checks of #214 change no note
// of a list). On generated states (fixed fast-check seed 118) both render
// the same markup, up to what a browser does not show: Svelte's comments,
// the order of the attributes, the escaping of >, " and ' (an escaped < and
// & stay escaped, so a name shown as text never equals markup), the <tbody>
// that a table gets anyway, and white space next to a block or a line break.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { readable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import {
  BUILD,
  canFly,
  DEF,
  MISSILE,
  RES,
  type ResearchDef,
  SHIPS,
  type UnitDef,
} from '../core/catalog.ts';
import {
  afford,
  lvlCost,
  pieceEnergy,
  production,
  reqMissing,
  researchTime,
  unitTime,
} from '../core/economy.ts';
import { activeDrive, shipSpeed } from '../core/flight.ts';
import { placeName } from '../core/moon.ts';
import {
  energyNeed,
  energyShort,
  labSite,
  networkLab,
} from '../core/research.ts';
import { text } from '../core/text.ts';
import type { Levels, Planet, ResearchState } from '../core/types.ts';
import { orderMax, YARD_LOCK, yardLockedBy } from '../core/yard.ts';
import type { CatalogKind } from '../client/logic/catalog-list.ts';
import { type Explanation, explanation } from '../client/logic/explain.ts';
import { dur, esc, fmt } from '../client/logic/format.ts';
import { researchState } from './catalog-reference/states.ts';
import { iconURL } from '../client/logic/icons.ts';
import { levelsRow } from '../client/logic/level-mode.ts';
import { client } from '../client/logic/state.svelte.ts';
import type { GameState } from '../client/logic/types.ts';
import CatalogList from '../client/views/CatalogList.svelte';
import { cd, type Ui, type V } from '../client/views/common.ts';
import { costHTML, requirementsHTML } from './html-pieces-frozen.ts';
import Buildings from './catalog-reference/Buildings.svelte';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

// ----- frozen: itemHTML() of src/client/views/common.ts before #118 -----

// One change on purpose (#285, B2): the „?“ opens the article of the
// Lexicanum in a side panel, so nothing unfolds below the entry, and it is
// shown in every mode but „Ausblenden“ („Immer anzeigen“ went); it names
// the panel it controls while the panel is open.
const explainButtonHTML = (ex: Explanation | null): string =>
  ex
    ? `<button type="button" class="exq" id="${ex.button}" data-act="explain" data-k="${ex.key}" aria-expanded="${ex.open}"${ex.open ? ` aria-controls="${ex.panel}"` : ''} aria-label="Erklärung zu ${esc(ex.name)}">?</button>`
    : '';

// One more change on purpose (#187): buildings and research have the ▤ of
// the level overview next to the „?“ and a box for its table below the
// entry; ships and defense have neither.
const levelsButtonHTML = (v: V, key: string, name: string): string => {
  const lv = levelsOf(v, key, name);
  return lv?.button
    ? `<button type="button" class="lvq" id="${lv.button}" data-act="levels" data-k="${key}" aria-expanded="${lv.open}"${lv.open ? ` aria-controls="${lv.panel}"` : ''} aria-label="Stufenübersicht zu ${esc(name)}">▤</button>`
    : '';
};

const levelsBoxHTML = (v: V, key: string, name: string): string => {
  const lv = levelsOf(v, key, name);
  return lv?.show ? `<div class="lvt" id="${lv.panel}"></div>` : '';
};

const levelsOf = (v: V, key: string, name: string) =>
  Object.hasOwn(BUILD, key) || Object.hasOwn(RES, key)
    ? levelsRow(key, name, v.s.me.levelTable, v.ui.openLv)
    : null;

// One more change on purpose (#189, the phone layer; the CSS shows it on a
// phone only): the switch between the four lists below the title, the filter
// above the box (with its note when „Baubar“ shows nothing), the phase of
// every row, the fold button after the ▤, the time line marked, and the short
// label „▲ 5“ of a level button; its full name stays as the text of the
// button (the CSS hides it from the eye on a phone only), without an
// `aria-label`, which axe holds against the visible text (WCAG 2.5.3).
const SWITCH =
  '<nav class="seg phone-only" aria-label="Bauen">' +
  [
    ['buildings', 'Gebäude'],
    ['research', 'Forschung'],
    ['shipyard', 'Schiffsschmiede'],
    ['defense', 'Abwehr'],
  ]
    .map(
      ([view, label]) =>
        `<a href="?view=${view}" data-act="nav" data-v="${view}">${label}</a>`,
    )
    .join('') +
  '</nav>';

const FILTER =
  '<div class="seg phone-only" role="group" aria-label="Filter"><button type="button" class="on" aria-pressed="true">Baubar</button><button type="button" aria-pressed="false">Alle</button><button type="button" aria-pressed="false">Läuft</button></div>';

const NOTHING_OPEN =
  '<p class="dim phone-only">Nichts ist baubar. „Alle“ zeigt auch, was noch fehlt.</p>';

/** The filter, its note when `open` rows is 0, and the opening tag of the box. */
const boxStart = (open: number): string =>
  `${FILTER}${open ? '' : NOTHING_OPEN}<div class="box catalog" data-filter="open">`;

type Phase = 'running' | 'open' | 'locked';

/** A button that starts an upgrade or a research, with the label a level has on a phone. */
function startButton(
  act: string,
  k: string,
  label: string,
  off: boolean,
): string {
  const attrs = `data-act="${act}" data-k="${k}" ${off ? 'disabled' : ''}`;
  const level = /Stufe (\d+)/.exec(label);
  return level
    ? `<button ${attrs}><span class="lg">${label}</span><span class="sh" aria-hidden="true">▲ ${level[1]}</span></button>`
    : `<button ${attrs}><span>${label}</span></button>`;
}

function itemHTML(
  v: V,
  cls: string,
  key: string,
  level: string,
  body: string,
  action: string,
  phase: Phase,
): string {
  const d = text(key)!;
  const src = iconURL(key);
  const icon = src ? `<img src="${src}" alt="${esc(d.n)}">` : d.ab;
  const ds = d.ds ? `<div class="ds">${d.ds}</div>` : '';
  const ex = explanation(key, d, v.s.me.explain, v.ui.openEx);
  const open = !!levelsOf(v, key, d.n)?.open;
  const fold = `<button type="button" class="fold phone-only" aria-expanded="${open}" aria-label="Details zu ${esc(d.n)}">${open ? '▴' : '▾'}</button>`;
  return `<div class="item${open ? ' open' : ''}" data-phase="${phase}"><div class="icon ${cls}">${icon}</div><div><div class="nm">${d.n} <span class="lv">${level}</span>${explainButtonHTML(ex)}${levelsButtonHTML(v, key, d.n)}${fold}</div>${ds}${body}${levelsBoxHTML(v, key, d.n)}</div><div class="act">${action}</div></div>`;
}

// ----- frozen: src/client/views/economy.ts before #118 -----

/** The name of the own planet where the running research started (#49). */
function researchPlace(v: V): string {
  const id = v.R.rq?.planet ?? v.s.homePlanet;
  if (id === v.P.id) return v.P.name;
  return v.s.galaxy.find((p) => p.id === id)?.name ?? '';
}

function researchAction(
  v: V,
  k: string,
  level: number,
  miss: number,
  short: number,
): string {
  const { P, R, now } = v;
  const c = lvlCost(RES[k]!, level + 1);
  const state = researchState(P, R, k, miss, short);
  if (state === 'running')
    return `Forschung Stufe ${R.rq!.lvl}<br>auf ${esc(researchPlace(v))}<br>${cd(R.rq!.end, now)}<br><button class="small red" data-act="cancelResearch">Abbrechen</button>`;
  if (state === 'missing')
    return '<span class="req">Das Wissen ist noch verschlossen</span>';
  if (state === 'busy')
    return '<span class="dim">Es wird bereits geforscht</span>';
  if (state === 'labBusy')
    return '<span class="dim">Scholarium wird ausgebaut</span>';
  if (state === 'noEnergy')
    return `<span class="req">Zu wenig Energie: es fehlen ${fmt(short)}</span>`;
  return startButton(
    'research',
    k,
    `Forschen${level ? ` (Stufe ${level + 1})` : ''}`,
    !afford(P, c),
  );
}

/** Without a lab here: the own planets that have one (#49). */
function noLab(v: V): string {
  const others = v.s.labs
    .filter((l) => l.lab > 0 && l.id !== v.P.id)
    .map((l) => v.s.galaxy.find((p) => p.id === l.id))
    .filter((p) => !!p)
    .map(
      (p) =>
        ` <button data-act="selectPlanet" data-id="${esc(p.id)}">Zu ${esc(p.name)}</button>`,
    );
  const text = others.length
    ? 'Auf diesem Planeten gibt es kein Scholarium. Geforscht wird auf einem deiner Planeten mit Scholarium.'
    : 'Für Forschung brauchst du ein Scholarium.';
  return `<h2>Forschung</h2>${SWITCH}<div class="notice">${text}${others.join('')}</div>`;
}

/** The lab of this planet and how many others the IFN may link. */
function labLine(v: V): string {
  const ifn = v.R.research.ifn ?? 0;
  const net = ifn
    ? ` · Sternennetz der Gelehrten: bis zu ${ifn} weitere${ifn === 1 ? 's Scholarium' : ' Scholarien'}`
    : '';
  return `<div class="dim">Scholarium Stufe ${v.P.b.lab ?? 0}${net}</div>`;
}

function researchItem(
  v: V,
  k: string,
  d: ResearchDef,
): { html: string; phase: Phase } {
  const { P, R, s } = v;
  const level = R.research[k] ?? 0;
  const c = lvlCost(d, level + 1);
  const lab = networkLab(k, labSite(P), s.labs, R.research.ifn ?? 0);
  const linked =
    lab === (P.b.lab ?? 0) ? '' : ` (Scholarien zusammen Stufe ${lab})`;
  const short = energyShort(d, level + 1, P, s.cfg, R.research);
  const energy = {
    need: energyNeed(d, level + 1),
    production: production(P, s.cfg, R.research).eProd,
  };
  const body =
    costHTML(c, P, 1, energy) +
    `<div class="dim tl">Forschungszeit: ${dur(researchTime(c, { b: { lab } }, s.cfg))}${linked}</div>` +
    requirementsHTML(v, d.req);
  const miss = reqMissing(d, P, R).length;
  const state = researchState(P, R, k, miss, short);
  const phase: Phase =
    state === 'running' ? 'running' : state === 'missing' ? 'locked' : 'open';
  return {
    html: itemHTML(
      v,
      'ic-r',
      k,
      level ? `(Stufe ${level})` : '',
      body,
      researchAction(v, k, level, miss, short),
      phase,
    ),
    phase,
  };
}

/** Research starts on the shown planet when it has a lab (#49). */
function research(v: V): string {
  if (!((v.P.b.lab ?? 0) > 0)) return noLab(v);
  // The Kolonialverwaltung (#237) is listed only in a round with it, and the
  // states here have none.
  const items = Object.entries(RES)
    .filter(([k]) => k !== 'colonial')
    .map(([k, d]) => researchItem(v, k, d));
  const open = items.filter((i) => i.phase === 'open').length;
  return `<h2>Forschung auf ${esc(placeName(v.P))}</h2>${SWITCH}${labLine(v)}${boxStart(open)}${items.map((i) => i.html).join('')}</div>`;
}

// ----- frozen: src/client/views/yard.ts before #118 -----

// One change on purpose (#54, owner, 2026-11-21): a missile in store has the
// number and the button „Verschrotten“ below its order, in a block of its own
// (not in a row that shows a note).
function tearDownBox(k: string, have: number): string {
  if (!Object.hasOwn(MISSILE, k) || have < 1) return '';
  const name = esc(text(k)!.n);
  return `<div class="tear"><input type="number" min="1" max="${have}" id="td_${k}" placeholder="0" aria-label="Menge verschrotten: ${name}"> <button class="small red" data-act="tearDown" data-k="${k}" aria-label="Verschrotten: ${name}">Verschrotten</button></div>`;
}

// One change on purpose (#258): every order of the list has a button
// „Abbrechen“ in a cell of its own, named by position and unit.
function queue(v: V): string {
  const { P, now } = v;
  if (!P.sq.length) return '';
  const rows = P.sq
    .map((q, i) => {
      const when =
        i === 0
          ? 'nächste fertig in ' + cd((P.sqT ?? now) + q.unit, now)
          : 'je ' + dur(q.unit);
      const label = `${fmt(q.n)}× ${text(q.key)?.n}`;
      return `<tr><td>${label}</td><td class="n">${when}</td><td class="n"><button class="small red" data-act="cancelOrder" data-pos="${i}" data-k="${q.key}" aria-label="Abbrechen: ${esc(label)}">Abbrechen</button></td></tr>`;
    })
    .join('');
  return `<div class="box"><div class="hd">Bauauftrag der Schiffsschmiede</div><div class="bd"><table>${rows}</table></div></div>`;
}

/** Speed of a flying ship; a ship that switches its drive names it (#57). */
function speedText(v: V, k: string): string {
  const drive = SHIPS[k]!.drives ? activeDrive(k, v.R)!.drive : null;
  const name = drive ? ` (${text(drive)!.n})` : '';
  return ` · Tempo ${fmt(shipSpeed(k, v.R))}${name}`;
}

function stats(v: V, k: string, d: UnitDef): string {
  const tech = v.R.research;
  const c = d.cost;
  const ship = canFly(k) ? SHIPS[k] : undefined;
  const cargo = ship ? ` · Ladung ${fmt(ship.cargo)}` : '';
  const speed = ship ? speedText(v, k) : '';
  return `<div class="dim">Angriff ${fmt(d.atk * (1 + 0.1 * (tech.weapons ?? 0)))} · Schild ${fmt(d.sh * (1 + 0.1 * (tech.shield ?? 0)))} · Struktur ${fmt((c[0] + c[1]) * (1 + 0.1 * (tech.armor ?? 0)))}${cargo}${speed}${energyText(v, k)}</div>`;
}

/** The energy of one piece of a ship that makes energy, „je …“ from its texts (#114). */
function energyText(v: V, k: string): string {
  const e = pieceEnergy(k, v.P, v.s.cfg, v.R.research);
  if (e === undefined) return '';
  const per = text(k)?.per;
  return ` · Energie ${fmt(e)}${per ? ` ${per}` : ''}`;
}

function orderBox(k: string, maxN: number, upgrading: boolean): string {
  const once = DEF[k]?.once ? ' max="1"' : '';
  return `<div class="flex center"><input type="number" min="0"${once} id="q_${k}" placeholder="0" aria-label="Anzahl"> <span class="lnk" data-act="maxq" data-k="${k}" data-max="${maxN}">(max ${fmt(maxN)})</span></div><button class="mt" data-act="order" data-k="${k}" ${upgrading || maxN === 0 ? 'disabled' : ''}>Bauen</button>`;
}

function yard(
  v: V,
  title: string,
  defs: Record<string, UnitDef>,
  cls: string,
  have: Levels,
): string {
  const { P, R, s } = v;
  if (!((P.b.yard ?? 0) > 0))
    return `<h2>${title}</h2>${SWITCH}<div class="notice">Dafür brauchst du eine Orbitale Schiffsschmiede.</div>`;
  const lock = yardLockedBy(P);
  const items = Object.entries(defs).map(([k, d]) => {
    const miss = reqMissing(d, P, R);
    const action = miss.length
      ? '<span class="req">Das Wissen ist noch verschlossen</span>'
      : orderBox(k, orderMax(P, k), !!lock) + tearDownBox(k, have[k] ?? 0);
    const body =
      costHTML(d.cost, P) +
      stats(v, k, d) +
      `<div class="dim tl">Bauzeit: ${dur(unitTime(d, P, s.cfg))} je Einheit</div>` +
      requirementsHTML(v, d.req);
    // A unit with an order in the queue is running, one with missing requirements locked.
    const phase: Phase = miss.length
      ? 'locked'
      : P.sq.some((q) => q.key === k)
        ? 'running'
        : 'open';
    return {
      html: itemHTML(
        v,
        cls,
        k,
        `(vorhanden: ${fmt(have[k] ?? 0)}${DEF[k]?.once ? ' · max. 1' : ''})`,
        body,
        action,
        phase,
      ),
      phase,
    };
  });
  const warn = lock ? `<div class="notice warn">${lockNotice(lock)}</div>` : '';
  const open = items.filter((i) => i.phase === 'open').length;
  return `<h2>${title}</h2>${SWITCH}${queue(v)}${warn}${boxStart(open)}${items.map((i) => i.html).join('')}</div>`;
}

const lockNotice = (key: string): string =>
  key === 'yard'
    ? 'Die Schiffsschmiede wird gerade ausgebaut und kann nicht produzieren.'
    : `Die ${YARD_LOCK[key]} wird gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.`;

const shipyard = (v: V): string =>
  yard(v, 'Schiffsschmiede', SHIPS, 'ic-s', v.P.ships);
const defense = (v: V): string => yard(v, 'Verteidigung', DEF, 'ic-d', v.P.def);

// ----- the comparison -----

/** The old view of a kind. */
const OLD: Record<CatalogKind, (v: V) => string> = {
  building: (v) =>
    render(Buildings, { props: { viewState: readable(v) } }).body,
  research,
  ship: shipyard,
  defense,
};

function renderOnce(v: V, kind: CatalogKind): string {
  client.shown = v;
  try {
    return render(CatalogList, { props: { kind } }).body;
  } finally {
    client.shown = null;
  }
}

/**
 * The new list of a state, rendered once: the same state and kind is shown in
 * several tests of this file (the comparison, the marks), and rendering is
 * what takes the time. A state is never changed by a rendering.
 */
const rendered = new WeakMap<V, Map<CatalogKind, string>>();
function renderNew(v: V, kind: CatalogKind): string {
  const byKind = rendered.get(v) ?? new Map<CatalogKind, string>();
  rendered.set(v, byKind);
  const html = byKind.get(kind) ?? renderOnce(v, kind);
  byKind.set(kind, html);
  return html;
}

const KINDS: readonly CatalogKind[] = [
  'building',
  'research',
  'ship',
  'defense',
];

const levels = (keys: string[], max: number): fc.Arbitrary<Levels> =>
  fc.record(
    Object.fromEntries(keys.map((k) => [k, fc.integer({ min: 0, max })])),
    { requiredKeys: [] },
  ) as fc.Arbitrary<Levels>;

const IDS = ['p1_1_5', 'p1_2_3', 'p1_4_7', 'm1_1_5'] as const;
const NAMES = ['Heimat', 'Kolonie', 'Mond <b>&"\'</b>', 'Ödland'] as const;

const time = fc.integer({ min: 0, max: 2_000_000 });

const buildOrder = (b: Levels): fc.Arbitrary<Planet['bq']> =>
  fc.option(
    fc
      .record({
        key: fc.constantFrom(...Object.keys(BUILD)),
        start: time,
        span: fc.integer({ min: 1, max: 900_000 }),
      })
      .map(({ key, start, span }) => {
        // A demolition of a level that stands (#202) on an even span: no
        // draw of its own, so the cases of the seed stay those before.
        const down = span % 2 === 0 && (b[key] ?? 0) > 0;
        return {
          key,
          lvl: (b[key] ?? 0) + (down ? -1 : 1),
          start,
          end: start + span,
          cost: [0, 0, 0] as [number, number, number],
          ...(down ? { back: [1, 2, 3] as const } : {}),
        };
      }),
  );

const unitOrder: fc.Arbitrary<Planet['sq'][number]> = fc.record({
  key: fc.constantFrom(...Object.keys(SHIPS), ...Object.keys(DEF)),
  n: fc.integer({ min: 1, max: 5000 }),
  unit: fc.integer({ min: 1, max: 600_000 }),
});

const place = fc
  .record({
    kind: fc.constantFrom('planet' as const, 'moon' as const),
    name: fc.constantFrom(...NAMES),
    temp: fc.integer({ min: -40, max: 120 }),
    diameter: fc.integer({ min: 1000, max: 16000 }),
    unlimited: fc.boolean(),
    res: fc.record({
      m: fc.integer({ min: 0, max: 5_000_000 }),
      c: fc.integer({ min: 0, max: 5_000_000 }),
      d: fc.integer({ min: 0, max: 2_000_000 }),
    }),
    b: levels(Object.keys(BUILD), 14),
    ships: levels(Object.keys(SHIPS), 40),
    def: levels(Object.keys(DEF), 1),
    sq: fc.array(unitOrder, { maxLength: 3 }),
    sqT: fc.option(time),
  })
  .chain((p) => buildOrder(p.b).map((bq) => planet({ ...p, bq })));

/** What a state of the lists is made of, by the generator and by hand. */
interface Parts {
  P: Planet;
  research: Levels;
  rq: ResearchState['rq'];
  now: number;
  explain: string;
  /** The option „Stufenübersicht“ (#187); the ▤ without it. Not drawn by the generator, so its sample stays. */
  levelTable?: string;
  openEx: Record<string, boolean>;
  /** The entries whose ▤ was pressed (#187). */
  openLv?: Record<string, boolean>;
  labs: { id: string; lab: number; upgrading: boolean }[];
  home: string;
}

function view(x: Parts): V {
  const s = {
    cfg: U,
    me: { id: 'u1', explain: x.explain, levelTable: x.levelTable },
    labs: x.labs,
    galaxy: IDS.map((id, i) => ({ id, name: NAMES[i]!, kind: 'planet' })),
    homePlanet: x.home,
    // Without a switch the main planet is the home planet (#221); the
    // frozen views know only the home planet.
    mainPlanet: x.home,
  } as unknown as GameState;
  return {
    s,
    P: x.P,
    R: { research: x.research, rq: x.rq },
    now: x.now,
    ui: { openEx: x.openEx, openLv: x.openLv } as unknown as Ui,
  };
}

const state = fc
  .record({
    P: place,
    research: levels(Object.keys(RES), 13),
    rq: fc.option(
      fc.record({
        key: fc.constantFrom(...Object.keys(RES)),
        lvl: fc.integer({ min: 1, max: 14 }),
        start: time,
        end: time,
        cost: fc.constant([0, 0, 0] as [number, number, number]),
        planet: fc.option(fc.constantFrom(...IDS, 'p9_9_9'), {
          nil: undefined,
        }),
      }),
    ),
    now: time,
    explain: fc.constantFrom('always', 'icon', 'hidden'),
    openEx: fc.dictionary(
      fc.constantFrom(...Object.keys(BUILD), ...Object.keys(RES)),
      fc.boolean(),
    ),
    labs: fc.array(
      fc.record({
        id: fc.constantFrom(...IDS),
        lab: fc.integer({ min: 0, max: 16 }),
        upgrading: fc.boolean(),
      }),
      { maxLength: 4 },
    ),
    home: fc.constantFrom(...IDS),
  })
  .map((x): V => view(x));

/**
 * The sample (seed 118): 300 states of one seeded sequence, generated once.
 * The comparison uses the first 150 of them, the check of the marks all.
 */
const SAMPLE_RUNS = 300;
const COMPARED_RUNS = 150;
let sample: V[] | undefined;
function SAMPLE(): V[] {
  if (!sample) {
    const states: V[] = [];
    fc.assert(
      fc.property(state, (v) => {
        states.push(v);
      }),
      { seed: 118, numRuns: SAMPLE_RUNS },
    );
    sample = states;
  }
  return sample;
}

/** Markup of every branch of the lists, for the check that the cases reach them. */
const MARKS = [
  'data-act="cancelBuild"',
  'data-act="demolish"',
  'Rückbau auf Stufe',
  'data-act="cancelResearch"',
  'data-act="build"',
  'data-act="research"',
  'data-act="order"',
  'data-act="tearDown"',
  'data-act="selectPlanet"',
  'data-act="explain"',
  'data-act="levels"',
  'class="lvt"',
  'Bauschleife belegt',
  'Schiffsschmiede arbeitet gerade',
  'Scholarium forscht gerade',
  'Es wird bereits geforscht',
  'Scholarium wird ausgebaut',
  'Keine freien Felder.',
  'Zu wenig Energie',
  'Das Wissen ist noch verschlossen',
  'Bauauftrag der Schiffsschmiede',
  'gleich …',
  'kann nicht produzieren',
  'Dafür brauchst du eine Orbitale Schiffsschmiede.',
  'Für Forschung brauchst du ein Scholarium.',
  'Auf diesem Planeten gibt es kein Scholarium.',
  'Sternennetz der Gelehrten',
  'Scholarien zusammen',
  'mehr Verbrauch',
  'mehr Produktion',
  'verbrauch auf Stufe',
  ' · max. 1',
];

/** Adds the marks that `html` shows to `seen`. */
function collect(html: string, seen: Set<string>): void {
  for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
}

/**
 * The marks the sample (seed 118, 300 runs) reached at most 70 times, one of
 * them (a running lab upgrade) not at all once the catalog had 58 entries:
 * each has a hand-built case below, so no new catalog entry can lose it.
 */
const RARE = [
  'class="lvt"',
  'data-act="demolish"',
  'data-act="selectPlanet"',
  'Rückbau auf Stufe',
  'Schiffsschmiede arbeitet gerade',
  'Scholarium forscht gerade',
  'Scholarium wird ausgebaut',
  'Zu wenig Energie',
  'kann nicht produzieren',
  'Auf diesem Planeten gibt es kein Scholarium.',
  'Für Forschung brauchst du ein Scholarium.',
  'Keine freien Felder.',
  'Scholarien zusammen',
];

const RICH = { m: 5_000_000, c: 5_000_000, d: 2_000_000 };

/** A state by hand: a planet with a lab and a shipyard, rich, and nothing running. */
function handBuilt(over: Partial<Planet>, more: Partial<Parts> = {}): V {
  return view({
    P: planet({
      unlimited: true,
      res: RICH,
      b: { lab: 3, yard: 2, robot: 10, metal: 2 },
      ...over,
    }),
    research: { computer: 10 },
    rq: null,
    now: 1000,
    explain: 'always',
    openEx: {},
    labs: [{ id: 'p1_1_5', lab: 3, upgrading: false }],
    home: 'p1_1_5',
    ...more,
  });
}

const order = (key: string, back = false): NonNullable<Planet['bq']> => ({
  key,
  lvl: 1,
  start: 0,
  end: 5000,
  cost: [0, 0, 0],
  ...(back ? { back: [1, 2, 3] as const } : {}),
});

/** Cases that make the rare branches certain, each named by what it shows. */
const HAND_BUILT: readonly (readonly [string, V])[] = [
  // A level to demolish with a free queue; the lab linked to a better one.
  [
    'idle with a linked lab',
    handBuilt(
      {},
      {
        research: { ifn: 2, computer: 10 },
        labs: [
          { id: 'p1_1_5', lab: 3, upgrading: false },
          { id: 'p1_2_3', lab: 8, upgrading: false },
        ],
      },
    ),
  ],
  // The level overview of #187: the ▤ pressed on a building and a research,
  // the table always shown, and the option „Ausblenden“.
  [
    'the ▤ pressed',
    handBuilt({}, { levelTable: 'icon', openLv: { metal: true, spy: true } }),
  ],
  ['the level overview always shown', handBuilt({}, { levelTable: 'always' })],
  [
    'the level overview hidden',
    handBuilt({}, { levelTable: 'hidden', openLv: { metal: true } }),
  ],
  ['a demolition running', handBuilt({ bq: order('metal', true) })],
  ['the lab being upgraded', handBuilt({ bq: order('lab') })],
  [
    'a research running',
    handBuilt(
      {},
      {
        rq: {
          key: 'energy',
          lvl: 1,
          start: 0,
          end: 5000,
          cost: [0, 0, 0],
        },
      },
    ),
  ],
  [
    'orders in the shipyard',
    handBuilt({ sq: [{ key: 'sc', n: 3, unit: 100 }], sqT: 0 }),
  ],
  ['the shipyard being upgraded', handBuilt({ bq: order('yard') })],
  [
    'no shipyard, no lab, another lab',
    handBuilt(
      { b: {} },
      {
        labs: [
          { id: 'p1_1_5', lab: 0, upgrading: false },
          { id: 'p1_2_3', lab: 8, upgrading: false },
        ],
      },
    ),
  ],
  ['no shipyard, no lab at all', handBuilt({ b: {} }, { labs: [] })],
  [
    'too little energy',
    handBuilt(
      { b: { lab: 12, yard: 2, robot: 10, nanite: 1 } },
      { research: { energy: 12, computer: 10 } },
    ),
  ],
  [
    'no free field',
    handBuilt({
      unlimited: false,
      diameter: 3000,
      b: { lab: 3, yard: 2, robot: 10 },
    }),
  ],
];

describe('CatalogList against the views before #118', () => {
  it('normalizes only what a browser does not show', () => {
    expect(
      normalize(
        '<div class="a"  id="x">\n <b>A &amp; B&gt;</b> <!--[--><input id="q" max="1" disabled=""/></div>',
      ),
    ).toBe(
      '<div class="a" id="x"><b>A &amp; B></b> <input disabled id="q" max="1"></div>',
    );
    // A name shown as text never equals the same name as markup (#209).
    expect(normalize('<h2>Mond &lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;</h2>')).toBe(
      normalize('<h2>Mond &lt;b>&amp;"\'&lt;/b></h2>'),
    );
    expect(normalize('<h2>Mond &lt;b&gt;</h2>')).not.toBe(
      normalize('<h2>Mond <b></h2>'),
    );
    expect(normalize('<h2>&amp;lt;</h2>')).not.toBe(normalize('<h2>&lt;</h2>'));
    expect(normalize('<span>a</span> <span>b</span>')).not.toBe(
      normalize('<span>a</span><span>b</span>'),
    );
    // An escaped quote in a value never equals the end of the value and the
    // start of another attribute (CodeRabbit on #210).
    expect(normalize('<img alt="x&quot; title=&quot;y">')).not.toBe(
      normalize('<img alt="x" title="y">'),
    );
    expect(normalize('<img alt="x&quot; title=&quot;y">')).toBe(
      '<img alt="x&quot; title=&quot;y">',
    );
    // In a value, > and ' are decoded as in the text; a > ends no tag.
    expect(normalize('<img alt="a&gt;b&#39;c" src="s">')).toBe(
      normalize('<img src="s" alt="a>b\'c">'),
    );
    expect(normalize('<div title="a>b"> x </div> y')).toBe(
      '<div title="a>b">x</div>y',
    );
    expect(normalize('<b title="&quot;">&quot;</b>')).toBe(
      '<b title="&quot;">"</b>',
    );
    // An empty class shows nothing; Svelte leaves it out (#118, bundle 1).
    expect(normalize('<a class="" href="x" >A</a>')).toBe(
      normalize('<a href="x">A</a>'),
    );
    expect(normalize('<a class=" " href="x">A</a>')).not.toBe(
      normalize('<a href="x">A</a>'),
    );
    expect(normalize('<a data-class="" href="x">A</a>')).not.toBe(
      normalize('<a href="x">A</a>'),
    );
    expect(normalize('<option selected="" value="p">P</option>')).toBe(
      normalize('<option value="p" selected>P</option>'),
    );
    expect(normalize('<option value="p">P</option>')).not.toBe(
      normalize('<option value="p" selected>P</option>'),
    );
    // data-nokeep is no markup of the page any more (#118, package 8): the
    // frozen HTML that still carries it compares equal.
    expect(normalize('<input data-nokeep="" id="g">')).toBe(
      normalize('<input id="g">'),
    );
    expect(normalize('<input id="g" data-nokeep>')).toBe(
      normalize('<input id="g">'),
    );
  });

  it('takes the states of the comparison from the sample of the marks', () => {
    // The 150 runs of the seed 118 are the first 150 of its 300 runs.
    const first: V[] = [];
    fc.assert(
      fc.property(state, (v) => {
        first.push(v);
      }),
      { seed: 118, numRuns: COMPARED_RUNS },
    );
    expect(SAMPLE()).toHaveLength(SAMPLE_RUNS);
    expect(first).toHaveLength(COMPARED_RUNS);
    expect(SAMPLE().slice(0, COMPARED_RUNS)).toEqual(first);
  });

  it.each(KINDS)('renders the %s list as before', (kind) => {
    SAMPLE()
      .slice(0, COMPARED_RUNS)
      .forEach((v, i) => {
        expect(normalize(renderNew(v, kind)), `run ${i}`).toBe(
          normalize(OLD[kind](v)),
        );
      });
  });

  it('lists the Handelsposten and the Raketenkrypta, each with its own marks, as before (#171, #54)', () => {
    const v = handBuilt({
      b: { lab: 3, yard: 2, robot: 4, market: 1, silo: 2 },
    });
    const html = normalize(renderNew(v, 'building'));
    expect(html).toBe(normalize(OLD.building(v)));
    const at = (name: string): number => html.indexOf(`${name} <span`);
    // In the order of the catalog: the Handelsposten (170), then the Raketenkrypta (180).
    expect(at('Handelsposten')).toBeGreaterThan(-1);
    expect(at('Raketenkrypta')).toBeGreaterThan(at('Handelsposten'));
    expect(html).toContain('Handelsposten <span class="lv">(Stufe 1)</span>');
    expect(html).toContain('Raketenkrypta <span class="lv">(Stufe 2)</span>');
    // The places of the missiles show at the Raketenkrypta only.
    expect(html.match(/Belegt: /g)).toHaveLength(1);
    expect(html.indexOf('Belegt: 0 / 20 Plätze')).toBeGreaterThan(
      at('Raketenkrypta'),
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      for (const kind of KINDS)
        expect(normalize(renderNew(v, kind)), `${name}, ${kind}`).toBe(
          normalize(OLD[kind](v)),
        );
  });

  // The generated states reach the rare branches by chance only: each new
  // catalog entry (#171, #190) moved the sample, and raising the number of
  // runs twice did not stop that. So the branches below are also reached by
  // the hand-built cases, on purpose and always.
  it('reaches the rare actions and notices by the hand-built cases alone', () => {
    const seen = new Set<string>();
    for (const [, v] of HAND_BUILT)
      for (const kind of KINDS) collect(renderNew(v, kind), seen);
    expect([...seen].filter((m) => RARE.includes(m)).sort()).toEqual(
      [...RARE].sort(),
    );
  });

  it('reaches every action and notice', () => {
    // The sample (seed 118) and the hand-built cases together.
    const seen = new Set<string>();
    for (const [, v] of HAND_BUILT)
      for (const kind of KINDS) collect(renderNew(v, kind), seen);
    for (const v of SAMPLE())
      for (const kind of KINDS) collect(renderNew(v, kind), seen);
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
