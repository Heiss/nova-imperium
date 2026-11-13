// The catalog of buildings, research, ships and defense. The numbers are the
// formulas of the classic game rules (rebuilt, no original code or art). The
// names and texts are German, the interface of the game is German; they live
// in texts.ts, which is not mutation-tested, and each entry spreads its texts
// (owner, 2026-11-12, #131).
import {
  BUILD_TEXT,
  DEF_TEXT,
  MISSION_TEXT,
  RES_TEXT,
  SHIP_TEXT,
} from './texts.ts';
import type { Cost, Requirements } from './types.ts';

/**
 * Energy production a research needs on the planet where it starts, or a
 * building on its planet: `base` at level 1, times `f` per further level. It
 * is checked, not consumed (#49, #51).
 */
interface EnergyNeed {
  base: number;
  f: number;
}

export interface BuildingDef {
  n: string;
  ab: string;
  cost: Cost;
  f: number;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req?: Requirements;
  energy?: EnergyNeed;
  /** Fields every level adds to its planet (Weltenschmiede, #51). */
  fields?: number;
}

export interface ResearchDef {
  n: string;
  ab: string;
  cost: Cost;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req: Requirements;
  energy?: EnergyNeed;
}

export type DriveKey = 'comb' | 'impulse' | 'hdrive';

interface UnitDefBase {
  n: string;
  ab: string;
  cost: Cost;
  atk: number;
  sh: number;
  req: Requirements;
  rf?: Record<string, number>;
  ds?: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
}

/**
 * A drive a ship switches to once the player has researched `from` (issue
 * #57): it replaces the base `drive` and `speed` of the ship.
 */
interface DriveSwitch {
  drive: DriveKey;
  speed: number;
  from: { research: string; level: number };
}

export interface ShipDef extends UnitDefBase {
  cargo: number;
  /** Base speed with the base `drive`. */
  speed: number;
  fuel: number;
  drive: DriveKey;
  /** Later drives; the last one whose research is reached flies the ship. */
  drives?: DriveSwitch[];
}

export interface DefenseDef extends UnitDefBase {
  /** At most one per planet, the shield domes (#50, D3). */
  once?: true;
}
export type UnitDef = ShipDef | DefenseDef;

export const BUILD: Record<string, BuildingDef> = {
  metal: {
    ...BUILD_TEXT.metal,
    cost: [60, 15, 0],
    f: 1.5,
  },
  crystal: {
    ...BUILD_TEXT.crystal,
    cost: [48, 24, 0],
    f: 1.6,
  },
  deut: {
    ...BUILD_TEXT.deut,
    cost: [225, 75, 0],
    f: 1.5,
  },
  solar: {
    ...BUILD_TEXT.solar,
    cost: [75, 30, 0],
    f: 1.5,
  },
  // Issue #47. Not in version 1; the classic values (owner, 2026-11-12).
  fusion: {
    ...BUILD_TEXT.fusion,
    cost: [900, 360, 180],
    f: 1.8,
    req: {
      b: {
        deut: 5,
      },
      r: {
        energy: 3,
      },
    },
  },
  robot: {
    ...BUILD_TEXT.robot,
    cost: [400, 120, 200],
    f: 2,
  },
  // Issue #48. Not in version 1; the classic values (owner, 2026-11-11).
  nanite: {
    ...BUILD_TEXT.nanite,
    cost: [1000000, 500000, 100000],
    f: 2,
    req: {
      b: {
        robot: 10,
      },
      r: {
        computer: 10,
      },
    },
  },
  // Issue #51, the classic Terraformer. Not in version 1; the classic values
  // (owner, 2026-11-13).
  terraformer: {
    ...BUILD_TEXT.terraformer,
    cost: [0, 50000, 100000],
    f: 2,
    req: {
      b: {
        nanite: 1,
      },
      r: {
        energy: 12,
      },
    },
    energy: { base: 1000, f: 2 },
    fields: 5,
  },
  yard: {
    ...BUILD_TEXT.yard,
    cost: [400, 200, 100],
    f: 2,
    req: {
      b: {
        robot: 2,
      },
    },
  },
  lab: {
    ...BUILD_TEXT.lab,
    cost: [200, 400, 200],
    f: 2,
  },
  smetal: {
    ...BUILD_TEXT.smetal,
    cost: [1000, 0, 0],
    f: 2,
  },
  scrystal: {
    ...BUILD_TEXT.scrystal,
    cost: [1000, 500, 0],
    f: 2,
  },
  sdeut: {
    ...BUILD_TEXT.sdeut,
    cost: [1000, 1000, 0],
    f: 2,
  },
};

