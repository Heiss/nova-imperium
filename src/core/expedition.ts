// Expeditions (#93, okf/features/expeditions.md; owner, 2026-11-16 and
// 2026-11-17): the rules of the mission „Expedition“ and of its research
// „Kreuzzugs-Kartografie“ (classic Expeditionstechnik), pure and without a
// random source of their own: every draw takes the generator it is given.
// The values are those of the owner's sources, owiki.de „Expedition“
// (version 1.4.1 on), „Expeditionstechnik“ and the discussion page of
// „Expedition“; without Dunkle Materie and without the Händler (#171).
import type { Rng } from './battle.ts';
import type { RoundGroup, RoundSetting, SettingExplain } from './round.ts';
import { HOUR_MS } from './vacation.ts';
import type { Coords, Levels, Resources, Universe } from './types.ts';

// ----- slots, stay and the position (Q3, Q4) -----

/** The research that unlocks expeditions and sets their slots and stay. */
const RESEARCH = 'expo';

/** The level of the research of expeditions, 0 without it. */
export const expeditionLevel = (research: Levels | undefined): number =>
  research?.[RESEARCH] ?? 0;

/**
 * Expeditions at the same time: ⌊√level⌋ (owner, 2026-11-16, Q3) from level
 * 1 on, plus the `extra` places the round adds (owner, 2026-11-19); none
 * without the research.
 */
export const expeditionSlots = (level: number, extra = 0): number =>
  level >= 1 ? Math.floor(Math.sqrt(level)) + extra : 0;

/**
 * The longest stay at the expedition position in hours: the level times the
 * hours per level of the round, 1 by default (Q3; owner, 2026-11-19).
 */
export const maxStayHours = (level: number, perLevel = 1): number =>
  level * perLevel;

/**
 * The expedition position of every system: the one right after the last
 * planet position, 16 with 15 positions and 21 with 20 (Q4).
 */
export const expeditionPosition = (u: Pick<Universe, 'positions'>): number =>
  u.positions + 1;

/** Whether a position is the expedition position of a system of the universe. */
export const isExpeditionPlace = (c: Coords, u: Universe): boolean =>
  c.g <= u.galaxies && c.s <= u.systems && c.p === expeditionPosition(u);

/**
 * How long an expedition stays at its position, in milliseconds: the time
 * between its arrival and the end of its stay is stored in the fleet as
 * `arr` (the end of the stay) and `ret` (arr + the flight home), so the stay
 * is what lies between the flight out and the flight home.
 */
export const stayOf = (f: { dep: number; arr: number; ret: number }): number =>
  f.arr - f.dep - (f.ret - f.arr);

// ----- the settings of the round (owner, 2026-11-19; #93, #310) -----

/** The range of the extra expedition places: 0 to 10 [V], 0 by default (the classic ⌊√level⌋). */
export const EXTRA_SLOTS = { min: 0, max: 10, def: 0 } as const;

/** The range of the hours per level: 1 to 24 [V], 1 by default (classic: as many hours as levels). */
export const HOURS_PER_LEVEL = { min: 1, max: 24, def: 1 } as const;

/** The legend of the three settings in the dialog „Neue Runde“ and in the universe settings. */
const EXPEDITIONS: RoundGroup = { name: 'expedition', legend: 'Expeditionen' };

/**
 * The heading of these settings in the admin panel (#357), the name the game
 * uses for the feature: the page of the Lexicanum and the changelog entry „Expeditionen“ [V].
 */
export const roundHeading = 'Expeditionen';

/** The levels of the research that the tables of the explanations show (#358). */
const EXPO_LEVELS = [1, 4, 9, 16];
const EXPO = 'expo';

/** The expedition slots at a level of the research (#358). */
const SLOT_ROWS: SettingExplain['rows'] = EXPO_LEVELS.map((level) => ({
  label: (name) => `${name(EXPO)} Stufe ${level}: Expeditionsplätze`,
  cell: ({ u }) => expeditionSlots(level, extraSlots(u)),
}));

/** The longest stay at a level, as long as it really lasts (#358). */
const STAY_ROWS: SettingExplain['rows'] = EXPO_LEVELS.map((level) => ({
  label: (name) => `${name(EXPO)} Stufe ${level}: längste Haltezeit`,
  cell: ({ u }) => ({
    ms: stayDuration(maxStayHours(level, hoursPerLevel(u)), u),
  }),
}));

/**
 * The three settings of expeditions as entries of the registry (#283, #310):
 * number fields of the dialog „Neue Runde“ in one fieldset and, `live`, rows
 * of the universe settings, changed during the round (X1). The switch is a
 * number of 1 (yes) and 0 (no), because a switch of the registry cannot be
 * live (as the marketplace does). The order numbers 300 to 315 lie between
 * the other features' settings and the marketplace [V]. The export under
 * this name registers them (src/core/round.ts).
 */
