// The catalog of buildings, research, ships and defense. The numbers are the
// formulas of the classic game rules (rebuilt, no original code or art). The
// names are German: the interface of the game is German.
import type { Cost, Requirements } from './types.ts';

export interface BuildingDef {
  n: string;
  ab: string;
  cost: Cost;
  f: number;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req?: Requirements;
}

export interface ResearchDef {
  n: string;
  ab: string;
  cost: Cost;
  ds: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
  req: Requirements;
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

export interface ShipDef extends UnitDefBase {
  cargo: number;
  speed: number;
  fuel: number;
  drive: DriveKey;
}

export type DefenseDef = UnitDefBase;
export type UnitDef = ShipDef | DefenseDef;

export const BUILD: Record<string, BuildingDef> = {
  metal: {
    n: 'Metallmine',
    ab: 'Me',
    cost: [60, 15, 0],
    f: 1.5,
    ds: 'Fördert Metall, den wichtigsten Grundrohstoff.',
  },
  crystal: {
    n: 'Kristallmine',
    ab: 'Kr',
    cost: [48, 24, 0],
    f: 1.6,
    ds: 'Baut Kristall ab – nötig für Elektronik und Forschung.',
  },
  deut: {
    n: 'Deuteriumsynthetisierer',
    ab: 'De',
    cost: [225, 75, 0],
    f: 1.5,
    ds: 'Gewinnt Deuterium. Kältere Planeten produzieren mehr.',
  },
  solar: {
    n: 'Solarkraftwerk',
    ab: 'So',
    cost: [75, 30, 0],
    f: 1.5,
    ds: 'Liefert Energie für die Minen.',
  },
  robot: {
    n: 'Roboterfabrik',
    ab: 'Ro',
    cost: [400, 120, 200],
    f: 2,
    ds: 'Verkürzt die Bauzeit von Gebäuden.',
  },
  // Issue #48. Not in version 1; the classic values (owner, 2026-11-11).
  nanite: {
    n: 'Nanitenfabrik',
    ab: 'Na',
    cost: [1000000, 500000, 100000],
    f: 2,
    ds: 'Halbiert die Bauzeit von Gebäuden, Schiffen und Verteidigung pro Stufe.',
    req: {
      b: {
        robot: 10,
      },
      r: {
        computer: 10,
      },
    },
  },
  yard: {
    n: 'Raumschiffwerft',
    ab: 'Wf',
    cost: [400, 200, 100],
    f: 2,
    ds: 'Baut Schiffe und Verteidigung. Höhere Stufe = schneller.',
    req: {
      b: {
        robot: 2,
      },
    },
  },
  lab: {
    n: 'Forschungslabor',
    ab: 'La',
    cost: [200, 400, 200],
    f: 2,
    ds: 'Ermöglicht und beschleunigt Forschung.',
  },
  smetal: {
    n: 'Metallspeicher',
    ab: 'MS',
    cost: [1000, 0, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Metall.',
  },
  scrystal: {
    n: 'Kristallspeicher',
    ab: 'KS',
    cost: [1000, 500, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Kristall.',
  },
  sdeut: {
    n: 'Deuteriumtank',
    ab: 'DT',
    cost: [1000, 1000, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Deuterium.',
  },
};

export const RES: Record<string, ResearchDef> = {
  energy: {
    n: 'Energietechnik',
    ab: 'En',
    cost: [0, 800, 400],
    req: {
      b: {
        lab: 1,
      },
    },
    ds: 'Grundlage vieler weiterer Technologien.',
  },
  laser: {
    n: 'Lasertechnik',
    ab: 'Ls',
    cost: [200, 100, 0],
    req: {
      b: {
        lab: 1,
      },
      r: {
        energy: 2,
      },
    },
    ds: 'Gebündeltes Licht – Basis für Laserwaffen.',
  },
  comb: {
    n: 'Verbrennungstriebwerk',
    ab: 'VT',
    cost: [400, 0, 600],
    req: {
      b: {
        lab: 1,
      },
      r: {
        energy: 1,
      },
    },
    ds: '+10 % Geschwindigkeit pro Stufe (Transporter, Jäger, Sonden).',
  },
  impulse: {
    n: 'Impulstriebwerk',
    ab: 'IT',
    cost: [2000, 4000, 600],
    req: {
      b: {
        lab: 2,
      },
      r: {
        energy: 1,
      },
    },
    ds: '+20 % pro Stufe (Schwere Jäger, Kreuzer).',
  },
  hyper: {
    n: 'Hyperraumtechnik',
    ab: 'HT',
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
    ds: 'Erschließt den Hyperraum.',
  },
  hdrive: {
    n: 'Hyperraumantrieb',
    ab: 'HA',
    cost: [10000, 20000, 6000],
    req: {
      b: {
        lab: 7,
      },
      r: {
        hyper: 3,
      },
    },
    ds: '+30 % pro Stufe (Schlachtschiffe).',
  },
  spy: {
    n: 'Spionagetechnik',
    ab: 'Sp',
    cost: [200, 1000, 200],
    req: {
      b: {
        lab: 3,
      },
    },
    ds: 'Bessere Spionageberichte, bessere Abwehr.',
  },
  computer: {
    n: 'Computertechnik',
    ab: 'Co',
    cost: [0, 400, 600],
    req: {
      b: {
        lab: 1,
      },
    },
    ds: '+1 Flottenslot pro Stufe.',
  },
  weapons: {
    n: 'Waffentechnik',
    ab: 'Wa',
    cost: [800, 200, 0],
    req: {
      b: {
        lab: 4,
      },
    },
    ds: '+10 % Angriff pro Stufe.',
  },
  shield: {
    n: 'Schildtechnik',
    ab: 'Sc',
    cost: [200, 600, 0],
    req: {
      b: {
        lab: 6,
      },
      r: {
        energy: 3,
      },
    },
    ds: '+10 % Schilde pro Stufe.',
  },
  armor: {
    n: 'Raumschiffpanzerung',
    ab: 'Pa',
    cost: [1000, 0, 0],
    req: {
      b: {
        lab: 2,
      },
    },
    ds: '+10 % Strukturpunkte pro Stufe.',
  },
};

export const SHIPS: Record<string, ShipDef> = {
  sc: {
    n: 'Kleiner Transporter',
    ab: 'KT',
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
    n: 'Großer Transporter',
    ab: 'GT',
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
    n: 'Kolonialschiff',
    ab: 'KS',
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
    n: 'Leichter Jäger',
    ab: 'LJ',
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
    n: 'Schwerer Jäger',
    ab: 'SJ',
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
    n: 'Kreuzer',
    ab: 'Kr',
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
    n: 'Schlachtschiff',
    ab: 'SS',
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
  probe: {
    n: 'Spionagesonde',
    ab: 'So',
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
};

export const DEF: Record<string, DefenseDef> = {
  rl: {
    n: 'Raketenwerfer',
    ab: 'RW',
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
    n: 'Leichtes Lasergeschütz',
    ab: 'LL',
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
    n: 'Schweres Lasergeschütz',
    ab: 'SL',
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
    n: 'Gaußkanone',
    ab: 'GK',
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
};

export const UNIT: Record<string, UnitDef> = { ...SHIPS, ...DEF };

export const DRIVE_BONUS: Record<DriveKey, number> = {
  comb: 0.1,
  impulse: 0.2,
  hdrive: 0.3,
};

export const MISSION = {
  attack: 'Angreifen',
  transport: 'Transport',
  spy: 'Spionage',
  colonize: 'Kolonisieren',
} as const;

/** Buildings whose production share the player sets on the resources page. */
export const PRODUCERS = ['metal', 'crystal', 'deut', 'solar'] as const;

export const isShip = (key: string): boolean => Object.hasOwn(SHIPS, key);
export const isDefense = (key: string): boolean => Object.hasOwn(DEF, key);