export const RES: Record<string, ResearchDef> = {
  energy: {
    ...RES_TEXT.energy,
    cost: [0, 800, 400],
    req: {
      b: {
        lab: 1,
      },
    },
  },
  laser: {
    ...RES_TEXT.laser,
    cost: [200, 100, 0],
    req: {
      b: {
        lab: 1,
      },
      r: {
        energy: 2,
      },
    },
  },
  comb: {
    ...RES_TEXT.comb,
    cost: [400, 0, 600],
    req: {
      b: {
        lab: 1,
      },
      r: {
        energy: 1,
      },
    },
  },
  impulse: {
    ...RES_TEXT.impulse,
    cost: [2000, 4000, 600],
    req: {
      b: {
        lab: 2,
      },
      r: {
        energy: 1,
      },
    },
  },
  hyper: {
    ...RES_TEXT.hyper,
    cost: [0, 4000, 2000],
    req: {
      b: {
        lab: 7,
      },
      r: {
        energy: 5,
        shield: 5,
      },
    },
  },
  hdrive: {
    ...RES_TEXT.hdrive,
    cost: [10000, 20000, 6000],
    req: {
      b: {
        lab: 7,
      },
      r: {
        hyper: 3,
      },
    },
  },
  spy: {
    ...RES_TEXT.spy,
    cost: [200, 1000, 200],
    req: {
      b: {
        lab: 3,
      },
    },
  },
  computer: {
    ...RES_TEXT.computer,
    cost: [0, 400, 600],
    req: {
      b: {
        lab: 1,
      },
    },
  },
  weapons: {
    ...RES_TEXT.weapons,
    cost: [800, 200, 0],
    req: {
      b: {
        lab: 4,
      },
    },
  },
  shield: {
    ...RES_TEXT.shield,
    cost: [200, 600, 0],
    req: {
      b: {
        lab: 6,
      },
      r: {
        energy: 3,
      },
    },
  },
  armor: {
    ...RES_TEXT.armor,
    cost: [1000, 0, 0],
    req: {
      b: {
        lab: 2,
      },
    },
  },
  // Issue #49. Not in version 1; the classic values (owner, 2026-11-12).
  ion: {
    ...RES_TEXT.ion,
    cost: [1000, 300, 100],
    req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
  },
  plasma: {
    ...RES_TEXT.plasma,
    cost: [2000, 4000, 1000],
    req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
  },
  graviton: {
    ...RES_TEXT.graviton,
    cost: [0, 0, 0],
    energy: { base: 300000, f: 3 },
    req: { b: { lab: 12 } },
  },
  ifn: {
    ...RES_TEXT.ifn,
    cost: [240000, 400000, 160000],
    req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
  },
};

