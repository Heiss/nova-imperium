// Sending and recalling fleets. The checks of the target and of a mission
// are the pure `sendError` of src/core/missions.ts (#116); the server
// determines the noob protection and turns the codes into the messages. The
// mission, the ships, the slots, the holding time, the stay, the cargo, the
// fuel and the recall are the pure checks of src/core/fleet-checks.ts (#214).
import { HOLDS_REFUSED_REFUSAL } from '../../core/hold-texts.ts';
import type { Wire } from '../../core/actions.ts';
import { isShip } from '../../core/catalog.ts';
import {
  distance,
  fleetSlots,
  capacity,
  fleetSpeed,
  flightMs,
  fuelFor,
  holdFuel,
} from '../../core/flight.ts';
import {
  ALLIES,
  HOLD_LIMITS,
  HOUR_MS,
  LAPSES_AT_HOLD,
} from '../../core/holding.ts';
import {
  cargoError,
  type CargoError,
  holdTimeError,
  recallError,
  type RecallError,
  startError,
  type StartError,
  stayError,
} from '../../core/fleet-checks.ts';
import {
  type MissionRules,
  type SendError,
  missionRules,
  SILO_MISSIONS,
  sendError,
} from '../../core/missions.ts';
import {
  expeditionPosition,
  extraSlots,
  hoursPerLevel,
  isExpeditionPlace,
  stayDuration,
} from '../../core/expedition.ts';
import { placeId } from '../../core/place.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Mission,
  Planet,
  Resources,
} from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import type { User } from '../db/repos/players.ts';
import { type Handler, mine, researchOf } from './actions.ts';
import { lockedUntil, positionLockedText } from './position-lock.ts';
import { type Ctx, coords, fail, int, universe } from './context.ts';
import { colonyRoom, limitRefusal } from './colony-limit.ts';
import { attackEvent } from './guild-events.ts';
import { heldByOthers, holdersAt, holdLaunched, isAllyOf } from './holding.ts';
import {
  foundUnion,
  type JoinPlan,
  joinPlan,
  joinUnion,
  planLater,
  plannedBy,
  planOf,
  recalledWith,
  reservedAt,
  startText,
  type UnionPlan,
} from './union.ts';
import { isProtected } from './points.ts';
import { exactPoints } from './scores.ts';
import { roundRules } from './round.ts';
import { inVacation } from './vacation.ts';
import type { ServerFeature } from './feature.ts';
import {
  cargoIntentOf,
  loadableStock,
  resolveCargo,
} from '../../core/cargo-fill.ts';

/**
 * The picked ships, each at most as many as stand on the place; what is no
 * ship or not there is left out. The jump of the Warp-Tor picks so too (#230).
 */
export const pickedShips = (
  p: Planet,
  wanted: unknown,
  reserved: Levels = {},
): Levels => {
  const ships: Levels = {};
  for (const [k, n] of Object.entries((wanted as Levels | null) ?? {})) {
    if (!isShip(k)) continue;
    // The ships a planned start holds back are no longer free (#478).
    const free = Math.max(0, (p.ships[k] ?? 0) - (reserved[k] ?? 0));
    const m = Math.min(int(n, 0, 1e12), free);
    if (m > 0) ships[k] = m;
  }
  return ships;
};

/** What an action that aims at a position reads: `to`, unchecked. */
export interface Aimed {
  readonly to?: unknown;
}

/** Whether the player aims at the moon of the position (#53). */
const toMoon = (d: Aimed): boolean =>
  (d.to as { kind?: unknown } | null)?.kind === 'moon';

/** The coordinates `d.to` asks for, inside the universe; also of missiles (#54). */
export const target = (ctx: Ctx, d: Aimed): Coords => {
  const u = universe(ctx);
  const to = (d.to as Partial<Coords> | null) ?? {};
  return {
    g: int(to.g, 1, u.galaxies),
    s: int(to.s, 1, u.systems),
    // The expedition position after the last planet position (#93, Q4).
    p: int(to.p, 1, expeditionPosition(u)),
  };
};

