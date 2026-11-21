// The Sternenkarte (#118, bundle 2; okf/architecture/patterns.md, section 9):
// what the component Galaxy shows, without the HTML of its rows: the
// navigation of galaxy and system, the panel of the last scan of the
// Auspex-Phalanx (#53), one row per position with its planet, owner, the
// moon and the Trümmerfeld (#45, #53), the words of the activity of a place
// and of the inactivity of its owner (#229) and the actions, and the number of
// Spähschädel of a spying. The symbols of a moon and a Trümmerfeld and the
// button „Bergung“ keep their HTML of logic/moon.ts and logic/debris.ts.
import { canFly } from '../../core/catalog.ts';
import { distance, fleetSpeed, flightMs } from '../../core/flight.ts';
import { expeditionLevel } from '../../core/expedition.ts';
import { canOffer } from '../../core/mission-fit.ts';
import { MISSION } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import { placeId } from '../../core/place.ts';
import type { Coords, Levels } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { freePosition } from './abandon.ts';
import { activityNote, inactivityNote } from './activity.ts';
import { debrisAt, debrisMark, harvestButton } from './debris.ts';
import { fitTarget } from './fleet-target.ts';
import { coords, dur, fmt } from './format.ts';
import { isProtected, nameOf, ranks } from './game.ts';
import { canLaunch } from './missiles.ts';
import { moonAt, moonMark } from './moon.ts';
import { type Countdown, countdown } from './overview.ts';
import { canScan, scanRows, scanTitle } from './phalanx.ts';
import { canSurvey } from './survey.ts';
import type { GalaxyPlanet } from './types.ts';

/**
 * One action of a row: a link (`span.lnk`) or a small button with its
 * attributes (`data-act` first), the dim name of the active place, or the
 * HTML of the button „Bergung“.
 */
export type GalaxyAction =
  | {
      kind: 'link' | 'button';
      label: string;
      attrs: Record<string, string>;
    }
  | { kind: 'active'; label: string }
  | { kind: 'html'; html: string };

/**
 * The actions of a position in the bottom sheet of a phone (#189, the „⋯“ of
 * the proposal): the same actions as the row, the name of the place and the
 * flight time to it.
 */
export interface GalaxySheet {
  /** The id of the place, or `free-<position>`; the „⋯“ and the sheet carry it. */
  id: string;
  /** The place with its position, e.g. „Kolonie [1:2:3]“. */
  title: string;
  /** „Flugzeit mit allen Schiffen: …“; none without a ship that flies. */
  flight: string | null;
  actions: GalaxyAction[];
}

/** A planet or a moon of a row with its owner and its actions. */
export interface GalaxyPlace extends Coords {
  /** The planet by its name, a moon with „(Mond)“. */
  name: string;
  /** The words of its public activity (#229), empty without one. */
  activity: string;
  mine: boolean;
  owner: string;
  /** The words of the owner's inactivity (#229), empty without one. */
  inactivity: string;
  /** The place of the owner in the highscore, „-“ when unknown. */
  rank: string;
  /** The noob protection between the player and a foreign owner. */
  protected: boolean;
  /** Whether the owner is in vacation mode (#223). */
  vacation: boolean;
  actions: GalaxyAction[];
  /** The „⋯“ of a phone; none when the place has no action but its own name. */
  sheet: GalaxySheet | null;
}

/** One position of the system. */
export interface GalaxyRow {
  position: number;
  /** The planet there, or null for a free position. */
  planet: GalaxyPlace | null;
  /** The HTML of the symbols of the moon and the Trümmerfeld, in this order. */
  marks: string[];
  /** The actions at a free position: „Landnahme“, „Vermessen“ (#190) and „Bergung“. */
  actions: GalaxyAction[];
  /** The note of a free position: „–“, or until when it is locked (#224). */
  note: string;
  /** The moon's row below the planet, once its symbol is opened (#53). */
  moon: GalaxyPlace | null;
  /** The „⋯“ of a free position, with its actions. */
  sheet: GalaxySheet | null;
}

