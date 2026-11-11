// Sending and recalling fleets.
import { MISSION, SHIPS } from '../../shared/catalog.ts';
import {
  capacity,
  countUnits,
  distance,
  fleetSlots,
  fleetSpeed,
  flightMs,
  fuelFor,
  pid,
} from '../../shared/flight.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Mission,
  Planet,
  Resources,
} from '../../shared/types.ts';
import type { AuditEntry } from '../audit.ts';
import type { User } from '../db/store.ts';
import { type Action, type Data, mine, researchOf } from './actions.ts';
import { type Ctx, coords, fail, int, universe } from './context.ts';
import { isProtected, pointsMap } from './points.ts';

const pickShips = (p: Planet, wanted: unknown): Levels => {
  const ships: Levels = {};
  for (const [k, n] of Object.entries((wanted as Levels | null) ?? {})) {
    if (!SHIPS[k]) continue;
    const m = Math.min(int(n, 0, 1e12), p.ships[k] ?? 0);
    if (m > 0) ships[k] = m;
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

function checkTarget(
  ctx: Ctx,
  u: User,
  p: Planet,
  to: Planet,
  mission: Mission,
): void {
  if (to.id === p.id) fail('Das ist dein eigener Planet.');
  if (mission === 'transport') return;
  if (to.owner === u.id) fail('Eigene Planeten kann man nicht angreifen.');
  if (isProtected(u.id, to.owner, pointsMap(ctx)))
    fail('Dieser Spieler steht unter Noobschutz.');
}

const loadCargo = (p: Planet, mission: Mission, raw: unknown): Resources => {
  if (mission === 'spy') return { m: 0, c: 0, d: 0 };
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
  mission: Mission,
  occupied: Planet | null,
  ships: Levels,
): void {
  if (mission === 'colonize') {
    if (occupied) fail('Diese Position ist bereits besetzt.');
    if (!ships.colony) fail('Du brauchst ein Kolonialschiff.');
  } else {
    checkTarget(
      ctx,
      u,
      p,
      occupied ?? fail('An dieser Position gibt es keinen Planeten.'),
      mission,
    );
  }
}

function plan(ctx: Ctx, u: User, p: Planet, d: Data): Plan {
  const mission = String(d.mission) as Mission;
  if (!Object.hasOwn(MISSION, mission)) fail('Unbekannter Auftrag.');
  const ships = pickShips(p, d.ships);
  if (!countUnits(ships)) fail('Keine Schiffe ausgewählt.');
  if (ctx.store.fleetCount(u.id) >= fleetSlots(researchOf(ctx, u)))
    fail('Alle Flottenslots belegt.');
  const dest = target(ctx, d);
  const occupied = ctx.store.planet(pid(dest));
  checkDestination(ctx, u, p, mission, occupied, ships);
  if (mission === 'spy' && Object.keys(ships).some((k) => k !== 'probe'))
    fail('Spionage nur mit Spionagesonden.');
  return {
    mission,
    ships,
    dest,
    targetOwner: occupied?.owner ?? null,
    cargo: loadCargo(p, mission, d.cargo),
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
    fail('Nicht genug Deuterium für Treibstoff und Ladung.');
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) - n;
  p.res.m -= cargo.m;
  p.res.c -= cargo.c;
  p.res.d -= cargo.d + fuel;
  ctx.store.savePlanet(p);
  const fleet: Fleet = {
    id: ctx.id(),
    owner: u.id,
    from: p.id,
    fromC: { g: p.g, s: p.s, p: p.p },
    to: pid(dest),
    toC: dest,
    mission,
    ships,
    cargo,
    dep: t,
    arr: t + ms,
    ret: t + 2 * ms,
    state: 'out',
    recalled: false,
  };
  ctx.store.saveFleet(fleet);
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
  const f = ctx.store.fleet(String(d.id));
  const t = ctx.now();
  if (!f || f.owner !== u.id || f.state !== 'out' || f.arr <= t)
    fail('Rückruf nicht mehr möglich.');
  const fleet = f!;
  fleet.state = 'back';
  fleet.ret = t + (t - fleet.dep);
  fleet.recalled = true;
  ctx.store.saveFleet(fleet);
  if (event)
    event.detail = { fleet: fleet.id, planet: fleet.from, due: fleet.ret };
  return 'Flotte zurückgerufen.';
};
