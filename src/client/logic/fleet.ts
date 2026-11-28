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
import { type FleetChoice, fleetChoice, fleetTarget } from './fleet-choice.ts';
import type { FleetDraft } from './fleet-form.svelte.ts';
import { maxPosition, type QuickTarget, quickTargets } from './fleet-target.ts';
import { fmt } from './format.ts';
import { staysAt } from './game.ts';
import { jumpPanel } from './jump-gate.ts';
import {
  type Countdown,
  countdown,
  type FleetRow,
  fleetRows,
} from './overview.ts';
import { unionOpen } from '../../core/union.ts';
import {
  freeShips,
  joinChoices,
  PLAN,
  plannedStarts,
  unionRows,
} from './union.ts';

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

/**
 * How a union arrives and what a recall does with it, said under the box
 * (#466; owner, 2026-11-16, Q2) [V].
 */
export const UNION_HINT =
  'Alle Flotten des Verbands kommen zur geplanten Ankunft an; wer beitritt, startet sofort mit der Geschwindigkeit, die ihn genau dann ans Ziel bringt. Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um; ein Beteiligter ruft nur seine eigene zurück.';

/** A union of the box „Verbandsangriff“ with the countdown to its arrival. */
interface UnionBoxRow {
  id: string;
  title: string;
  due: Countdown;
  leader: string;
  counts: string;
  fleets: string;
  invited: string;
  /** The player leads it and the switch of the round is on: he can invite. */
  leads: boolean;
  /** The switch of the round is on: „Beitreten“ is offered (#466). */
  joins: boolean;
  /** The time to the planned start of the leader's fleet (#478); none once it flies. */
  start: Countdown | null;
}

/** The box „Verbandsangriff“; none while no union concerns the player. */
interface UnionBox {
  unions: UnionBoxRow[];
}

/** The target of the form the page starts with, and the limits of its fields. */
interface FleetTarget {
  g: number;
  s: number;
  p: number;
  galaxies: number;
  systems: number;
  /** The highest position of the field: the expedition position (#93). */
  positions: number;
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
  /** What the fields of the form show for the state of the form (logic/fleet-choice.ts); the component asks it, so a change of the state shows. */
  choose: (draft: FleetDraft) => FleetChoice;
  /** The unions the fleet can join (#225); empty when none. The one chosen is `choose(draft).union`. */
  unions: FleetOption[];
  /** A Sturmangriff can plan a union: the switch of the round is on (#466). */
  plans: boolean;
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

/**
 * The ships on the shown planet that can fly, in the order of the catalog;
 * without those a planned start holds back (#478).
 */
const fleetShips = ({ P, R, s }: V): FleetShip[] => {
  const free = freeShips(s, P);
  return Object.keys(SHIPS)
    .filter((k) => (free[k] ?? 0) > 0 && canFly(k))
    .map((k) => ({
      key: k,
      name: text(k)!.n,
      have: fmt(free[k]),
      speed: fmt(shipSpeed(k, R)),
    }));
};

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

/**
 * The box „Verbandsangriff“. While the switch of the round is off (#466),
 * the unions in flight stay listed with their arrival, but nothing opens,
 * invites or joins.
 */
function unionBox(v: V): UnionBox | null {
  const rows = unionRows(v);
  if (!rows.length) return null;
  const on = unionOpen(v.s.round);
  return {
    unions: rows.map((u) => ({
      ...u,
      leads: on && u.leads,
      joins: on,
      due: countdown(u.arr, v.now),
      start: u.start === null ? null : countdown(u.start, v.now),
    })),
  };
}

/** The unions the fleet form can join; none while the switch of the round is off (#466). */
function joinOptions(v: V): FleetOption[] {
  const choices = joinChoices(v);
  return choices.length && unionOpen(v.s.round)
    ? choices.map((c) => ({ value: c.id, label: c.label }))
    : [];
}

/** The choice of the row „Verband“ that plans a new union with a Sturmangriff (#466, A1a). */
export const PLAN_OPTION: FleetOption = {
  value: PLAN,
  label: 'Neuen Verband planen',
};

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

function formPage(v: V, full: boolean): FleetFormPage {
  const { P, s } = v;
  const t = fleetTarget(v);
  return {
    quick: quickTargets(s, P.id),
    target: {
      ...t,
      galaxies: s.cfg.galaxies,
      systems: s.cfg.systems,
      positions: maxPosition(s),
    },
    choose: (draft) => fleetChoice(v, draft, v.now),
    unions: joinOptions(v),
    // A Sturmangriff can plan a union while the switch of the round is on.
    plans: unionOpen(v.s.round),
    full,
  };
}

/** The fleet view of the shown planet. */
export function fleetPage(v: V): FleetPage {
  const slots = fleetSlots(v.R);
  // The gift of the „Endzeit“ (#161) and missiles (#54) take no slot.
  // A planned start takes its slot from the planning (#478).
  const used =
    v.s.fleets.filter((f) => f.owner === v.s.me.id && isFleet(f)).length +
    plannedStarts(v.s);
  return {
    heading: `Flotten unterwegs (${used} / ${slots} Slots)${expeditionTitle(v)}`,
    fleets: fleetRows(v, false),
    unions: unionBox(v),
    ships: fleetShips(v),
    form: formPage(v, used >= slots),
    jump: jumpBox(v),
  };
}
