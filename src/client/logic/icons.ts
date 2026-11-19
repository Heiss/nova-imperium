// Pictures of the catalog: one SVG of the Nova Imperium icon set per building,
// research, ship and defense, served as static files (issue #61, D1).
const FILES: Record<string, string> = {
  metal: 'buildings/metal_mine',
  crystal: 'buildings/crystal_mine',
  deut: 'buildings/deuterium_synthesizer',
  solar: 'buildings/solar_plant',
  fusion: 'buildings/fusion_reactor',
  robot: 'buildings/robotics_factory',
  nanite: 'buildings/nanite_factory',
  terraformer: 'buildings/terraformer',
  yard: 'buildings/shipyard',
  lab: 'buildings/research_lab',
  smetal: 'buildings/metal_storage',
  scrystal: 'buildings/crystal_storage',
  sdeut: 'buildings/deuterium_tank',
  moonbase: 'buildings/lunar_base',
  phalanx: 'buildings/sensor_phalanx',
  silo: 'buildings/missile_silo',
  jumpgate: 'buildings/jump_gate',
  market: 'buildings/trading_post',
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
  ion: 'research/ion_technology',
  plasma: 'research/plasma_technology',
  graviton: 'research/graviton_technology',
  ifn: 'research/intergalactic_research_network',
  // #190: the picture of the Auspex-Lehre with its own name until one is drawn [V].
  carto: 'research/auspex_cartography',
  // #93: the picture of the Auspex-Lehre with its own name until one is drawn [V].
  expo: 'research/expedition_technology',
  sc: 'ships/small_cargo',
  lc: 'ships/large_cargo',
  colony: 'ships/colony_ship',
  recycler: 'ships/recycler',
  lf: 'ships/light_fighter',
  hf: 'ships/heavy_fighter',
  cr: 'ships/cruiser',
  bs: 'ships/battleship',
  bc: 'ships/battlecruiser',
  dr: 'ships/destroyer',
  bb: 'ships/bomber',
  dstar: 'ships/deathstar',
  probe: 'ships/espionage_probe',
  sat: 'ships/solar_satellite',
  rl: 'defense/rocket_launcher',
  ll: 'defense/light_laser',
  hl: 'defense/heavy_laser',
  gauss: 'defense/gauss_cannon',
  ionc: 'defense/ion_cannon',
  pt: 'defense/plasma_turret',
  ssd: 'defense/small_shield_dome',
  lsd: 'defense/large_shield_dome',
  abm: 'defense/anti_ballistic_missile',
  ipm: 'defense/interplanetary_missile',
};

export const ICON_KEYS = Object.keys(FILES);

/** The URL of the picture of a catalog entry, or null for an unknown key. */
export const iconURL = (key: string): string | null =>
  Object.hasOwn(FILES, key) ? `/icons/${FILES[key]}.svg` : null;

export type ResourceKey = 'metal' | 'crystal' | 'deuterium' | 'energy';

/** Small resource icons (≤ 32 px) are simplified drawings (D2). */
export const resourceIconURL = (key: ResourceKey, small = true): string =>
  small ? `/icons/resources/small/${key}.svg` : `/icons/resources/${key}.svg`;