/**
 * A code with a fixed message; a locked position names the end of its lock,
 * and the limit of planets names the count (#237).
 */
type WordedError = Exclude<SendError, 'locked' | 'colonyLimit' | 'notOffered'>;

/** The message of each code of `sendError`, in German like the interface. */
const SEND_ERROR: Readonly<Record<WordedError, string>> = {
  occupied: 'Diese Position ist bereits besetzt.',
  noColonyShip: 'Du brauchst eine Kolonistenarche.',
  noPlanet: 'An dieser Position gibt es keinen Planeten.',
  samePlanet: 'Das ist dein eigener Planet.',
  notOwn: 'Verlegung nur zu einem eigenen Planeten.',
  ownTarget: 'Eigene Planeten kann man nicht angreifen.',
  protected: 'Dieser Spieler steht unter Noobschutz.',
  vacation: 'Dieser Spieler ist im Urlaubsmodus.',
  probesOnly: 'Auspex-Erkundung nur mit Spähschädeln.',
  noSpyTech: 'Auspex-Erkundung erst ab Auspex-Lehre 1.',
  noDebris: 'An dieser Position gibt es kein Trümmerfeld.',
  noRecycler: 'Du brauchst eine Bergungsbarke.',
  noMoon: 'An dieser Position gibt es keinen Mond.',
  moonTarget: 'Ein Mond kann nicht das Ziel dieses Auftrags sein.',
  notMoon: 'Mondbruch nur gegen einen Mond.',
  noWorldbreaker: 'Du brauchst einen Weltenbrecher.',
  surveyLocked: 'Vermessung erst mit Auspex-Kartographie.',
  surveyProbesOnly: 'Vermessung nur mit Spähschädeln.',
  // [V], okf/features/expeditions.md.
  expeditionLocked: 'Expeditionen erst mit Kreuzzugs-Kartografie.',
  expeditionSlots: 'Alle Expeditionsplätze belegt.',
  notExpedition: 'Expeditionen fliegen nur zur Expeditionsposition.',
  expeditionSpace: 'Die Expeditionsposition kann nicht besiedelt werden.',
  // #55 [V]: worded like the other missions, by the setting of the round.
  notAlly: 'Wache stellen nur bei Gildenmitgliedern und Freunden.',
  // #440: the texts the owner has not decided yet are marked placeholders.
  holdsRefused: HOLDS_REFUSED_REFUSAL,
  holdFleets: `An diesem Planeten halten bereits ${HOLD_LIMITS.fleets} Flotten.`,
  holdPlayers: `An diesem Planeten halten bereits Flotten von ${HOLD_LIMITS.players} Spielern.`,
};

/** Who may hold, as the refusal of a Halten names them (#55, Q2) [V]. */
const NOT_ALLY: Readonly<Record<number, string>> = {
  [ALLIES.guild]: 'Wache stellen nur bei Gildenmitgliedern.',
  [ALLIES.friends]: 'Wache stellen nur bei Freunden.',
};

/** The messages of the codes of src/core/fleet-checks.ts (#214); a stay names its hours. */
const FLEET_ERROR: Readonly<
  Record<StartError | CargoError | RecallError | 'holdTime', string>
> = {
  mission: 'Unbekannter Auftrag.',
  stationary: 'Sonnenreliquiare können nicht fliegen.',
  noShips: 'Keine Schiffe ausgewählt.',
  // The text of the Sternenkarte (F12, owner 2026-11-21).
  noProbes: 'Keine Spähschädel auf dem Planeten.',
  slots: 'Alle Flottenslots belegt.',
  holdTime: 'Bitte eine Haltezeit auswählen.',
  hold: 'Nicht genug Laderaum.',
  fuel: 'Nicht genug Promethium für Treibstoff und Ladung.',
  gone: 'Rückruf nicht mehr möglich.',
  gift: 'Die Gabe des Gottkaisers kann nicht zurückgerufen werden.',
};

/** Refuses with the message of a code of src/core/fleet-checks.ts, if any. */
const refuse = (error: keyof typeof FLEET_ERROR | null): void => {
  if (error) fail(FLEET_ERROR[error]);
};

