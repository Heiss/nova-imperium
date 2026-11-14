// The lists of buildings, research, shipyard and defense (#118,
// okf/architecture/patterns.md, section 9): what the generic component
// CatalogList shows, one row per catalog entry of a kind, from the tables of
// the catalog, its components and the texts of each entry (#113, #114). A
// new entry needs no new code here and no new HTML.
import {
  BUILD,
  buildable,
  canFly,
  DEF,
  RES,
  SHIPS,
  type UnitDef,
} from '../../core/catalog.ts';
import {
  afford,
  buildTime,
  lvlCost,
  pieceEnergy,
  prod,
  production,
  reqMissing,
  researchTime,
  unitTime,
  useAt,
} from '../../core/economy.ts';
import { fieldsFull } from '../../core/fields.ts';
import { activeDrive, shipSpeed } from '../../core/flight.ts';
import { placeName } from '../../core/moon.ts';
import {
  energyNeed,
  energyShort,
  labSite,
  networkLab,
} from '../../core/research.ts';
import { text } from '../../core/text.ts';
import type { Cost, Levels, Requirements } from '../../core/types.ts';
import { orderMax, YARD_LOCK, yardLockedBy } from '../../core/yard.ts';
import type { V } from '../views/common.ts';
import { type Explanation, explanation } from './explain.ts';
import { fieldsLine } from './fields.ts';
import { dur, fmt } from './format.ts';
import {
  type BuildState,
  buildState,
  type ResearchUiState,
  researchState,
} from './game.ts';
import { iconURL } from './icons.ts';

/** The kinds of catalog entries that have a list. */
export type CatalogKind = 'building' | 'research' | 'ship' | 'defense';

/** The views of the lists, by the kind of their entries. */
export const CATALOG_VIEWS: Readonly<Record<string, CatalogKind>> = {
  buildings: 'building',
  research: 'research',
  shipyard: 'ship',
  defense: 'defense',
};

/** The kind of entries a view lists, or undefined for any other view. */
export const catalogKind = (view: string): CatalogKind | undefined =>
  Object.hasOwn(CATALOG_VIEWS, view) ? CATALOG_VIEWS[view] : undefined;

/** A text instead of a button, `req` for what is missing, `dim` for a wait. */
interface Note {
  kind: 'note';
  cls: 'req' | 'dim';
  text: string;
}

/** What the right side of a row shows. */
export type CatalogAction =
  | Note
  /** „Bauen“, „Ausbauen …“ or „Forschen …“. */
  | {
      kind: 'start';
      act: 'build' | 'research';
      label: string;
      disabled: boolean;
    }
  /** The running upgrade of a building with its progress. */
  | {
      kind: 'upgrading';
      level: number;
      end: number;
      left: string;
      max: number;
      value: number;
    }
  /** The running research, where it runs; `left` is null when it is due. */
  | {
      kind: 'researching';
      level: number;
      place: string;
      end: number;
      left: string | null;
    }
  /** The order of ships or defense: a number, its maximum and „Bauen“. */
  | { kind: 'order'; max: number; once: boolean; disabled: boolean };

/** One entry of a list. */
export interface CatalogRow {
  key: string;
  name: string;
  /** The abbreviation, shown where the entry has no icon. */
  ab: string;
  ds: string;
  icon: string | null;
  /** The class of the icon, by kind. */
  cls: string;
  /** „(Stufe 3)“, „(vorhanden: 2)“ or nothing. */
  level: string;
  /** A building that is being upgraded is marked. */
  running: boolean;
  cost: Cost;
  /** The energy production a level needs (#49, #51), if any. */
  energy?: { need: number; production: number };
  /** The lines below the cost: energy, use, stats and time. */
  lines: string[];
  req: Requirements | undefined;
  explanation: Explanation | null;
  action: CatalogAction;
}

/** A row of the order queue of the shipyard. */
interface QueueRow {
  label: string;
  /** The first order: when its next unit is done; null when it is due. */
  next: { end: number; left: string | null } | null;
  /** The other orders: the time of each unit. */
  each: string;
}

/** A list, or the notice why the planet has none. */
export type CatalogPage =
  | {
      blocked: true;
      title: string;
      notice: string;
      /** The own planets to switch to, for research on another lab (#49). */
      places: { id: string; name: string }[];
    }
  | {
      blocked: false;
      title: string;
      line: { id?: string; text: string } | null;
      queue: QueueRow[];
      warn: string | null;
      rows: CatalogRow[];
    };

