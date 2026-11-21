// `moveHome` ({ g, s, p }): the home planet of a player who has only it moves
// to that position, so every test has its players in its own area (#302,
// `register` of e2e/helpers.ts does it right after the registration, which
// puts the planet on a random position of galaxy 1). It runs before every
// other part, and the parts after it see the planet at its new place.
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 5,
  fields: ['moveHome'],
  apply(s) {
    const to = s.d.moveHome;
    if (!to) return;
    const { store, planet: old } = s;
    if (store.repos.planets.ofOwner(s.user.id).length !== 1)
      throw new Error('`moveHome` moves a player who has one planet only');
    const id = `p${to.g}_${to.s}_${to.p}`;
    if (store.planet(id))
      throw new Error(`[${to.g}:${to.s}:${to.p}] is taken by another planet`);
    const moved = { ...old, id, g: to.g, s: to.s, p: to.p };
    store.savePlanet(moved);
    store.repos.planets.delete(old.id);
    s.planet = moved;
    s.home = { ...moved };
  },
};