/** One flight of the scan. */
interface ScanLine {
  ships: string;
  from: string;
  to: string;
  due: Countdown;
}

/** The panel of the last scan from the shown moon (#53). */
interface ScanPanel {
  title: string;
  flights: ScanLine[];
}

export interface GalaxyPage {
  gal: number;
  sys: number;
  galaxies: number;
  systems: number;
  scan: ScanPanel | null;
  rows: GalaxyRow[];
  /** The sheet that is open (`ui.gsheet`) while its place is on the page, else null. */
  sheet: GalaxySheet | null;
  /** The Spähschädel an Auspex-Erkundung sends. */
  probes: string;
}

/** The attributes of the position of a place, a moon with data-k="moon". */
function at(c: Coords, moon: boolean): Record<string, string> {
  const out: Record<string, string> = {
    'data-g': String(c.g),
    'data-s': String(c.s),
    'data-p': String(c.p),
  };
  if (moon) out['data-k'] = 'moon';
  return out;
}

/** The fleet form with a mission at a place, as a link or a button. */
const fleetTo = (
  kind: 'link' | 'button',
  mission: string,
  label: string,
  where: Record<string, string>,
): GalaxyAction => ({
  kind,
  label,
  attrs: { 'data-act': 'gfleet', 'data-m': mission, ...where },
});

/**
 * The scan of the Auspex-Phalanx at a foreign planet (#53): only from a
 * moon with a phalanx, at a planet in range.
 */
const scanButton = (v: V, pl: GalaxyPlanet): GalaxyAction[] =>
  canScan(v.P, pl)
    ? [
        {
          kind: 'button',
          label: 'Phalanx-Scan',
          attrs: {
            'data-act': 'gscan',
            'data-id': pl.id,
            'aria-label': `Phalanx-Scan von ${pl.name}`,
          },
        },
      ]
    : [];

/** The actions at a foreign planet or moon. */
function foreignActions(v: V, pl: GalaxyPlanet): GalaxyAction[] {
  const where = at(pl, pl.kind === 'moon');
  return [
    {
      kind: 'link',
      label: 'Auspex-Erkundung',
      attrs: { 'data-act': 'gspy', ...where },
    },
    fleetTo('link', 'attack', 'Sturmangriff', where),
    fleetTo('link', 'transport', 'Versorgungsflug', where),
    ...moonbreakLink(v, pl, where),
    ...scanButton(v, pl),
    ...missileButton(v, pl),
  ];
}

/**
 * The Mondbruch at a foreign moon (#95; owner, 2026-11-21): offered at every
 * moon of another player, whatever ships the shown planet has; it opens the
 * fleet form with the Mondbruch, which refuses a send without a Weltenbrecher.
 */
const moonbreakLink = (
  v: V,
  pl: GalaxyPlanet,
  where: Record<string, string>,
): GalaxyAction[] =>
  canOffer(
    'moonbreak',
    { owner: v.s.me.id, from: v.P.id },
    fitTarget(v.s, pl, v.now),
  )
    ? [fleetTo('link', 'moonbreak', MISSION.moonbreak, where)]
    : [];

/**
 * The Raketenangriff at a foreign planet or moon (#54): from a planet with
 * Orbitalraketen, at a target in their range; it opens the dialog.
 */
const missileButton = (v: V, pl: GalaxyPlanet): GalaxyAction[] =>
  canLaunch(v.P, v.R, pl)
    ? [
        {
          kind: 'button',
          label: 'Raketenangriff',
          attrs: {
            'data-act': 'gmissile',
            'data-id': pl.id,
            ...at(pl, pl.kind === 'moon'),
            'aria-label': `Raketenangriff auf ${placeName(pl)}`,
          },
        },
      ]
    : [];