export const SHIPS: Record<string, ShipDef> = {
  sc: {
    ...SHIP_TEXT.sc,
    cost: [2000, 2000, 0],
    atk: 5,
    sh: 10,
    cargo: 5000,
    speed: 5000,
    fuel: 10,
    drive: 'comb',
    req: {
      b: {
        yard: 2,
      },
      r: {
        comb: 2,
      },
    },
  },
  lc: {
    ...SHIP_TEXT.lc,
    cost: [6000, 6000, 0],
    atk: 5,
    sh: 25,
    cargo: 25000,
    speed: 7500,
    fuel: 50,
    drive: 'comb',
    req: {
      b: {
        yard: 4,
      },
      r: {
        comb: 6,
      },
    },
  },
  colony: {
    ...SHIP_TEXT.colony,
    cost: [10000, 20000, 10000],
    atk: 50,
    sh: 100,
    cargo: 7500,
    speed: 2500,
    fuel: 1000,
    drive: 'impulse',
    req: { b: { yard: 4 }, r: { impulse: 3 } },
  },
  lf: {
    ...SHIP_TEXT.lf,
    cost: [3000, 1000, 0],
    atk: 50,
    sh: 10,
    cargo: 50,
    speed: 12500,
    fuel: 20,
    drive: 'comb',
    req: {
      b: {
        yard: 1,
      },
      r: {
        comb: 1,
      },
    },
  },
  hf: {
    ...SHIP_TEXT.hf,
    cost: [6000, 4000, 0],
    atk: 150,
    sh: 25,
    cargo: 100,
    speed: 10000,
    fuel: 75,
    drive: 'impulse',
    req: {
      b: {
        yard: 3,
      },
      r: {
        armor: 2,
        impulse: 2,
      },
    },
    rf: {
      sc: 3,
    },
  },
  cr: {
    ...SHIP_TEXT.cr,
    cost: [20000, 7000, 2000],
    atk: 400,
    sh: 50,
    cargo: 800,
    speed: 15000,
    fuel: 300,
    drive: 'impulse',
    req: {
      b: {
        yard: 5,
      },
      r: {
        impulse: 4,
        laser: 4,
      },
    },
    rf: {
      lf: 6,
      rl: 10,
    },
  },
  bs: {
    ...SHIP_TEXT.bs,
    cost: [45000, 15000, 0],
    atk: 1000,
    sh: 200,
    cargo: 1500,
    speed: 10000,
    fuel: 500,
    drive: 'hdrive',
    req: {
      b: {
        yard: 7,
      },
      r: {
        hdrive: 4,
      },
    },
  },
  // Issues #58 and #59. Not in version 1; the classic values (owner,
  // 2026-11-12). Every ship has rapid fire 5 against the probe (battle.ts).
  bc: {
    ...SHIP_TEXT.bc,
    cost: [30000, 40000, 15000],
    atk: 700,
    sh: 400,
    cargo: 750,
    speed: 10000,
    fuel: 250,
    drive: 'hdrive',
    req: { b: { yard: 8 }, r: { laser: 12, hyper: 5, hdrive: 5 } },
    rf: { sc: 3, lc: 3, hf: 4, cr: 4, bs: 7 },
  },
  dr: {
    ...SHIP_TEXT.dr,
    cost: [60000, 50000, 15000],
    atk: 2000,
    sh: 500,
    cargo: 2000,
    speed: 5000,
    fuel: 1000,
    drive: 'hdrive',
    req: { b: { yard: 9 }, r: { hdrive: 6, hyper: 5 } },
    rf: { ll: 10, bc: 2 },
  },
  // Issue #57, classic before the update of 2019-12-13 (owner, 2026-11-12):
  // Impulstriebwerk, from Hyperraumantrieb 8 the Hyperraumantrieb.
  bb: {
    ...SHIP_TEXT.bb,
    cost: [50000, 25000, 15000],
    atk: 1000,
    sh: 500,
    cargo: 500,
    speed: 4000,
    fuel: 1000,
    drive: 'impulse',
    drives: [
      { drive: 'hdrive', speed: 5000, from: { research: 'hdrive', level: 8 } },
    ],
    req: { b: { yard: 8 }, r: { impulse: 6, plasma: 5 } },
    rf: { rl: 20, ll: 20, hl: 10, ionc: 10 },
  },
  // Issue #60, classic values (owner, 2026-11-12). Its 1,250 against the probe
  // and the Solarsatellit replace the general 5 of rapid() in battle.ts. None
  // against the Plasmawerfer and the shield domes (#50).
  dstar: {
    ...SHIP_TEXT.dstar,
    cost: [5000000, 4000000, 1000000],
    atk: 200000,
    sh: 50000,
    cargo: 1000000,
    speed: 100,
    fuel: 1,
    drive: 'hdrive',
    req: { b: { yard: 12 }, r: { hyper: 6, hdrive: 7, graviton: 1 } },
    rf: {
      probe: 1250,
      sat: 1250,
      colony: 250,
      sc: 250,
      lc: 250,
      lf: 200,
      hf: 100,
      cr: 33,
      bs: 30,
      bb: 25,
      bc: 15,
      dr: 5,
      rl: 200,
      ll: 200,
      hl: 100,
      gauss: 50,
      ionc: 100,
    },
  },
  probe: {
    ...SHIP_TEXT.probe,
    cost: [0, 1000, 0],
    atk: 0.01,
    sh: 0.01,
    cargo: 0,
    speed: 100000000,
    fuel: 1,
    drive: 'comb',
    req: {
      b: {
        yard: 3,
      },
      r: {
        comb: 3,
        spy: 2,
      },
    },
  },
  sat: {
    ...SHIP_TEXT.sat,
    cost: [0, 2000, 500],
    atk: 1,
    sh: 1,
    cargo: 0,
    speed: 0,
    fuel: 0,
    drive: 'comb',
    req: { b: { yard: 1 } },
  },
};