/** The message of a code; a Halten names who may hold in this round. */
const sendMessage = (
  ctx: Ctx,
  error: WordedError | 'notOffered',
  rules: MissionRules,
): string =>
  error === 'notOffered'
    ? // A mission the round switched off has its own words (#440).
      rules.offered!.refusal
    : (error === 'notAlly' && NOT_ALLY[roundRules(ctx).allies]) ||
      SEND_ERROR[error];

const loadCargo = (p: Planet, rules: MissionRules, raw: unknown): Resources => {
  if (!rules.cargo) return { m: 0, c: 0, d: 0 };
  const c = (raw as Partial<Resources> | null) ?? {};
  return {
    m: Math.min(int(c.m, 0, 1e15), Math.floor(p.res.m)),
    c: Math.min(int(c.c, 0, 1e15), Math.floor(p.res.c)),
    d: int(c.d, 0, 1e15),
  };
};

/**
 * The fleet slots a player uses: no gift (#161) and no missiles (#54); a
 * planned start takes its slot from the planning (#478).
 */
const usedSlots = (ctx: Ctx, owner: string): number =>
  ctx.fleets.count(owner, SILO_MISSIONS) + plannedBy(ctx, owner);

interface Plan {
  mission: Mission;
  ships: Levels;
  dest: Coords;
  /** The id of the place the fleet flies to: a planet or a Trümmerfeld. */
  to: string;
  targetOwner: string | null;
  cargo: Resources;
  pct: number;
  /** The holding time of a Halten in hours (#55); 0 for every other mission. */
  hours: number;
  /** How long an expedition stays at the target in milliseconds (#93); 0 for a mission that does not stay. */
  stay: number;
}

export function checkDestination(
  ctx: Ctx,
  u: User,
  p: Planet,
  rules: MissionRules,
  occupied: Planet | null,
  ships: Levels,
  at: {
    debris: boolean;
    moon: boolean;
    lockEnd: number | null;
    expedition: boolean;
  },
  mission: Mission,
): void {
  const research = researchOf(ctx, u).research;
  const error = sendError(
    rules,
    {
      owner: u.id,
      from: p.id,
      ships,
      research,
      running: ctx.fleets.countMission(u.id, mission),
      extraSlots: extraSlots(universe(ctx)),
      // Asked only by a Landnahme (#237).
      colonies: () => colonyRoom(ctx, u.id, research),
    },
    {
      planet: occupied,
      debris: at.debris,
      moon: at.moon,
      locked: at.lockEnd !== null,
      expedition: at.expedition,
      // The exact points of the two players, never the stored pass (#405).
      // The protection lapses at a place where a fleet of a third player
      // holds (#440, 238c, 296a), for a Sturmangriff and an
      // Auspex-Erkundung only (281b): the Mondbruch keeps it. The host can
      // send the fleet away to get it back; the sender's own hold there
      // lifts nothing.
      protects: (owner) =>
        !(
          LAPSES_AT_HOLD.includes(mission) &&
          heldByOthers(ctx, occupied!.id, owner, u.id)
        ) && isProtected(u.id, owner, exactPoints(ctx, [u.id, owner])),
      vacation: inVacation(ctx),
      ally: (owner) => isAllyOf(ctx, u.id, owner),
      // „Wache stellen“ is a switch of the round (#440).
      round: roundRules(ctx),
      refusesHolds: (owner) => ctx.holdRefusals.refuses(owner),
      // Asked only for a Halten, whose target kind has a planet (#55).
      holding: () => holdersAt(ctx, occupied!.id),
    },
  );
  // A given-up position names the end of its lock (#224, D2).
  if (error === 'locked') return fail(positionLockedText(at.lockEnd!));
  // The planets against the limit, as the player sees them (#237).
  if (error === 'colonyLimit') return fail(limitRefusal(ctx, u.id, research));
  if (error) fail(sendMessage(ctx, error, rules));
}

