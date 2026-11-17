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
  type MissionRules,
  type SendError,
  missionRules,
  sendError,
} from '../../core/missions.ts';
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
import { type Ctx, coords, fail, int, universe } from './context.ts';
import { attackEvent } from './guild-events.ts';
import { holdersAt, isAllyOf } from './holding.ts';
import { isProtected, pointsMap } from './points.ts';
import { roundRules } from './round.ts';

const pickShips = (p: Planet, wanted: unknown): Levels => {
  const ships: Levels = {};
  for (const [k, n] of Object.entries((wanted as Levels | null) ?? {})) {
    if (!isShip(k)) continue;
    const m = Math.min(int(n, 0, 1e12), p.ships[k] ?? 0);
    if (m <= 0) continue;
    if (!canFly(k)) fail('Sonnenreliquiare können nicht fliegen.');
    ships[k] = m;
  }
  return ships;
};

/** Whether the player aims at the moon of the position (#53). */
const toMoon = (d: Data): boolean =>
  (d.to as { kind?: unknown } | null)?.kind === 'moon';

const target = (ctx: Ctx, d: Data): Coords => {
  const u = universe(ctx);
  const to = (d.to as Partial<Coords> | null) ?? {};
  return {
    g: int(to.g, 1, u.galaxies),
    s: int(to.s, 1, u.systems),
    p: int(to.p, 1, u.positions),
  };
};

/** The message of each code of `sendError`, in German like the interface. */
const SEND_ERROR: Readonly<Record<SendError, string>> = {
  occupied: 'Diese Position ist bereits besetzt.',
  noColonyShip: 'Du brauchst eine Kolonistenarche.',
  noPlanet: 'An dieser Position gibt es keinen Planeten.',
  samePlanet: 'Das ist dein eigener Planet.',
  notOwn: 'Verlegung nur zu einem eigenen Planeten.',
  ownTarget: 'Eigene Planeten kann man nicht angreifen.',
  protected: 'Dieser Spieler steht unter Noobschutz.',
  probesOnly: 'Auspex-Erkundung nur mit Spähschädeln.',
  noDebris: 'An dieser Position gibt es kein Trümmerfeld.',
  noRecycler: 'Du brauchst eine Bergungsbarke.',
  noMoon: 'An dieser Position gibt es keinen Mond.',
  moonTarget: 'Ein Mond kann nicht das Ziel dieses Auftrags sein.',
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
const sendMessage = (ctx: Ctx, error: SendError): string =>
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
}

function checkDestination(
  ctx: Ctx,
  u: User,
  p: Planet,
  rules: MissionRules,
  occupied: Planet | null,
  ships: Levels,
  at: { debris: boolean; moon: boolean },
): void {
  const error = sendError(
    rules,
    { owner: u.id, from: p.id, ships },
    {
      planet: occupied,
      debris: at.debris,
      moon: at.moon,
      protects: (owner) => isProtected(u.id, owner, pointsMap(ctx)),
      ally: (owner) => isAllyOf(ctx, u.id, owner),
      holding: () => (occupied ? holdersAt(ctx, occupied.id) : []),
    },
  );
  if (error) fail(sendMessage(ctx, error));
}

function plan(ctx: Ctx, u: User, p: Planet, d: Data): Plan {
  const mission = String(d.mission) as Mission;
  const rules = missionRules(mission) ?? fail('Unbekannter Auftrag.');
  const ships = pickShips(p, d.ships);
  if (!countUnits(ships)) fail('Keine Schiffe ausgewählt.');
  if (ctx.fleets.count(u.id) >= fleetSlots(researchOf(ctx, u)))
    fail('Alle Flottenslots belegt.');
  const dest = target(ctx, d);
  // The planet of the position, or its moon (#53).
  const moon = toMoon(d);
  const place = placeId({ ...dest, kind: moon ? 'moon' : 'planet' });
  const occupied = ctx.planets.get(place);
  // A Bergung flies to the Trümmerfeld, a place of its own (#45, #119).
  const field = placeId({ ...dest, kind: 'debris' });
  const toField = rules.target === 'debris';
  checkDestination(ctx, u, p, rules, occupied, ships, {
    debris: !!ctx.debris.get(field),
    moon,
  });
  return {
    mission,
    ships,
    dest,
    to: toField ? field : place,
    targetOwner: toField ? null : (occupied?.owner ?? null),
    cargo: loadCargo(p, rules, d.cargo),
    pct: int(d.pct, 1, 10),
    hours: holdHours(rules, d.hold),
  };
}

/** The holding time a Halten asks for, in hours (#55); none for the others. */
function holdHours(rules: MissionRules, raw: unknown): number {
  if (!rules.holds) return 0;
  return isHoldHours(raw) ? raw : fail('Bitte eine Haltezeit auswählen.');
}

/** The fuel of the launch: the flight, and the holding time of a Halten (#55, D2). */
const launchFuel = (x: Plan, holds: boolean, dist: number): number =>
  fuelFor(x.ships, dist, x.pct) + (holds ? holdFuel(x.ships, x.hours) : 0);

export const send: Action = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const x = plan(ctx, u, p, d);
  const { mission, ships, dest, to, targetOwner, cargo, pct } = x;
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
    id: ctx.id(),
    owner: u.id,
    from: p.id,
    fromC: { g: p.g, s: p.s, p: p.p },
    to,
    toC: dest,
    mission,
    ships,
    cargo,
    dep: t,
    arr: t + ms,
    ret: t + 2 * ms + hold,
    state: 'out',
    recalled: false,
    fuel,
    ...(holds && { hold }),
  };
  ctx.fleets.save(fleet);
  // The guild of the defender learns of an attack at its launch (#169 D3);
  // an attack flies to a foreign planet only, so it has an owner.
  if (missionRules(mission)!.alertsGuild) attackEvent(ctx, fleet, targetOwner!);
  if (event) logLaunch(event, fleet, targetOwner);
  return `Flotte unterwegs nach ${coords(fleet.toC)}.`;
};

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
 * fleet that holds as long as its flight to the target took (#55).
 */
const recalledAt = (f: Fleet, t: number): number =>
  t + (f.state === 'hold' ? f.arr - f.dep : t - f.dep);

export const recall: Action = (ctx, u, d, event) => {
  const f = ctx.fleets.get(String(d.id));
  const t = ctx.now();
  if (!f || f.owner !== u.id || !recallable(f, t))
    fail('Rückruf nicht mehr möglich.');
  // The gift of the „Endzeit“ has no origin to return to (#161).
  if (f!.gift)
    fail('Die Gabe des Gottkaisers kann nicht zurückgerufen werden.');
  const fleet = f!;
  fleet.ret = recalledAt(fleet, t);
  fleet.state = 'back';
  fleet.recalled = true;
  ctx.fleets.save(fleet);
  if (event)
    event.detail = { fleet: fleet.id, planet: fleet.from, due: fleet.ret };
  return 'Flotte zurückgerufen.';
};
