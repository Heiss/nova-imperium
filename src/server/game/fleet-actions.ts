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
} from '../../core/flight.ts';
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
import { isProtected, pointsMap } from './points.ts';

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
};

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
  targetOwner: string | null;
  cargo: Resources;
  pct: number;
}

function checkDestination(
  ctx: Ctx,
  u: User,
  p: Planet,
  rules: MissionRules,
  occupied: Planet | null,
  ships: Levels,
): void {
  const error = sendError(
    rules,
    { owner: u.id, from: p.id, ships },
    {
      planet: occupied,
      protects: (owner) => isProtected(u.id, owner, pointsMap(ctx)),
    },
  );
  if (error) fail(SEND_ERROR[error]);
}

function plan(ctx: Ctx, u: User, p: Planet, d: Data): Plan {
  const mission = String(d.mission) as Mission;
  const rules = missionRules(mission) ?? fail('Unbekannter Auftrag.');
  const ships = pickShips(p, d.ships);
  if (!countUnits(ships)) fail('Keine Schiffe ausgewählt.');
  if (ctx.fleets.count(u.id) >= fleetSlots(researchOf(ctx, u)))
    fail('Alle Flottenslots belegt.');
  const dest = target(ctx, d);
  const occupied = ctx.planets.get(placeId({ ...dest, kind: 'planet' }));
  checkDestination(ctx, u, p, rules, occupied, ships);
  return {
    mission,
    ships,
    dest,
    targetOwner: occupied?.owner ?? null,
    cargo: loadCargo(p, rules, d.cargo),
    pct: int(d.pct, 1, 10),
  };
}

export const send: Action = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const { mission, ships, dest, targetOwner, cargo, pct } = plan(ctx, u, p, d);
  const dist = distance(p, dest);
  const ms = flightMs(
    dist,
    fleetSpeed(ships, researchOf(ctx, u)),
    pct,
    universe(ctx),
  );
  const fuel = fuelFor(ships, dist, pct);
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
    to: placeId({ ...dest, kind: 'planet' }),
    toC: dest,
    mission,
    ships,
    cargo,
    dep: t,
    arr: t + ms,
    ret: t + 2 * ms,
    state: 'out',
    recalled: false,
    fuel,
  };
  ctx.fleets.save(fleet);
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

export const recall: Action = (ctx, u, d, event) => {
  const f = ctx.fleets.get(String(d.id));
  const t = ctx.now();
  if (!f || f.owner !== u.id || f.state !== 'out' || f.arr <= t)
    fail('Rückruf nicht mehr möglich.');
  const fleet = f!;
  fleet.state = 'back';
  fleet.ret = t + (t - fleet.dep);
  fleet.recalled = true;
  ctx.fleets.save(fleet);
  if (event)
    event.detail = { fleet: fleet.id, planet: fleet.from, due: fleet.ret };
  return 'Flotte zurückgerufen.';
};
