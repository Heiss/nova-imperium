// Planets and moons the seed parts place: the colony of `colony` and the moon
// of a planet.
import type { Planet, Seed } from './types.ts';

/** The slot of a colony the call gives no position for. */
const COLONY_SLOT = 15;

/** The id of the colony `colony` asks for. */
export const colonyId = ({ d, planet }: Seed): string =>
  `p${d.colony.g ?? planet.g}_${d.colony.s ?? planet.s}_${d.colony.p ?? COLONY_SLOT}`;

/** An own planet of the player on the slot `colony` names (slot 15 of the home system by default). */
export function addColony(s: Seed): void {
  const { store, d, planet: p } = s;
  const c = {
    g: d.colony.g ?? p.g,
    s: d.colony.s ?? p.s,
    p: d.colony.p ?? COLONY_SLOT,
  };
  store.savePlanet({
    ...p,
    ...c,
    id: `p${c.g}_${c.s}_${c.p}`,
    name: d.colony.name ?? 'Kolonie',
    res: d.colony.res ?? p.res,
    b: d.colony.b ?? {},
    ships: {},
    def: d.colony.def ?? {},
    bq: null,
    sq: [],
    sqT: null,
    pct: {},
    created: Date.now(),
  });
  // savePlanet keeps `created` on a conflict, and the oldest planet is the
  // home planet: a colony put on the slot of an older planet must not become it.
  store.db
    .prepare('UPDATE planets SET created = ? WHERE id = ?')
    .run(Date.now(), `p${c.g}_${c.s}_${c.p}`);
}

/**
 * The moon of a planet (#53): made when it is not there yet, then changed.
 * A moon of another owner on the slot is made anew for the owner of the
 * planet, without the cooldown of its Warp-Tor (#230).
 */
export function moonOf(s: Seed, p: Planet, over: Partial<Planet>): void {
  const { store } = s;
  const id = `m${p.g}_${p.s}_${p.p}`;
  const found = store.planet(id);
  const old = found?.owner === p.owner ? found : null;
  if (found && !old)
    store.db.prepare('DELETE FROM jump_gates WHERE moon_id = ?').run(id);
  const t = Date.now();
  store.savePlanet({
    ...(old ?? {
      ...p,
      id,
      kind: 'moon',
      name: 'Mond',
      diameter: 5000,
      unlimited: false,
      res: { m: 0, c: 0, d: 0 },
      b: {},
      ships: {},
      def: {},
      bq: null,
      sq: [],
      sqT: null,
      pct: {},
      t,
      created: t,
    }),
    ...over,
  });
}