const LOCKED: Note = {
  kind: 'note',
  cls: 'req',
  text: 'Das Wissen ist noch verschlossen',
};

const note = (cls: Note['cls'], text: string): Note => ({
  kind: 'note',
  cls,
  text,
});

const noEnergy = (short: number): Note =>
  note('req', `Zu wenig Energie: es fehlen ${fmt(short)}`);

/** Energy and use, to two decimals. */
const ENERGY = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  m: 'Adamant',
  c: 'Psikristall',
  d: 'Promethium',
};

/** What every row shows of its entry: texts, icon, explanation. */
function entry(
  v: V,
  key: string,
  cls: string,
  level: string,
): Pick<
  CatalogRow,
  'key' | 'name' | 'ab' | 'ds' | 'icon' | 'cls' | 'level' | 'explanation'
> {
  const t = text(key)!;
  return {
    key,
    name: t.n,
    ab: t.ab,
    ds: t.ds,
    icon: iconURL(key),
    cls,
    level,
    explanation: explanation(key, t, v.s.me.explain, v.ui.openEx),
  };
}

const stage = (level: number): string => (level ? `(Stufe ${level})` : '');

/** The energy production a level needs, with what the planet makes. */
const energyCost = (need: number, made: () => number): CatalogRow['energy'] =>
  need ? { need, production: made() } : undefined;

// ----- buildings -----

/** How much more energy the next level makes (or uses less of). */
function energyChange(v: V, key: string, level: number): number {
  const { P, R, s } = v;
  const current = prod(P, s.cfg, R.research);
  const next = prod(
    { ...P, b: { ...P.b, [key]: level + 1 } },
    s.cfg,
    R.research,
  );
  return next.eProd - current.eProd - (next.eUse - current.eUse);
}

/** The energy and the resources the next level changes. */
function useLines(v: V, key: string, level: number): string[] {
  const { P, R, s } = v;
  const next = level + 1;
  const delta = energyChange(v, key, level);
  const energy = delta
    ? [
        `Energie auf Stufe ${next}: ${ENERGY.format(Math.abs(delta))} ${delta < 0 ? 'mehr Verbrauch' : 'mehr Produktion'}`,
      ]
    : [];
  const uses = Object.entries(useAt(key, next, P, s.cfg, R.research)).map(
    ([res, use]) =>
      `${RESOURCE_NAMES[res]}verbrauch auf Stufe ${next}: ${ENERGY.format(use)} pro Stunde`,
  );
  return [...energy, ...uses];
}

const BUILD_WAITS: Partial<Record<BuildState, Note>> = {
  missing: LOCKED,
  queueBusy: note('dim', 'Bauschleife belegt'),
  yardBusy: note('dim', 'Schiffsschmiede arbeitet gerade'),
  labBusy: note('dim', 'Scholarium forscht gerade'),
  full: note('req', 'Keine freien Felder.'),
};

function buildAction(
  v: V,
  status: BuildState,
  level: number,
  cost: Cost,
  short: number,
): CatalogAction {
  const { P, now } = v;
  const bq = P.bq;
  if (status === 'running' && bq)
    return {
      kind: 'upgrading',
      level: bq.lvl,
      end: bq.end,
      left: dur(bq.end - now),
      max: bq.end - bq.start,
      value: Math.min(now - bq.start, bq.end - bq.start),
    };
  if (status === 'noEnergy') return noEnergy(short);
  return (
    BUILD_WAITS[status] ?? {
      kind: 'start',
      act: 'build',
      label: level ? `Ausbauen auf Stufe ${level + 1}` : 'Bauen',
      disabled: !afford(P, cost),
    }
  );
}

function buildingRow(v: V, key: string): CatalogRow {
  const { P, R, s } = v;
  const def = BUILD[key]!;
  const level = P.b[key] ?? 0;
  const cost = lvlCost(def, level + 1);
  const short = energyShort(def, level + 1, P, s.cfg, R.research);
  const missing = reqMissing(def, P, R).length;
  const full = fieldsFull(P, s.cfg);
  const status = buildState(P, R, key, missing, full, short);
  return {
    ...entry(v, key, 'ic-b', stage(level)),
    running: status === 'running',
    cost,
    energy: energyCost(
      energyNeed(def, level + 1),
      () => prod(P, s.cfg, R.research).eProd,
    ),
    lines: [
      ...useLines(v, key, level),
      `Bauzeit: ${dur(buildTime(cost, P, s.cfg))}`,
    ],
    req: def.req,
    action: buildAction(v, status, level, cost, short),
  };
}

