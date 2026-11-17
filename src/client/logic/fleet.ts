// The fleet view (#118, bundle 3; okf/architecture/patterns.md, section 9):
// what the component Fleet shows: the fleets on their way with the slots,
// the ships to choose, and the form of target, mission, speed and cargo
// (#240). Also what main.ts writes beside the form while the player types:
// the target (#45, #53) and the preview of the flight.
import { canFly, SHIPS } from '../../core/catalog.ts';
import { fleetSlots, shipSpeed } from '../../core/flight.ts';
import { MISSION, missionRules } from '../../core/missions.ts';
import { placeId } from '../../core/place.ts';
import { text } from '../../core/text.ts';
import type { Resources } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { debrisAt, debrisTip } from './debris.ts';
import { dt, dur, esc, fmt } from './format.ts';
import { type FleetForm, type FleetPreview, nameOf } from './game.ts';
import { moonAt, moonTarget } from './moon.ts';
import { type FleetRow, fleetRows } from './overview.ts';
import type { GameState } from './types.ts';

/** A ship on the shown planet that can fly. */
interface FleetShip {
  key: string;
  name: string;
  /** How many stand there. */
  have: string;
  speed: string;
}

/** An option of a select. */
export interface FleetOption {
  value: string;
  label: string;
  selected: boolean;
}

/** A cargo field with its own „alles“ (#240). */
export interface CargoField {
  key: keyof Resources;
  name: string;
}

/** The target of the form: the place, and whether its moon can be chosen. */
interface FleetTarget {
  g: number;
  s: number;
  p: number;
  galaxies: number;
  systems: number;
  positions: number;
  /** A moon is there (#53); else „Mond“ is disabled. */
  moon: boolean;
  /** The moon is the chosen target. */
  toMoon: boolean;
}

export interface FleetPage {
  /** „used / slots“ of the fleet slots. */
  slots: string;
  fleets: FleetRow[];
  /** Empty: the planet has no ship that flies, and there is no form. */
  ships: FleetShip[];
  target: FleetTarget;
  missions: FleetOption[];
  speeds: FleetOption[];
  cargo: readonly CargoField[];
  /** All slots are taken: „Flotte losschicken“ is disabled. */
  full: boolean;
}

export const CARGO_FIELDS: readonly CargoField[] = [
  { key: 'm', name: 'Adamant' },
  { key: 'c', name: 'Psikristall' },
  { key: 'd', name: 'Promethium' },
];

/** The speeds of a flight, 100 % first. */
const SPEEDS: FleetOption[] = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((x) => ({
  value: String(x),
  label: `${x * 10} %`,
  selected: false,
}));

/**
 * The missions of the list „Auftrag“, in the order of `MISSION`, the chosen
 * one selected. `fits` keeps only the missions it accepts; by default all.
 */
export const missionOptions = (
  chosen: string,
  fits: (mission: string) => boolean = () => true,
): FleetOption[] =>
  Object.entries(MISSION)
    .filter(([k]) => fits(k))
    .map(([k, name]) => ({ value: k, label: name, selected: chosen === k }));

/** The ships on the shown planet that can fly, in the order of the catalog. */
const fleetShips = ({ P, R }: V): FleetShip[] =>
  Object.keys(SHIPS)
    .filter((k) => (P.ships[k] ?? 0) > 0 && canFly(k))
    .map((k) => ({
      key: k,
      name: text(k)!.n,
      have: fmt(P.ships[k]),
      speed: fmt(shipSpeed(k, R)),
    }));

/** The target of the form: the one chosen on the Sternenkarte, or here. */
function fleetTarget({ P, s, ui }: V): FleetTarget {
  const t = ui.ft ?? { g: P.g, s: P.s, p: P.p };
  // „Mond“ only where one is (#53); main.ts updates it with the coordinates.
  const moon = !!moonAt(s.galaxy, t);
  return {
    g: t.g,
    s: t.s,
    p: t.p,
    galaxies: s.cfg.galaxies,
    systems: s.cfg.systems,
    positions: s.cfg.positions,
    moon,
    toMoon: moon && t.kind === 'moon',
  };
}

/** The fleet view of the shown planet. */
export function fleetPage(v: V): FleetPage {
  const slots = fleetSlots(v.R);
  // The gift of the „Endzeit“ takes no slot (#161).
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && !f.gift,
  ).length;
  return {
    slots: `${used} / ${slots}`,
    fleets: fleetRows(v, false),
    ships: fleetShips(v),
    target: fleetTarget(v),
    missions: missionOptions(v.ui.fm),
    speeds: SPEEDS,
    cargo: CARGO_FIELDS,
    full: used >= slots,
  };
}

/**
 * Beside the target: its planet and owner, a free position, or none; for a
 * Bergung the Trümmerfeld there, or none (#45). HTML.
 */
export function targetInfo(s: GameState, f: FleetForm): string {
  const rules = missionRules(f.mission);
  if (rules?.target === 'debris') {
    const field = debrisAt(s.debris, f.to);
    return field
      ? debrisTip(field)
      : '<span class="bad">kein Trümmerfeld</span>';
  }
  if (f.to.kind === 'moon')
    return moonTarget(moonAt(s.galaxy, f.to), (id) => nameOf(s.players, id));
  const target = s.galaxy.find(
    (p) => p.id === placeId({ ...f.to, kind: 'planet' }),
  );
  if (target)
    return `${esc(target.name)} (${esc(nameOf(s.players, target.owner))})`;
  return rules?.target === 'free'
    ? 'Freie Position'
    : '<span class="bad">kein Planet</span>';
}

/** The cells of the preview by their ids. */
type PreviewCells = Record<
  'i_dist' | 'i_dur' | 'i_arr' | 'i_fuel' | 'i_cap',
  string
>;

/** The return time, or none for a mission that stays at its target (deploy, #129). */
const returnAt = (mission: string, t: number): string =>
  missionRules(mission)?.returns === false ? '–' : dt(t);

/** The class of a value that is too much, or none. */
const bad = (on: boolean): string => `<span class="${on ? 'bad' : ''}">`;

/**
 * The cells of the preview by their ids, as HTML: „-“ in each without a
 * ship; else the distance, the time of one way, arrival and return, the
 * Promethium it burns and the load (marked when it is too much).
 */
export function previewCells(
  pv: FleetPreview | null,
  mission: string,
  now: number,
): PreviewCells {
  if (!pv)
    return { i_dist: '-', i_dur: '-', i_arr: '-', i_fuel: '-', i_cap: '-' };
  return {
    i_dist: fmt(pv.dist),
    i_dur: dur(pv.ms),
    i_arr: `${dt(now + pv.ms)} / ${returnAt(mission, now + 2 * pv.ms)}`,
    i_fuel: `${bad(pv.fuelShort)}${fmt(pv.fuel)}</span> Promethium`,
    i_cap: `${bad(pv.overload)}${fmt(pv.load)}</span> / ${fmt(pv.cap)}`,
  };
}
