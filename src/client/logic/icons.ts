// Pictures of the catalog: one SVG of the Nova Imperium icon set per building,
// research, ship and defense, served as static files (issue #61, D1).
const FILES: Record<string, string> = {
  metal: 'buildings/metal_mine',
  crystal: 'buildings/crystal_mine',
  deut: 'buildings/deuterium_synthesizer',
  solar: 'buildings/solar_plant',
  robot: 'buildings/robotics_factory',
  yard: 'buildings/shipyard',
  lab: 'buildings/research_lab',
  smetal: 'buildings/metal_storage',
  scrystal: 'buildings/crystal_storage',
  sdeut: 'buildings/deuterium_tank',
  energy: 'research/energy_technology',
  laser: 'research/laser_technology',
  comb: 'research/combustion_drive',
  impulse: 'research/impulse_drive',
  hyper: 'research/hyperspace_technology',
  hdrive: 'research/hyperspace_drive',
  spy: 'research/espionage_technology',
  computer: 'research/computer_technology',
  weapons: 'research/weapons_technology',
  shield: 'research/shielding_technology',
  armor: 'research/armour_technology',
  sc: 'ships/small_cargo',
  lc: 'ships/large_cargo',
  colony: 'ships/colony_ship',
  lf: 'ships/light_fighter',
  hf: 'ships/heavy_fighter',
  cr: 'ships/cruiser',
  bs: 'ships/battleship',
  probe: 'ships/espionage_probe',
  rl: 'defense/rocket_launcher',
  ll: 'defense/light_laser',
  hl: 'defense/heavy_laser',
  gauss: 'defense/gauss_cannon',
};

export const ICON_KEYS = Object.keys(FILES);

/** The URL of the picture of a catalog entry, or null for an unknown key. */
export const iconURL = (key: string): string | null =>
  Object.hasOwn(FILES, key) ? `/icons/${FILES[key]}.svg` : null;

export type ResourceKey = 'metal' | 'crystal' | 'deuterium' | 'energy';

/** Small resource icons (≤ 32 px) are simplified drawings (D2). */
export const resourceIconURL = (key: ResourceKey, small = true): string =>
  small ? `/icons/resources/small/${key}.svg` : `/icons/resources/${key}.svg`;
