// CatalogList renders the four lists as they were before #118 („no visible
// change“ of the issue; each migration step changes no behaviour, owner,
// 2026-11-13). The old views are frozen here: research(), shipyard() and
// defense() of src/client/views/economy.ts and yard.ts with itemHTML() of
// common.ts, and src/test/catalog-reference/Buildings.svelte. On generated
// states (fixed fast-check seed 118) both render the same markup, up to what
// a browser does not show: Svelte's comments, the order of the attributes,
// the escaping of >, " and ' (an escaped < and & stay escaped, so a name
// shown as text never equals markup), the <tbody> that a table gets anyway,
// and white space next to a block or a line break.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { readable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import {
  BUILD,
  canFly,
  DEF,
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
import type { Levels, Planet } from '../core/types.ts';
import { orderMax, YARD_LOCK, yardLockedBy } from '../core/yard.ts';
import type { CatalogKind } from '../client/logic/catalog-list.ts';
import {
  explainButtonHTML,
  explainPanelHTML,
  explanation,
} from '../client/logic/explain.ts';
import { dur, esc, fmt } from '../client/logic/format.ts';
import { researchState } from '../client/logic/game.ts';
import { iconURL } from '../client/logic/icons.ts';
import { client } from '../client/logic/state.svelte.ts';
import type { GameState } from '../client/logic/types.ts';
import CatalogList from '../client/views/CatalogList.svelte';
import {
  cd,
  costHTML,
  requirementsHTML,
  type Ui,
  type V,
} from '../client/views/common.ts';
import Buildings from './catalog-reference/Buildings.svelte';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

// ----- frozen: itemHTML() of src/client/views/common.ts before #118 -----

function itemHTML(
  v: V,
  cls: string,
  key: string,
  level: string,
  body: string,
  action: string,
): string {
  const d = text(key)!;
  const src = iconURL(key);
  const icon = src ? `<img src="${src}" alt="${esc(d.n)}">` : d.ab;
  const ds = d.ds ? `<div class="ds">${d.ds}</div>` : '';
  const ex = explanation(key, d, v.s.me.explain, v.ui.openEx);
  return `<div class="item"><div class="icon ${cls}">${icon}</div><div><div class="nm">${d.n} <span class="lv">${level}</span>${explainButtonHTML(ex)}</div>${ds}${body}${explainPanelHTML(ex)}</div><div class="act">${action}</div></div>`;
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
  return `<button data-act="research" data-k="${k}" ${afford(P, c) ? '' : 'disabled'}>Forschen${level ? ` (Stufe ${level + 1})` : ''}</button>`;
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
  return `<h2>Forschung</h2><div class="notice">${text}${others.join('')}</div>`;
}

/** The lab of this planet and how many others the IFN may link. */
function labLine(v: V): string {
  const ifn = v.R.research.ifn ?? 0;
  const net = ifn
    ? ` · Sternennetz der Gelehrten: bis zu ${ifn} weitere${ifn === 1 ? 's Scholarium' : ' Scholarien'}`
    : '';
  return `<div class="dim">Scholarium Stufe ${v.P.b.lab ?? 0}${net}</div>`;
}

function researchItem(v: V, k: string, d: ResearchDef): string {
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
    `<div class="dim">Forschungszeit: ${dur(researchTime(c, { b: { lab } }, s.cfg))}${linked}</div>` +
    requirementsHTML(v, d.req);
  return itemHTML(
    v,
    'ic-r',
    k,
    level ? `(Stufe ${level})` : '',
    body,
    researchAction(v, k, level, reqMissing(d, P, R).length, short),
  );
}

/** Research starts on the shown planet when it has a lab (#49). */
function research(v: V): string {
  if (!((v.P.b.lab ?? 0) > 0)) return noLab(v);
  const items = Object.entries(RES).map(([k, d]) => researchItem(v, k, d));
  return `<h2>Forschung auf ${esc(placeName(v.P))}</h2>${labLine(v)}<div class="box">${items.join('')}</div>`;
}

// ----- frozen: src/client/views/yard.ts before #118 -----

function queue(v: V): string {
  const { P, now } = v;
  if (!P.sq.length) return '';
  const rows = P.sq
    .map((q, i) => {
      const when =
        i === 0
          ? 'nächste fertig in ' + cd((P.sqT ?? now) + q.unit, now)
          : 'je ' + dur(q.unit);
      return `<tr><td>${fmt(q.n)}× ${text(q.key)?.n}</td><td class="n">${when}</td></tr>`;
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
    return `<h2>${title}</h2><div class="notice">Dafür brauchst du eine Orbitale Schiffsschmiede.</div>`;
  const lock = yardLockedBy(P);
  const items = Object.entries(defs).map(([k, d]) => {
    const miss = reqMissing(d, P, R);
    const action = miss.length
      ? '<span class="req">Das Wissen ist noch verschlossen</span>'
      : orderBox(k, orderMax(P, k), !!lock);
    const body =
      costHTML(d.cost, P) +
      stats(v, k, d) +
      `<div class="dim">Bauzeit: ${dur(unitTime(d, P, s.cfg))} je Einheit</div>` +
      requirementsHTML(v, d.req);
    return itemHTML(
      v,
      cls,
      k,
      `(vorhanden: ${fmt(have[k] ?? 0)}${DEF[k]?.once ? ' · max. 1' : ''})`,
      body,
      action,
    );
  });
  const warn = lock ? `<div class="notice warn">${lockNotice(lock)}</div>` : '';
  return `<h2>${title}</h2>${queue(v)}${warn}<div class="box">${items.join('')}</div>`;
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

function renderNew(v: V, kind: CatalogKind): string {
  client.shown = v;
  try {
    return render(CatalogList, { props: { kind } }).body;
  } finally {
    client.shown = null;
  }
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
      .map(({ key, start, span }) => ({
        key,
        lvl: (b[key] ?? 0) + 1,
        start,
        end: start + span,
        cost: [0, 0, 0] as [number, number, number],
      })),
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
  .map((x): V => {
    const s = {
      cfg: U,
      me: { id: 'u1', explain: x.explain },
      labs: x.labs,
      galaxy: IDS.map((id, i) => ({ id, name: NAMES[i]!, kind: 'planet' })),
      homePlanet: x.home,
    } as unknown as GameState;
    return {
      s,
      P: x.P,
      R: { research: x.research, rq: x.rq },
      now: x.now,
      ui: { openEx: x.openEx } as unknown as Ui,
    };
  });

/** Markup of every branch of the lists, for the check that the cases reach them. */
const MARKS = [
  'data-act="cancelBuild"',
  'data-act="cancelResearch"',
  'data-act="build"',
  'data-act="research"',
  'data-act="order"',
  'data-act="selectPlanet"',
  'data-act="explain"',
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
  });

  it.each(KINDS)('renders the %s list as before', (kind) => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(renderNew(v, kind))).toBe(normalize(OLD[kind](v)));
      }),
      { seed: 118, numRuns: 150 },
    );
  });

  it('reaches every action and notice', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(state, (v) => {
        for (const kind of KINDS) {
          const html = renderNew(v, kind);
          for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
        }
      }),
      { seed: 118, numRuns: 150 },
    );
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
