// What the fleet view shows (#118, bundle 3; okf/architecture/patterns.md,
// section 9), without HTML: the fleets on their way with the slots, the
// attack unions (#225), the ships to choose, the form of target, mission,
// speed and cargo (#240, #253), and the box of the Warp-Tor (#230). The
// component Fleet renders it; what the fleet form writes while the player
// types is in features/fleet.ts.
import { canFly, SHIPS } from '../../core/catalog.ts';
import {
  expeditionLevel,
  expeditionSlots,
  extraSlots,
} from '../../core/expedition.ts';
import { fleetSlots, shipSpeed } from '../../core/flight.ts';
import { isFleet } from '../../core/missions.ts';
import { text } from '../../core/text.ts';
import type { Resources } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { colonyNote } from './colony-limit.ts';
import {
  maxPosition,
  missionOptions,
  offeredMissions,
  type QuickTarget,
  quickTargets,
} from './fleet-target.ts';
import { timeRowHtml } from './fleet-time.ts';
import { fmt } from './format.ts';
import { staysAt } from './game.ts';
import { jumpPanel } from './jump-gate.ts';
import { moonAt } from './moon.ts';
import {
  type Countdown,
  countdown,
  type FleetRow,
  fleetRows,
} from './overview.ts';
import { joinChoices, openRows, unionRows } from './union.ts';

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
  selected?: boolean;
  disabled?: boolean;
}

/** A cargo field with its own „alles“ (#240). */
export interface CargoField {
  key: keyof Resources;
  name: string;
}

export const CARGO_FIELDS: readonly CargoField[] = [
  { key: 'm', name: 'Adamant' },
  { key: 'c', name: 'Psikristall' },
  { key: 'd', name: 'Promethium' },
];

/** The speeds of a flight, 100 % first. */
export const SPEEDS: readonly FleetOption[] = [
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
].map((x) => ({ value: String(x), label: `${x * 10} %` }));

/** What a recall does with a union, said under the box (owner, 2026-11-16, Q2). */
export const UNION_HINT =
  'Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um; ein Beteiligter ruft nur seine eigene zurück.';

/** A union of the box „Verbandsangriff“ with the countdown to its arrival. */
interface UnionBoxRow {
  id: string;
  title: string;
  due: Countdown;
  leader: string;
  counts: string;
  fleets: string;
  invited: string;
  leads: boolean;
}

/** An own Sturmangriff that can open a union. */
interface OpenBoxRow {
  id: string;
  target: string;
  due: Countdown;
}

/** The box „Verbandsangriff“; none while no union concerns the player and no attack can open one. */
interface UnionBox {
  unions: UnionBoxRow[];
  open: OpenBoxRow[];
}

/** The target of the form: the place, and whether its moon can be chosen. */
interface FleetTarget {
  g: number;
  s: number;
  p: number;
  galaxies: number;
  systems: number;
  /** The highest position of the field: the expedition position (#93). */
  positions: number;
  /** A moon is there (#53); else „Mond“ is disabled. */
  moon: boolean;
  /** The moon is the chosen target. */
  toMoon: boolean;
}

/** The box „Warp-Tor“ on a moon with one (#230). */
interface JumpBox {
  targets: FleetOption[];
  /** „Springen“ is offered. */
  canJump: boolean;
  /** When the gate is ready again, if it cools down. */
  cooling: Countdown | null;
}

/** The form „2. Ziel und Auftrag“. */
interface FleetFormPage {
  quick: readonly QuickTarget[];
  target: FleetTarget;
  /** The options of the list „Auftrag“ as HTML, which the form writes again when the target changes (features/fleet.ts). */
  missions: string;
  /** The mission the list ends on, or empty when none fits the target (#253). */
  mission: string;
  /** The planets against the limit for a Landnahme (#237). */
  limit: string;
  /** The unions the fleet can join (#225), the chosen one selected; empty when none. */
  unions: FleetOption[];
  /** The row of the time at the target as HTML, which the form writes again when the mission changes (features/fleet.ts). */
  time: string;
  /** All slots are taken: „Flotte losschicken“ is disabled. */
  full: boolean;
}

export interface FleetPage {
  /** „Flotten unterwegs (used / slots Slots)“ and the expeditions (#93). */
  heading: string;
  fleets: FleetRow[];
  unions: UnionBox | null;
  /** Empty: the planet has no ship that flies, and there is no form. */
  ships: FleetShip[];
  form: FleetFormPage;
  jump: JumpBox | null;
}

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

/**
 * „ · Expeditionen (n / m)“ once the research is there (#93): the own fleets
 * of a mission that stays against the slots the level allows.
 */
function expeditionTitle(v: V): string {
  const level = expeditionLevel(v.R.research);
  if (level < 1) return '';
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && staysAt(f.mission),
  ).length;
  return ` · Expeditionen (${used} / ${expeditionSlots(level, extraSlots(v.s.cfg))})`;
}

function unionBox(v: V): UnionBox | null {
  const unions = unionRows(v).map((u) => ({
    ...u,
    due: countdown(u.arr, v.now),
  }));
  const open = openRows(v).map((f) => ({
    id: f.id,
    target: f.target,
    due: countdown(f.arr, v.now),
  }));
  return unions.length || open.length ? { unions, open } : null;
}

function jumpBox(v: V): JumpBox | null {
  const panel = jumpPanel(v.s, v.P, v.now);
  if (!panel) return null;
  return {
    targets: panel.targets.map((t) => ({
      value: t.id,
      label: t.label,
      disabled: t.disabled,
    })),
    canJump: panel.canJump,
    cooling: panel.cooling === null ? null : countdown(panel.cooling, v.now),
  };
}

/** The target the form starts with: the one chosen elsewhere (the Sternenkarte, a union), else the shown planet. */
export const fleetTarget = ({
  P,
  ui,
}: Pick<V, 'P' | 'ui'>): NonNullable<V['ui']['ft']> =>
  ui.ft ?? { g: P.g, s: P.s, p: P.p };

function formPage(v: V, full: boolean): FleetFormPage {
  const { P, s, ui } = v;
  const t = fleetTarget(v);
  // „Mond“ only where one is (#53); the form updates it with the coordinates.
  const moon = !!moonAt(s.galaxy, t);
  // Only the missions that fit the target (#253); missiles start in the
  // Sternenkarte, not here (#54).
  const { html, selected } = missionOptions(
    offeredMissions(s, P.id, t, v.now),
    ui.fm,
  );
  return {
    quick: quickTargets(s, P.id),
    target: {
      ...t,
      galaxies: s.cfg.galaxies,
      systems: s.cfg.systems,
      positions: maxPosition(s),
      moon,
      toMoon: moon && t.kind === 'moon',
    },
    missions: html,
    mission: selected,
    limit: colonyNote(s, selected),
    unions: joinChoices(v).map((c) => ({
      value: c.id,
      label: c.label,
      selected: ui.union === c.id,
    })),
    time: timeRowHtml(selected, v),
    full,
  };
}

/** The fleet view of the shown planet. */
export function fleetPage(v: V): FleetPage {
  const slots = fleetSlots(v.R);
  // The gift of the „Endzeit“ (#161) and missiles (#54) take no slot.
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && isFleet(f),
  ).length;
  return {
    heading: `Flotten unterwegs (${used} / ${slots} Slots)${expeditionTitle(v)}`,
    fleets: fleetRows(v, false),
    unions: unionBox(v),
    ships: fleetShips(v),
    form: formPage(v, used >= slots),
    jump: jumpBox(v),
  };
}