function plan(ctx: Ctx, u: User, p: Planet, d: Wire<'send'>): Plan {
  const mission = String(d.mission) as Mission;
  const ships = pickedShips(p, d.ships, reservedAt(ctx, p.id));
  // Missiles start from the silo in the Sternenkarte, never as a fleet (#54).
  refuse(
    startError(
      mission,
      ships,
      usedSlots(ctx, u.id),
      fleetSlots(researchOf(ctx, u)),
    ),
  );
  const rules = missionRules(mission)!;
  const dest = target(ctx, d);
  // The planet of the position, or its moon (#53).
  const moon = toMoon(d);
  const place = placeId({ ...dest, kind: moon ? 'moon' : 'planet' });
  const occupied = ctx.planets.get(place);
  // A Bergung flies to the Trümmerfeld, a place of its own (#45, #119).
  const field = placeId({ ...dest, kind: 'debris' });
  const toField = rules.target === 'debris';
  checkDestination(
    ctx,
    u,
    p,
    rules,
    occupied,
    ships,
    {
      debris: !!ctx.debris.get(field),
      moon,
      lockEnd: lockedUntil(ctx, dest, ctx.now()),
      expedition: isExpeditionPlace(dest, universe(ctx)),
    },
    mission,
  );
  return {
    mission,
    ships,
    dest,
    to: toField ? field : place,
    targetOwner: toField ? null : (occupied?.owner ?? null),
    cargo: loadCargo(p, rules, d.cargo),
    pct: int(d.pct, 1, 10),
    hours: holdHours(rules, d.hold),
    stay: chosenStay(ctx, u, rules, d.stay),
  };
}

/** The holding time a Halten asks for, in hours (#55); none for the others. */
function holdHours(rules: MissionRules, raw: unknown): number {
  refuse(holdTimeError(rules, raw));
  return rules.holds ? (raw as number) : 0;
}

/**
 * How long an expedition stays at the target, from the hours the player
 * chose (at least 1) up to what the research and the hours per level of the
 * round allow (#93, Q3), divided by the universe speed when the round says
 * so; 0 for a mission that does not stay. The message names the hours the
 * player enters, whatever the speed does to them.
 */
function chosenStay(
  ctx: Ctx,
  u: User,
  rules: MissionRules,
  hours: unknown,
): number {
  if (!rules.maxStay) return 0;
  const world = universe(ctx);
  const most = rules.maxStay(researchOf(ctx, u).research, hoursPerLevel(world));
  const chosen = int(hours, 1, Number.MAX_SAFE_INTEGER);
  if (stayError(chosen, most))
    fail(
      `Die Haltezeit beträgt höchstens ${most} ${most === 1 ? 'Stunde' : 'Stunden'}.`,
    );
  return stayDuration(chosen, world);
}

/** The fuel of the launch: the flight, and the holding time of a Halten (#55, D2). */
/**
 * The cargo of the launch with the intent of the „alles“ buttons (#407): the
 * rule of the browser (core/cargo-fill.ts) on what the planet can load now,
 * whole units and Promethium after the fuel; without a cargo of the mission
 * nothing.
 */
function withIntent(p: Planet, x: Plan, fuel: number, raw: unknown): Resources {
  const intent = cargoIntentOf(raw);
  if (!intent || !missionRules(x.mission)!.cargo) return x.cargo;
  const stock = loadableStock(p.res, fuel);
  return resolveCargo(stock, capacity(x.ships), x.cargo, intent);
}

const launchFuel = (x: Plan, holds: boolean, dist: number): number =>
  fuelFor(x.ships, dist, x.pct) + (holds ? holdFuel(x.ships, x.hours) : 0);

/**
 * When a fleet arrives and when it is home: with the attack union it joins
 * (#225) it arrives with it and flies home from there; else it arrives after
 * its flight and its stay, and comes home after the way back and its holding
 * time.
 */
const timesOf = (
  joining: { arr: number } | null,
  t: number,
  ms: number,
  hold: number,
  stay: number,
): Pick<Fleet, 'arr' | 'ret'> =>
  joining
    ? { arr: joining.arr, ret: joining.arr + ms }
    : { arr: t + ms + stay, ret: t + 2 * ms + hold + stay };