export const DEF: Record<string, DefenseDef> = {
  rl: {
    ...DEF_TEXT.rl,
    cost: [2000, 0, 0],
    atk: 80,
    sh: 20,
    req: {
      b: {
        yard: 1,
      },
    },
  },
  ll: {
    ...DEF_TEXT.ll,
    cost: [1500, 500, 0],
    atk: 100,
    sh: 25,
    req: {
      b: {
        yard: 2,
      },
      r: {
        energy: 1,
        laser: 3,
      },
    },
  },
  hl: {
    ...DEF_TEXT.hl,
    cost: [6000, 2000, 0],
    atk: 250,
    sh: 100,
    req: {
      b: {
        yard: 4,
      },
      r: {
        energy: 3,
        laser: 6,
      },
    },
  },
  gauss: {
    ...DEF_TEXT.gauss,
    cost: [20000, 15000, 2000],
    atk: 1100,
    sh: 200,
    req: {
      b: {
        yard: 6,
      },
      r: {
        energy: 6,
        weapons: 3,
        shield: 1,
      },
    },
  },
  // Issue #50. Not in version 1; the classic values (owner, 2026-11-12).
  // No unit has rapid fire against these four, and they have none.
  ionc: {
    ...DEF_TEXT.ionc,
    cost: [2000, 6000, 0],
    atk: 150,
    sh: 500,
    req: { b: { yard: 4 }, r: { ion: 4 } },
  },
  pt: {
    ...DEF_TEXT.pt,
    cost: [50000, 50000, 30000],
    atk: 3000,
    sh: 300,
    req: { b: { yard: 8 }, r: { plasma: 7 } },
  },
  ssd: {
    ...DEF_TEXT.ssd,
    cost: [10000, 10000, 0],
    atk: 1,
    sh: 2000,
    req: { b: { yard: 1 }, r: { shield: 2 } },
    once: true,
  },
  lsd: {
    ...DEF_TEXT.lsd,
    cost: [50000, 50000, 0],
    atk: 1,
    sh: 10000,
    req: { b: { yard: 6 }, r: { shield: 6 } },
    once: true,
  },
};

export const UNIT: Record<string, UnitDef> = { ...SHIPS, ...DEF };

export const DRIVE_BONUS: Record<DriveKey, number> = {
  comb: 0.1,
  impulse: 0.2,
  hdrive: 0.3,
};

export const MISSION = {
  attack: MISSION_TEXT.attack,
  transport: MISSION_TEXT.transport,
  spy: MISSION_TEXT.spy,
  colonize: MISSION_TEXT.colonize,
  deploy: MISSION_TEXT.deploy,
} as const;

/** Producers whose share the player sets on the resources page. */
export const PRODUCERS = [
  'metal',
  'crystal',
  'deut',
  'solar',
  'sat',
  'fusion',
] as const;

export const isShip = (key: string): boolean => Object.hasOwn(SHIPS, key);
export const isDefense = (key: string): boolean => Object.hasOwn(DEF, key);

/** Ships that can be sent; the Solarsatellit (speed 0) stays at its planet. */
export const canFly = (key: string): boolean =>
  isShip(key) && SHIPS[key]!.speed > 0;
