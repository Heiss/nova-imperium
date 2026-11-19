// Sending and recalling fleets. The checks of the target and of a mission
// are the pure `sendError` of src/core/missions.ts (#116); the server
// determines the noob protection, turns the codes into the messages, and
// checks the slots, the cargo and the fuel for every mission alike.
import { canFly, isShip } from '../../core/catalog.ts';
import {
  capacity,
  countUnits,
  distance,
  fleetSlots,
  fleetSpeed,
  flightMs,
  fuelFor,
  holdFuel,
} from '../../core/flight.ts';
import {
  ALLIES,
  HOLD_LIMITS,
  HOUR_MS,
  dueAt,
  isHoldHours,
} from '../../core/holding.ts';
import {
  isFleet,
  launchOf,
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
import { type Action, type Data, mine, researchOf } from './actions.ts';
import { lockedUntil, positionLockedText } from './position-lock.ts';
import { type Ctx, coords, fail, int, universe } from './context.ts';
import { attackEvent } from './guild-events.ts';
import { holdersAt, isAllyOf } from './holding.ts';
import { joinPlan, joinUnion, recalledWith } from './union.ts';
import { isProtected, pointsMap } from './points.ts';
import { roundRules } from './round.ts';
import { inVacation } from './vacation.ts';
import type { ServerFeature } from './feature.ts';

/**
 * The picked ships, each at most as many as stand on the place; what is no
 * ship or not there is left out. The jump of the Warp-Tor picks so too (#230).
 */
export const pickedShips = (p: Planet, wanted: unknown): Levels => {
  const ships: Levels = {};
  for (const [k, n] of Object.entries((wanted as Levels | null) ?? {})) {
    if (!isShip(k)) continue;
    const m = Math.min(int(n, 0, 1e12), p.ships[k] ?? 0);
    if (m > 0) ships[k] = m;
  }
  return ships;
};

const pickShips = (p: Planet, wanted: unknown): Levels => {
  const ships = pickedShips(p, wanted);
  if (!Object.keys(ships).every(canFly))
    fail('Sonnenreliquiare können nicht fliegen.');
  return ships;
};

/** Whether the player aims at the moon of the position (#53). */
const toMoon = (d: Data): boolean =>
  (d.to as { kind?: unknown } | null)?.kind === 'moon';

/** The coordinates `d.to` asks for, inside the universe; also of missiles (#54). */
export const target = (ctx: Ctx, d: Data): Coords => {
  const u = universe(ctx);
  const to = (d.to as Partial<Coords> | null) ?? {};
  return {
    g: int(to.g, 1, u.galaxies),
    s: int(to.s, 1, u.systems),
    // The expedition position after the last planet position (#93, Q4).
    p: int(to.p, 1, expeditionPosition(u)),
  };
};

/** A code with a fixed message; a locked position names the end of its lock. */
type WordedError = Exclude<SendError, 'locked'>;

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
  holdFleets: `An diesem Planeten halten bereits ${HOLD_LIMITS.fleets} Flotten.`,
  holdPlayers: `An diesem Planeten halten bereits Flotten von ${HOLD_LIMITS.players} Spielern.`,
};

/** Who may hold, as the refusal of a Halten names them (#55, Q2) [V]. */
const NOT_ALLY: Readonly<Record<number, string>> = {
  [ALLIES.guild]: 'Wache stellen nur bei Gildenmitgliedern.',
  [ALLIES.friends]: 'Wache stellen nur bei Freunden.',
};

/** The message of a code; a Halten names who may hold in this round. */
const sendMessage = (ctx: Ctx, error: WordedError): string =>
  (error === 'notAlly' && NOT_ALLY[roundRules(ctx).allies]) ||
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

/** The fleet slots a player uses: no gift (#161) and no missiles (#54). */
const usedSlots = (ctx: Ctx, owner: string): number =>
  ctx.fleets.count(owner, SILO_MISSIONS);

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

function checkDestination(
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
  const error = sendError(
    rules,
    {
      owner: u.id,
      from: p.id,
      ships,
      research: researchOf(ctx, u).research,
      running: ctx.fleets.countMission(u.id, mission),
      extraSlots: extraSlots(universe(ctx)),
    },
    {
      planet: occupied,
      debris: at.debris,
      moon: at.moon,
      locked: at.lockEnd !== null,
      expedition: at.expedition,
      protects: (owner) => isProtected(u.id, owner, pointsMap(ctx)),
      vacation: inVacation(ctx),
      ally: (owner) => isAllyOf(ctx, u.id, owner),
      // Asked only for a Halten, whose target kind has a planet (#55).
      holding: () => holdersAt(ctx, occupied!.id),
    },
  );
  // A given-up position names the end of its lock (#224, D2).
  if (error === 'locked') return fail(positionLockedText(at.lockEnd!));
  if (error) fail(sendMessage(ctx, error));
}