/** The ships, the cargo and the fuel leave the planet with the fleet. */
export function takeOff(
  p: Planet,
  ships: Levels,
  cargo: Resources,
  fuel: number,
): void {
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) - n;
  p.res.m -= cargo.m;
  p.res.c -= cargo.c;
  p.res.d -= cargo.d + fuel;
}

/**
 * The union the leader plans with this Sturmangriff (#466, A1a): it arrives
 * at the X he chose, at the speed that brings it there, or starts later by
 * itself (#478). A fleet that joins an attack union starts now and arrives at
 * its fixed arrival X, at the speed that brings it there (#466, 7b): its
 * flight is the time left, its fuel that of the speed.
 */
const unionPlanOf = (
  ctx: Ctx,
  d: Wire<'send'>,
  x: Plan,
  dist: number,
  speed: number,
): UnionPlan | null =>
  planOf(ctx, d.plan, {
    mission: x.mission,
    union: d.union,
    dist,
    speed,
    pct: x.pct,
  });

/** Whether the plan starts the fleet later by itself (#478). */
const startsLater = (
  planned: UnionPlan | null,
): planned is Required<UnionPlan> => planned?.start !== undefined;

/**
 * The union the fleet plans or joins, its speed and its flight: to X for a
 * fleet of a union (#466), else at the speed of the form.
 */
function flightAt(
  ctx: Ctx,
  u: User,
  d: Wire<'send'>,
  x: Plan,
  planned: UnionPlan | null,
  at: { dist: number; speed: number; t: number },
): { joining: UnionPlan | JoinPlan | null; pct: number; ms: number } {
  const { dist, speed, t } = at;
  const joining =
    planned ??
    joinPlan(ctx, u.id, d.union, { mission: x.mission, to: x.to, dist, speed });
  const pct = joining ? joining.pct : x.pct;
  const ms = joining
    ? joining.arr - t
    : flightMs(dist, speed, pct, universe(ctx));
  return { joining, pct, ms };
}

export const send: Handler<'send'> = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const x = plan(ctx, u, p, d);
  const { mission, ships, dest, to, targetOwner, stay } = x;
  const holds = missionRules(mission)!.holds;
  const dist = distance(p, dest);
  const speed = fleetSpeed(ships, researchOf(ctx, u));
  const planned = unionPlanOf(ctx, d, x, dist, speed);
  if (startsLater(planned)) return sendLater(ctx, u, p, x, planned, d, event);
  const { joining, pct, ms } = flightAt(ctx, u, d, x, planned, {
    dist,
    speed,
    t,
  });
  const fuel = launchFuel({ ...x, pct }, holds, dist);
  const hold = x.hours * HOUR_MS;
  // The „alles“ buttons ask for amounts the server computes on its stock of
  // now, after the fuel (#407); a field typed by hand stays its number.
  const cargo = withIntent(p, x, fuel, d.cargoAll);
  refuse(cargoError(ships, cargo, p.res.d, fuel));
  takeOff(p, ships, cargo, fuel);
  ctx.planets.save(p);
  const fleet: Fleet = {
    ...route(ctx, u, p, to, dest),
    mission,
    ships,
    cargo,
    dep: t,
    ...timesOf(joining, t, ms, hold, stay),
    state: 'out',
    recalled: false,
    fuel,
    ...(holds && { hold }),
  };
  if (planned) foundUnion(ctx, planned, fleet);
  else joinUnion(joining as JoinPlan | null, fleet);
  ctx.fleets.save(fleet);
  // A hostile launch is one of the last targets for the Schnellwahl (#292).
  // Only a launch at a planet is remembered: the missions that are, need its owner.
  if (missionRules(mission)!.remembered)
    ctx.targets.record(u.id, { place: to, owner: targetOwner!, at: t });
  // The guild of the defender learns of an attack or a Mondbruch at its
  // launch (#169 D3, #95); both fly to a foreign place only, so it has an
  // owner.
  if (missionRules(mission)!.alertsGuild) attackEvent(ctx, fleet, targetOwner!);
  // The host learns of a hold at its launch (#440, 242c).
  if (holds) holdLaunched(ctx, fleet, targetOwner!);
  if (event) logLaunch(event, fleet, targetOwner);
  return `Flotte unterwegs nach ${coords(fleet.toC)}.`;
};