export const roundSettings = [
  {
    kind: 'number',
    group: EXPEDITIONS,
    live: true,
    key: 'roundExpeditionExtraSlots',
    explain: {
      text: 'So viele Expeditionen kann jeder Spieler zusätzlich gleichzeitig schicken, über die Plätze aus der Forschung hinaus. Geprüft beim Start.',
      rows: SLOT_ROWS,
      own: true,
    },
    name: 'expeditionExtraSlots',
    label: 'Zusätzliche Expeditionsplätze',
    order: 300,
    min: EXTRA_SLOTS.min,
    max: EXTRA_SLOTS.max,
    def: EXTRA_SLOTS.def,
  },
  {
    kind: 'number',
    group: EXPEDITIONS,
    live: true,
    key: 'roundExpeditionHours',
    explain: {
      text: 'Wie lange eine Expedition höchstens an der Expeditionsposition bleiben darf, je Stufe ihrer Forschung. Geprüft beim Start; laufende Expeditionen behalten ihre Zeit.',
      rows: STAY_ROWS,
      own: true,
    },
    name: 'expeditionHours',
    label: 'Haltezeit in Stunden je Stufe',
    order: 310,
    min: HOURS_PER_LEVEL.min,
    max: HOURS_PER_LEVEL.max,
    def: HOURS_PER_LEVEL.def,
  },
  {
    kind: 'number',
    group: EXPEDITIONS,
    live: true,
    key: 'roundExpeditionSpeed',
    explain: {
      text: 'Ja: Die Haltezeit einer Expedition wird wie eine Flugzeit durch das Tempo des Universums geteilt. Nein: Sie läuft in Echtzeit. Gilt ab dem nächsten Start.',
      rows: STAY_ROWS,
    },
    name: 'expeditionSpeed',
    label: 'Haltezeit durch das Universums-Tempo teilen',
    order: 315,
    min: 0,
    max: 1,
    def: 0,
    choices: [
      { value: 0, label: 'Nein' },
      { value: 1, label: 'Ja' },
    ],
  },
] as const satisfies readonly RoundSetting[];

/** The extra expedition places of the universe's round. */
export const extraSlots = (u: Universe): number =>
  u[roundSettings[0].key] as number;

/** The hours of stay per level of the research in the universe's round. */
export const hoursPerLevel = (u: Universe): number =>
  u[roundSettings[1].key] as number;

/** Whether the universe speed divides the stay of an expedition, as it divides a flight. */
export const staysByUniverseSpeed = (u: Universe): boolean =>
  u[roundSettings[2].key] === 1;

/**
 * The real duration of a stay of `hours` hours in milliseconds: the hours as
 * they are, or divided by the universe speed like a flight when the round
 * says so (owner, 2026-11-19).
 */
export const stayDuration = (hours: number, u: Universe): number =>
  Math.round((hours * HOUR_MS) / (staysByUniverseSpeed(u) ? u.speed : 1));

// ----- the size of a find or an attack (owiki: normal 89 %, large 10 %, very large 1 %) -----

/** How big an event is: normal, large or very large (Q2). */
export type Size = 'normal' | 'large' | 'huge';

/** The chance of a large event; a very large one is 1 % (owiki „Expedition“). */
export const LARGE_FROM = 0.89;
export const HUGE_FROM = 0.99;

/** Draws the size: normal 89 %, large 10 %, very large 1 %. */
export function drawSize(rng: Rng): Size {
  const r = rng();
  if (r < LARGE_FROM) return 'normal';
  return r < HUGE_FROM ? 'large' : 'huge';
}

/** A whole number from `lo` to `hi`, both included. */
export const between = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

/** An even number from `lo` to `hi`, both included and even. */
export const evenBetween = (rng: Rng, lo: number, hi: number): number =>
  lo + 2 * Math.floor(rng() * ((hi - lo) / 2 + 1));

// ----- expedition points and the caps of the rank-1 player (owiki „Expedition“) -----

/** The most expedition points that count, by the points of rank 1 of the universe. */
export interface Caps {
  resources: number;
  ships: number;
}

/**
 * The caps by the points of rank 1 (owner, 2026-11-17: the owiki rule that
 * scales with them): below 100,000 points 2,400 for resources and 1,250
 * for ships, up to 1,000,000 6,000 and 3,000, up to 5,000,000 9,000 and
 * 4,500, above 12,000 and 6,000. [V] The edges belong to the lower tier
 * from 100,000 on (the article says „zwischen“ and „mehr als“).
 */