/** The actions at an own planet or moon: none but its name while it is shown. */
function ownActions(v: V, pl: GalaxyPlanet): GalaxyAction[] {
  if (pl.id === v.P.id)
    return [
      {
        kind: 'active',
        label: pl.kind === 'moon' ? 'Aktiver Mond' : 'Aktiver Planet',
      },
    ];
  const where = at(pl, pl.kind === 'moon');
  return [
    {
      kind: 'button',
      label: 'Wechseln',
      attrs: { 'data-act': 'selectPlanet', 'data-id': pl.id },
    },
    fleetTo('button', 'transport', 'Versorgungsflug', where),
    fleetTo('button', 'deploy', MISSION.deploy, where),
  ];
}

/**
 * The flight time to a place for all ships of the shown planet that fly, at
 * full speed [V]: the proposal names „the flight time“ without saying for
 * which fleet.
 */
function flightLine(v: V, to: Coords): string | null {
  const flying: Levels = Object.fromEntries(
    Object.entries(v.P.ships).filter(([k, n]) => n > 0 && canFly(k)),
  );
  if (!Object.keys(flying).length) return null;
  const ms = flightMs(distance(v.P, to), fleetSpeed(flying, v.R), 10, v.s.cfg);
  return `Flugzeit mit allen Schiffen: ${dur(ms)}`;
}

/** The sheet of a place: its actions without the dim name of the active place; none when no action is left. */
function sheetOf(
  v: V,
  id: string,
  title: string,
  at: Coords,
  actions: GalaxyAction[],
): GalaxySheet | null {
  const list = actions.filter((a) => a.kind !== 'active');
  return list.length
    ? { id, title, flight: flightLine(v, at), actions: list }
    : null;
}

/** A planet or a moon of a row, with its owner, rank and protection. */
function place(
  v: V,
  pl: GalaxyPlanet,
  name: string,
  rk: Record<string, number>,
  extra: GalaxyAction[] = [],
): GalaxyPlace {
  const { s } = v;
  const mine = pl.owner === s.me.id;
  const actions = [
    ...(mine ? ownActions(v, pl) : foreignActions(v, pl)),
    ...extra,
  ];
  return {
    g: pl.g,
    s: pl.s,
    p: pl.p,
    name,
    activity: activityNote(pl.activity),
    mine,
    owner: nameOf(s.players, pl.owner),
    inactivity: inactivityNote(s.players[pl.owner]?.inactive),
    rank: String(rk[pl.owner] ?? '-'),
    protected: !mine && isProtected(s.players, s.me.id, pl.owner),
    vacation: !!s.players[pl.owner]?.vacation,
    actions,
    sheet: sheetOf(v, pl.id, `${name} ${coords(pl)}`, pl, actions),
  };
}

/** „Landnahme“ at a free position, with a colony ship on the shown planet. */
const colonize = (v: V, c: Coords): GalaxyAction[] =>
  v.P.ships.colony
    ? [fleetTo('button', 'colonize', 'Landnahme', at(c, false))]
    : [];

/** „Vermessen“ at a free position, with Spähschädel and the research (#190). */
const survey = (v: V, c: Coords): GalaxyAction[] =>
  canSurvey(v.R.research, v.P.ships)
    ? [
        {
          kind: 'button',
          label: 'Vermessen',
          attrs: { 'data-act': 'gspy', 'data-m': 'survey', ...at(c, false) },
        },
      ]
    : [];

/**
 * „Expedition“ at the expedition position (#93): with level 1 of the
 * research and a ship on the shown planet that flies.
 */
const expedition = (v: V, c: Coords): GalaxyAction[] =>
  expeditionLevel(v.R.research) >= 1 &&
  Object.entries(v.P.ships).some(([k, n]) => n > 0 && canFly(k))
    ? [fleetTo('button', 'expedition', MISSION.expedition, at(c, false))]
    : [];

/** The note of the expedition position, in place of a free one. */
const EXPEDITION_NOTE = 'Expeditionsposition';

/** A row without a planet: its note, actions and marks, and the sheet of its actions (#189). */
function emptyRow(
  v: V,
  c: Coords,
  marks: string[],
  actions: GalaxyAction[],
  note: string,
  title: string,
): GalaxyRow {
  return {
    position: c.p,
    planet: null,
    marks,
    actions,
    note,
    moon: null,
    sheet: sheetOf(v, `free-${c.p}`, `${title} ${coords(c)}`, c, actions),
  };
}