/**
 * The leader plans a union whose arrival his fleet cannot reach at once
 * even at 10 % (owner, 2026-11-28, #478): the fleet starts by itself at the
 * start of the plan; until then its ships stay on the planet and defend it,
 * and nothing is paid. It takes no cargo [V].
 */
function sendLater(
  ctx: Ctx,
  u: User,
  p: Planet,
  x: Plan,
  planned: Required<UnionPlan>,
  d: Wire<'send'>,
  event: AuditEntry | undefined,
): string {
  if (x.cargo.m + x.cargo.c + x.cargo.d > 0 || cargoIntentOf(d.cargoAll))
    fail(LATER_NO_CARGO);
  const fleet = { ...route(ctx, u, p, x.to, x.dest), ships: x.ships };
  planLater(ctx, planned, fleet);
  ctx.targets.record(u.id, {
    place: x.to,
    owner: x.targetOwner!,
    at: ctx.now(),
  });
  if (event) {
    event.target = x.targetOwner!;
    event.detail = {
      union: fleet.id,
      planet: fleet.to,
      origin: fleet.from,
      mission: x.mission,
      start: planned.start,
      due: planned.arr,
    };
  }
  return `Sturmangriff geplant: Start am ${startText(planned.start)}, Ankunft am ${startText(planned.arr)}.`;
}

/** The refusal of cargo for a fleet that starts later (#478) [V]. */
const LATER_NO_CARGO =
  'Eine Flotte, die später startet, nimmt keine Ladung mit.';

/** A new flight of `u` from `p` to the place `to` at `toC`: id, owner, origin and target. */
export const route = (
  ctx: Ctx,
  u: User,
  p: Planet,
  to: string,
  toC: Coords,
): Pick<Fleet, 'id' | 'owner' | 'from' | 'fromC' | 'to' | 'toC'> => ({
  id: ctx.id(),
  owner: u.id,
  from: p.id,
  fromC: { g: p.g, s: p.s, p: p.p },
  to,
  toC,
});

function logLaunch(
  event: AuditEntry,
  fleet: Fleet,
  target: string | null,
): void {
  if (target !== null) event.target = target;
  event.detail = {
    fleet: fleet.id,
    planet: fleet.to,
    origin: fleet.from,
    mission: fleet.mission,
    due: fleet.arr,
  };
}

/**
 * When a recalled fleet is home: it flies back as long as it flew out, and a
 * fleet that holds as long as its flight to the target took (#55). An
 * expedition that already stays at its position (#93) is there, so it flies
 * back as long as its flight out, not as long as its flight and stay so far:
 * `ret - arr` is that flight (for every other mission it is at least the
 * time flown so far, so the old rule stays).
 */
export const recalledAt = (f: Fleet, t: number): number =>
  t + (f.state === 'hold' ? f.arr - f.dep : Math.min(t - f.dep, f.ret - f.arr));

export const recall: Handler<'recall'> = (ctx, u, d, event) => {
  const f = ctx.fleets.get(String(d.id));
  const t = ctx.now();
  // The gift of the „Endzeit“ has no origin to return to (#161); missiles
  // do not come back (#54).
  refuse(recallError(f, u.id, t));
  const fleet = f!;
  const due = recalledAt(fleet, t);
  // The leader's recall of the fleet that opened an attack union turns back
  // every fleet of it; a participant's recall only his own (#225).
  for (const m of recalledWith(ctx, fleet)) {
    m.ret = recalledAt(m, t);
    m.state = 'back';
    m.recalled = true;
    ctx.fleets.save(m);
  }
  if (event) event.detail = { fleet: fleet.id, planet: fleet.from, due };
  return 'Flotte zurückgerufen.';
};

export const serverFeature = {
  actions: { send, recall },
} satisfies ServerFeature;