export function capsOf(rank1: number): Caps {
  if (rank1 < 100_000) return { resources: 2400, ships: 1250 };
  if (rank1 <= 1_000_000) return { resources: 6000, ships: 3000 };
  if (rank1 <= 5_000_000) return { resources: 9000, ships: 4500 };
  return { resources: 12000, ships: 6000 };
}

// ----- a find of resources -----

/** The lowest multiplier of expedition points for a find of resources. */
export const MIN_RESOURCE_POINTS = 200;

/** How the three resources divide the base number of a find: Adamant whole, Psikristall half, Promethium a third. */
export const DIVISOR: Readonly<Record<keyof Resources, number>> = {
  m: 1,
  c: 2,
  d: 3,
};

/** The resource of a find: Adamant : Psikristall : Promethium = 3 : 2 : 1 (owner, 2026-11-16, [V]). */
export function drawResource(rng: Rng): keyof Resources {
  const r = rng() * 6;
  if (r < 3) return 'm';
  return r < 5 ? 'c' : 'd';
}

/** A find of resources: which one, how big, how much. */
export interface ResourceFind {
  res: keyof Resources;
  amount: number;
}

/** The base number of a find of resources: an even number, 10 to 50, 50 to 100 or 100 to 200. */
export const resourceBase = (rng: Rng, size: Size): number => {
  if (size === 'normal') return evenBetween(rng, 10, 50);
  return size === 'large'
    ? evenBetween(rng, 50, 100)
    : evenBetween(rng, 100, 200);
};

/**
 * A find of resources of the drawn size (owiki „Rohstofffund“): the base
 * number, the resource; the base number halved for Psikristall and divided by three
 * for Promethium, times the expedition points of the fleet (at least 200, at
 * most the cap of the rank-1 player), and at most what the holds carry
 * (`room`: the cargo space minus half the fuel burnt).
 */
export function resourceFind(
  rng: Rng,
  size: Size,
  points: number,
  rank1: number,
  room: number,
): ResourceFind {
  const base = resourceBase(rng, size);
  const res = drawResource(rng);
  const factor = Math.min(
    capsOf(rank1).resources,
    Math.max(MIN_RESOURCE_POINTS, points),
  );
  const amount = Math.floor((base / DIVISOR[res]) * factor);
  return { res, amount: Math.max(0, Math.min(amount, Math.floor(room))) };
}

// ----- an attack of pirates or aliens (owiki „Kämpfe gegen andere Flotten“) -----

/** Who attacks: pirates, twice as often as aliens. */
export type Raider = 'pirates' | 'aliens';

/** How strong an attack is by its size: the share of every ship type of the fleet and the ships added. */
export interface RaidSpec {
  share: number;
  ship: string;
  extra: number;
}

export const RAIDS: Readonly<Record<Raider, Readonly<Record<Size, RaidSpec>>>> =
  {
    pirates: {
      normal: { share: 0.3, ship: 'lf', extra: 5 },
      large: { share: 0.5, ship: 'cr', extra: 3 },
      huge: { share: 0.8, ship: 'bs', extra: 2 },
    },
    aliens: {
      normal: { share: 0.4, ship: 'hf', extra: 5 },
      large: { share: 0.6, ship: 'bc', extra: 3 },
      huge: { share: 0.9, ship: 'dr', extra: 2 },
    },
  };

/** How far the share of a ship type may differ from the mean: a tenth of it, up or down. */
export const SPREAD = 0.1;

/**
 * The attackers: for every ship type of the fleet its share, drawn within a
 * tenth around the mean, rounded down for pirates and up for aliens, then
 * the extra ships of the size. The fleet itself is not changed.
 */
export function raidFleet(
  rng: Rng,
  raider: Raider,
  size: Size,
  fleet: Levels,
): Levels {
  const spec = RAIDS[raider][size];
  const round = raider === 'pirates' ? Math.floor : Math.ceil;
  const out: Levels = {};
  for (const [key, n] of Object.entries(fleet)) {
    if (n <= 0) continue;
    const share = spec.share * (1 - SPREAD + 2 * SPREAD * rng());
    const count = round(n * share);
    if (count > 0) out[key] = count;
  }
  out[spec.ship] = (out[spec.ship] ?? 0) + spec.extra;
  return out;
}

/** The levels of the attackers: pirates three below the player's, aliens three above (owiki). */
export const RAIDER_TECH_STEP = 3;