function plan(ctx: Ctx, u: User, p: Planet, d: Data): Plan {
  const mission = String(d.mission) as Mission;
  const known = missionRules(mission);
  // Missiles start from the silo in the Sternenkarte, never as a fleet (#54).
  const rules =
    known && launchOf(known) === 'fleet' ? known : fail('Unbekannter Auftrag.');
  const ships = pickShips(p, d.ships);
  if (!countUnits(ships)) fail('Keine Schiffe ausgewählt.');
  if (usedSlots(ctx, u.id) >= fleetSlots(researchOf(ctx, u)))
    fail('Alle Flottenslots belegt.');
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
  if (!rules.holds) return 0;
  return isHoldHours(raw) ? raw : fail('Bitte eine Haltezeit auswählen.');
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
  if (chosen > most)
    fail(
      `Die Haltezeit beträgt höchstens ${most} ${most === 1 ? 'Stunde' : 'Stunden'}.`,
    );
  return stayDuration(chosen, world);
}

/** The fuel of the launch: the flight, and the holding time of a Halten (#55, D2). */
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

export const send: Action = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const x = plan(ctx, u, p, d);
  const { mission, ships, dest, to, targetOwner, cargo, pct, stay } = x;
  const holds = missionRules(mission)!.holds;
  const dist = distance(p, dest);
  const ms = flightMs(
    dist,
    fleetSpeed(ships, researchOf(ctx, u)),
    pct,
    universe(ctx),
  );
  const fuel = launchFuel(x, holds, dist);
  const hold = x.hours * HOUR_MS;
  // A fleet that joins an attack union arrives with it (#225).
  const joining = joinPlan(ctx, u.id, d.union, {
    mission,
    to,
    toC: dest,
    flight: ms,
  });
  if (cargo.m + cargo.c + cargo.d > capacity(ships))
    fail('Nicht genug Laderaum.');
  if (p.res.d < fuel + cargo.d)
    fail('Nicht genug Promethium für Treibstoff und Ladung.');
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) - n;
  p.res.m -= cargo.m;
  p.res.c -= cargo.c;
  p.res.d -= cargo.d + fuel;
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
  joinUnion(ctx, joining, fleet);
  ctx.fleets.save(fleet);
  // The guild of the defender learns of an attack or a Mondbruch at its
  // launch (#169 D3, #95); both fly to a foreign place only, so it has an
  // owner.
  if (missionRules(mission)!.alertsGuild) attackEvent(ctx, fleet, targetOwner!);
  if (event) logLaunch(event, fleet, targetOwner);
  return `Flotte unterwegs nach ${coords(fleet.toC)}.`;
};

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
 * Whether a fleet can still be called back at `t`: on its way out before its
 * arrival, or while it holds before the end of its holding time (#55).
 */
const recallable = (f: Fleet, t: number): boolean =>
  (f.state === 'out' || f.state === 'hold') && dueAt(f) > t;

/**
 * When a recalled fleet is home: it flies back as long as it flew out, and a
 * fleet that holds as long as its flight to the target took (#55). An
 * expedition that already stays at its position (#93) is there, so it flies
 * back as long as its flight out, not as long as its flight and stay so far:
 * `ret - arr` is that flight (for every other mission it is at least the
 * time flown so far, so the old rule stays).
 */
const recalledAt = (f: Fleet, t: number): number =>
  t + (f.state === 'hold' ? f.arr - f.dep : Math.min(t - f.dep, f.ret - f.arr));

export const recall: Action = (ctx, u, d, event) => {
  const f = ctx.fleets.get(String(d.id));
  const t = ctx.now();
  if (!f || f.owner !== u.id || !recallable(f, t))
    fail('Rückruf nicht mehr möglich.');
  // The gift of the „Endzeit“ has no origin to return to (#161).
  if (f!.gift)
    fail('Die Gabe des Gottkaisers kann nicht zurückgerufen werden.');
  // Missiles do not come back (#54).
  if (!isFleet(f!)) fail('Rückruf nicht mehr möglich.');
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