// ----- research -----

/** The name of the own planet where the running research started (#49). */
function researchPlace(v: V): string {
  const id = v.R.rq?.planet ?? v.s.homePlanet;
  if (id === v.P.id) return v.P.name;
  return v.s.galaxy.find((p) => p.id === id)?.name ?? '';
}

const RESEARCH_WAITS: Partial<Record<ResearchUiState, Note>> = {
  missing: LOCKED,
  busy: note('dim', 'Es wird bereits geforscht'),
  labBusy: note('dim', 'Scholarium wird ausgebaut'),
};

function researchAction(
  v: V,
  state: ResearchUiState,
  level: number,
  cost: Cost,
  short: number,
): CatalogAction {
  const { P, R, now } = v;
  const rq = R.rq;
  if (state === 'running' && rq)
    return {
      kind: 'researching',
      level: rq.lvl,
      place: researchPlace(v),
      end: rq.end,
      left: rq.end > now ? dur(rq.end - now) : null,
    };
  if (state === 'noEnergy') return noEnergy(short);
  return (
    RESEARCH_WAITS[state] ?? {
      kind: 'start',
      act: 'research',
      label: `Forschen${level ? ` (Stufe ${level + 1})` : ''}`,
      disabled: !afford(P, cost),
    }
  );
}

function researchRow(v: V, key: string): CatalogRow {
  const { P, R, s } = v;
  const def = RES[key]!;
  const level = R.research[key] ?? 0;
  const cost = lvlCost(def, level + 1);
  const lab = networkLab(key, labSite(P), s.labs, R.research.ifn ?? 0);
  const linked =
    lab === (P.b.lab ?? 0) ? '' : ` (Scholarien zusammen Stufe ${lab})`;
  const short = energyShort(def, level + 1, P, s.cfg, R.research);
  const state = researchState(P, R, key, reqMissing(def, P, R).length, short);
  return {
    ...entry(v, key, 'ic-r', stage(level)),
    running: false,
    cost,
    energy: energyCost(
      energyNeed(def, level + 1),
      () => production(P, s.cfg, R.research).eProd,
    ),
    lines: [
      `Forschungszeit: ${dur(researchTime(cost, { b: { lab } }, s.cfg))}${linked}`,
    ],
    req: def.req,
    action: researchAction(v, state, level, cost, short),
  };
}

/** Without a lab here: the own planets that have one (#49). */
function noLab(v: V): CatalogPage {
  const places = v.s.labs
    .filter((l) => l.lab > 0 && l.id !== v.P.id)
    .map((l) => v.s.galaxy.find((p) => p.id === l.id))
    .filter((p) => !!p)
    .map((p) => ({ id: p.id, name: p.name }));
  return {
    blocked: true,
    title: 'Forschung',
    notice: places.length
      ? 'Auf diesem Planeten gibt es kein Scholarium. Geforscht wird auf einem deiner Planeten mit Scholarium.'
      : 'Für Forschung brauchst du ein Scholarium.',
    places,
  };
}

/** The lab of this planet and how many others the IFN may link. */
function labLine(v: V): string {
  const ifn = v.R.research.ifn ?? 0;
  const net = ifn
    ? ` · Sternennetz der Gelehrten: bis zu ${ifn} weitere${ifn === 1 ? 's Scholarium' : ' Scholarien'}`
    : '';
  return `Scholarium Stufe ${v.P.b.lab ?? 0}${net}`;
}

// ----- shipyard and defense -----

/** Speed of a flying ship; a ship that switches its drive names it (#57). */
function speedText(v: V, key: string): string {
  const drive = SHIPS[key]!.drives ? activeDrive(key, v.R)!.drive : null;
  const name = drive ? ` (${text(drive)!.n})` : '';
  return ` · Tempo ${fmt(shipSpeed(key, v.R))}${name}`;
}

/** The energy of one piece of a ship that makes energy, „je …“ from its texts (#114). */
function energyText(v: V, key: string): string {
  const e = pieceEnergy(key, v.P, v.s.cfg, v.R.research);
  if (e === undefined) return '';
  const per = text(key)?.per;
  return ` · Energie ${fmt(e)}${per ? ` ${per}` : ''}`;
}