/** The weapons, shield and armour levels of the attackers from those of the fleet's owner. */
export function raiderTech(raider: Raider, own: Levels): Levels {
  const level = (key: string): number => {
    const mine = own[key] ?? 0;
    return raider === 'pirates'
      ? Math.max(0, mine - RAIDER_TECH_STEP)
      : mine + RAIDER_TECH_STEP;
  };
  return {
    weapons: level('weapons'),
    shield: level('shield'),
    armor: level('armor'),
  };
}

// ----- a change of the return time (Q2, owner, 2026-11-17: it really changes the return) -----

/** The factor of a change of the return time: normal 2, large 3, very large 5 times the stay (owiki). */
export const TIME_FACTOR: Readonly<Record<Size, number>> = {
  normal: 2,
  large: 3,
  huge: 5,
};

/** The shortest flight home after an early return, in milliseconds. */
export const MIN_FLIGHT_MS = 1000;

/** When a delayed fleet is back: the flight home takes the stay times the factor longer. */
export const lateReturn = (
  arr: number,
  flight: number,
  stay: number,
  size: Size,
): number => arr + flight + stay * TIME_FACTOR[size];

/**
 * When a fleet is back after an early return: the flight home is shorter by
 * a third of the stay times the factor, but takes at least a second.
 */
export const earlyReturn = (
  arr: number,
  flight: number,
  stay: number,
  size: Size,
): number =>
  arr +
  Math.max(MIN_FLIGHT_MS, Math.round(flight - (stay / 3) * TIME_FACTOR[size]));

// ----- the event of an expedition (Q2) -----

/** What can happen besides „nothing“: find, battle, loss or a change of the return time. */
export type EventKind =
  'resources' | 'ships' | 'pirates' | 'aliens' | 'lost' | 'early' | 'late';

/** The events in the order the shares are read. */
export const EVENT_KINDS: readonly EventKind[] = [
  'resources',
  'ships',
  'pirates',
  'aliens',
  'lost',
  'early',
  'late',
];

/** How likely each event is among the expeditions that bring one; any positive weights. */
export type EventShares = Readonly<Record<EventKind, number>>;

/** About 84 % of the expeditions bring an event (owner, 2026-11-16, Q2; owiki „Expedition“). */
export const EVENT_CHANCE = 0.84;

// The shares of the events among the expeditions that bring one (owner,
// 2026-11-19, issue #93, derived from owiki „Expedition“). Stated as shares
// of ALL expeditions, pirates and aliens are divided by the event chance:
//   pirates 6 % and aliens 2.7 % of all expeditions (the French statistic of
//     22,860 expeditions): 0.06 / 0.84 and 0.027 / 0.84 of the events;
//   total loss 0.33 % and a find of resources 37.5 % of the events;
//   [V] (main agent) the rest is shared half to the find of ships and half to
//     the change of the return time; three quarters of the changes are a
//     later return, a quarter an earlier one.
const PIRATES = 0.06 / EVENT_CHANCE;
const ALIENS = 0.027 / EVENT_CHANCE;
const LOST = 0.0033;
const RESOURCES = 0.375;
const REST = 1 - (PIRATES + ALIENS + LOST + RESOURCES);
const SHIPS = REST / 2;
const CHANGE = REST / 2;

/**
 * The share of each event among the 84 %, summing to 1 (the arithmetic in
 * okf/features/expeditions.md): resources 0.375, ships about 0.2591,
 * pirates about 0.0714, aliens about 0.0321, loss 0.0033, earlier return
 * about 0.0648, later return about 0.1943.
 */
export const EVENT_SHARES: EventShares = {
  resources: RESOURCES,
  ships: SHIPS,
  pirates: PIRATES,
  aliens: ALIENS,
  lost: LOST,
  early: CHANGE / 4,
  late: (CHANGE * 3) / 4,
};

/** An event of an expedition: nothing, the loss of the fleet, or a sized event. */
export type Event =
  | { kind: 'nothing' }
  | { kind: 'lost' }
  | { kind: Exclude<EventKind, 'lost'>; size: Size };

/**
 * Draws the event: first whether there is one (84 %), then which by the
 * shares, then its size; the loss of the fleet has no size (owiki). With
 * `null` shares nothing happens and nothing is drawn.
 */
export function drawEvent(
  rng: Rng,
  shares: EventShares | null = EVENT_SHARES,
): Event {
  if (!shares || rng() >= EVENT_CHANCE) return { kind: 'nothing' };
  const r = rng() * EVENT_KINDS.reduce((sum, k) => sum + shares[k], 0);
  // The running sum ends at the total, which `r` stays below.
  let upTo = 0;
  const kind = EVENT_KINDS.find((k) => {
    upTo += shares[k];
    return r < upTo;
  })!;
  return kind === 'lost' ? { kind } : { kind, size: drawSize(rng) };
}