/** The row of position `p` of the shown system. */
function galaxyRow(v: V, p: number, rk: Record<string, number>): GalaxyRow {
  const { s, ui } = v;
  const c = { g: ui.gal, s: ui.sys, p };
  const pl = s.galaxy.find((x) => x.id === placeId({ ...c, kind: 'planet' }));
  // A Trümmerfeld for every player, with its button (#45).
  const field = debrisAt(s.debris, c);
  // A moon for every player, its symbol opens its actions (#53).
  const moon = moonAt(s.galaxy, c);
  const open = !!moon && ui.gmoon === moon.id;
  const marks: string[] = [];
  if (moon) marks.push(moonMark(moon, open));
  if (field) marks.push(debrisMark(field));
  const harvest: GalaxyAction[] = field
    ? [{ kind: 'html', html: harvestButton(c) }]
    : [];
  // The position after the last planet position: no planet, only expeditions
  // and the Bergung of its Trümmerfeld (#93).
  if (p > s.cfg.positions)
    return emptyRow(
      v,
      c,
      marks,
      [...expedition(v, c), ...harvest],
      EXPEDITION_NOTE,
      EXPEDITION_NOTE,
    );
  if (!pl) {
    // A position locked after an abandonment says until when (#224).
    const free = freePosition(s.locks, c, v.now);
    // A locked position offers neither the Landnahme nor the Vermessen
    // (owner, 2026-11-18, #190); the Bergung stays.
    const offered = free.colonize ? [...colonize(v, c), ...survey(v, c)] : [];
    return emptyRow(
      v,
      c,
      marks,
      [...offered, ...harvest],
      free.note,
      'Position',
    );
  }
  const planet = place(v, pl, pl.name, rk, harvest);
  return {
    position: p,
    planet,
    marks,
    actions: [],
    note: '',
    moon: open ? place(v, moon, placeName(moon), rk) : null,
    sheet: null,
  };
}

/** The answer of the last scan, while the moon it came from is shown (#53). */
function scanPanel(v: V): ScanPanel | null {
  const scan = v.ui.scan;
  if (!scan || scan.by !== v.P.id) return null;
  return {
    title: scanTitle(scan, v.s.galaxy),
    flights: scanRows(scan).map((r) => ({
      ships: r.ships,
      from: r.from,
      to: r.to,
      due: countdown(r.arr, v.now),
    })),
  };
}

/** The sheet `id` names, while its place is on the page: of a planet, of its moon or of a free position. */
const openSheet = (
  rows: GalaxyRow[],
  id: string | null | undefined,
): GalaxySheet | null =>
  (id &&
    rows
      .flatMap((r) => [r.sheet, r.planet?.sheet, r.moon?.sheet])
      .find((x) => x?.id === id)) ||
  null;

/** The Sternenkarte of the system `ui.gal`:`ui.sys`. */
export function galaxyPage(v: V): GalaxyPage {
  const { s, ui } = v;
  const rk = ranks(s.players);
  const rows = Array.from({ length: s.cfg.positions + 1 }, (_, i) =>
    galaxyRow(v, i + 1, rk),
  );
  return {
    gal: ui.gal,
    sys: ui.sys,
    galaxies: s.cfg.galaxies,
    systems: s.cfg.systems,
    scan: scanPanel(v),
    rows,
    sheet: openSheet(rows, ui.gsheet),
    probes: fmt(s.me.probes || 1),
  };
}

/**
 * The place an action of the Sternenkarte names by its data-g, data-s,
 * data-p and data-k (`at()`): the target of the fleet form and of a spying.
 */
export const targetOf = (
  d: Readonly<Record<string, string | undefined>>,
): Coords & { kind: 'planet' | 'moon' } => ({
  g: Number(d.g),
  s: Number(d.s),
  p: Number(d.p),
  kind: d.k === 'moon' ? 'moon' : 'planet',
});