/** Attack, shield and structure with the research, cargo and speed of a ship. */
function stats(v: V, key: string, d: UnitDef): string {
  const tech = v.R.research;
  const c = d.cost;
  const ship = canFly(key) ? SHIPS[key] : undefined;
  const cargo = ship ? ` · Ladung ${fmt(ship.cargo)}` : '';
  const speed = ship ? speedText(v, key) : '';
  return `Angriff ${fmt(d.atk * (1 + 0.1 * (tech.weapons ?? 0)))} · Schild ${fmt(d.sh * (1 + 0.1 * (tech.shield ?? 0)))} · Struktur ${fmt((c[0] + c[1]) * (1 + 0.1 * (tech.armor ?? 0)))}${cargo}${speed}${energyText(v, key)}`;
}

function unitRow(
  v: V,
  key: string,
  d: UnitDef,
  cls: string,
  have: Levels,
): CatalogRow {
  const { P, R, s } = v;
  // The component `limit` of 1, the shield domes (#50).
  const once = (d as { once?: true }).once === true;
  const max = orderMax(P, key);
  return {
    ...entry(
      v,
      key,
      cls,
      `(vorhanden: ${fmt(have[key] ?? 0)}${once ? ' · max. 1' : ''})`,
    ),
    running: false,
    cost: d.cost,
    lines: [
      stats(v, key, d),
      `Bauzeit: ${dur(unitTime(d, P, s.cfg))} je Einheit`,
    ],
    req: d.req,
    action: reqMissing(d, P, R).length
      ? LOCKED
      : { kind: 'order', max, once, disabled: !!yardLockedBy(P) || max === 0 },
  };
}

/** The orders of the shipyard: when the next unit is done, then each unit's time. */
function queue(v: V): QueueRow[] {
  const { P, now } = v;
  return P.sq.map((q, i) => {
    const end = (P.sqT ?? now) + q.unit;
    return {
      label: `${fmt(q.n)}× ${text(q.key)?.n}`,
      next: i === 0 ? { end, left: end > now ? dur(end - now) : null } : null,
      each: `je ${dur(q.unit)}`,
    };
  });
}

/** Why the shipyard cannot produce while `key` is upgraded (#48). */
export const lockNotice = (key: string): string =>
  key === 'yard'
    ? 'Die Schiffsschmiede wird gerade ausgebaut und kann nicht produzieren.'
    : `Die ${YARD_LOCK[key]} wird gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.`;

function yardPage(
  v: V,
  title: string,
  defs: Readonly<Record<string, UnitDef>>,
  cls: string,
  have: Levels,
): CatalogPage {
  if (!((v.P.b.yard ?? 0) > 0))
    return {
      blocked: true,
      title,
      notice: 'Dafür brauchst du eine Orbitale Schiffsschmiede.',
      places: [],
    };
  const lock = yardLockedBy(v.P);
  return {
    blocked: false,
    title,
    line: null,
    queue: queue(v),
    warn: lock ? lockNotice(lock) : null,
    rows: Object.entries(defs).map(([k, d]) => unitRow(v, k, d, cls, have)),
  };
}

// ----- the pages -----

const PAGES: Readonly<Record<CatalogKind, (v: V) => CatalogPage>> = {
  // Only what stands on this place: a planet or a moon (#53).
  building: (v) => ({
    blocked: false,
    title: 'Gebäude',
    line: { id: 'fields', text: fieldsLine(v.P, v.s.cfg) },
    queue: [],
    warn: null,
    rows: Object.keys(BUILD)
      .filter((k) => buildable(k, v.P.kind))
      .map((k) => buildingRow(v, k)),
  }),
  // Research starts on the shown planet when it has a lab (#49).
  research: (v) =>
    (v.P.b.lab ?? 0) > 0
      ? {
          blocked: false,
          title: `Forschung auf ${placeName(v.P)}`,
          line: { text: labLine(v) },
          queue: [],
          warn: null,
          rows: Object.keys(RES).map((k) => researchRow(v, k)),
        }
      : noLab(v),
  ship: (v) => yardPage(v, 'Schiffsschmiede', SHIPS, 'ic-s', v.P.ships),
  defense: (v) => yardPage(v, 'Verteidigung', DEF, 'ic-d', v.P.def),
};

/** The list of a kind on the shown planet. */
export const catalogPage = (v: V, kind: CatalogKind): CatalogPage =>
  PAGES[kind](v);
