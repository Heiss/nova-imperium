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

/**
 * Energy production a research needs on the planet where it starts: `base` at
 * level 1, times `f` per further level. It is checked, not consumed (#49).
 */
interface EnergyNeed {
  base: number;
  f: number;
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
    n: 'Adamant-Tiefbohrung',
    ab: 'AT',
    cost: [60, 15, 0],
    f: 1.5,
    ds: 'Fördert Adamant, den wichtigsten Grundrohstoff.',
    lt: 'Bohrtürme reißen Adamant aus den Adern des Planeten, das Fundament jedes Bauwerks.\n\nSo funktioniert es: Jede Stufe steigert die Förderung auf diesem Planeten und ebenso den Energiebedarf. Fehlt Energie, fördern alle Minen des Planeten im selben Verhältnis weniger. Eine kleine Grundmenge kommt auch ohne Mine.',
  },
  crystal: {
    n: 'Psikristall-Steinbruch',
    ab: 'PS',
    cost: [48, 24, 0],
    f: 1.6,
    ds: 'Baut Psikristall ab – nötig für Elektronik und Forschung.',
    lt: 'Arbeitskolonnen schlagen Psikristall aus dem Fels, dessen Gitter Ströme und Gedanken leitet.\n\nSo funktioniert es: Jede Stufe steigert den Abbau auf diesem Planeten und ebenso den Energiebedarf. Fehlt Energie, fördern alle Minen des Planeten im selben Verhältnis weniger. Eine kleine Grundmenge kommt auch ohne Steinbruch.',
  },
  deut: {
    n: 'Promethium-Raffinerie',
    ab: 'PR',
    cost: [225, 75, 0],
    f: 1.5,
    ds: 'Gewinnt Promethium. Kältere Planeten produzieren mehr.',
    lt: 'Die Raffinerie destilliert Promethium, den heiligen Brennstoff jeder Flotte.\n\nSo funktioniert es: Jede Stufe steigert den Ausstoß auf diesem Planeten, kostet aber mehr Energie als andere Minen gleicher Stufe. Kalte Planeten liefern mehr als heiße. Fehlt Energie, fördern alle Minen im selben Verhältnis weniger.',
  },
  solar: {
    n: 'Sonnenkathedrale',
    ab: 'SK',
    cost: [75, 30, 0],
    f: 1.5,
    ds: 'Liefert Energie für die Minen.',
    lt: 'Unter Spiegelgewölben fängt die Kathedrale das Licht des Sterns und wandelt es in Energie.\n\nSo funktioniert es: Jede Stufe liefert mehr Energie für diesen Planeten, unabhängig von seiner Temperatur. Reicht die Energie nicht für die Minen, fördern alle im selben Verhältnis weniger.',
  },
  // Issue #47. Not in version 1; the classic values (owner, 2026-11-12).
  fusion: {
    n: 'Fusionssanktum',
    ab: 'FS',
    cost: [900, 360, 180],
    f: 1.8,
    ds: 'Erzeugt Energie aus Promethium; Machina-Energetik steigert die Leistung.',
    req: {
      b: {
        deut: 5,
      },
      r: {
        energy: 3,
      },
    },
    lt: 'Im Herzen des Sanktums brennt Promethium in gebändigter Glut.\n\nSo funktioniert es: Jede Stufe liefert mehr Energie für diesen Planeten und verbrennt mehr Promethium aus seinem Vorrat; die Machina-Energetik steigert die Energie zusätzlich. Ist der Vorrat leer, drosselt es sich auf das, was der Planet nachliefert.',
  },
  robot: {
    n: 'Servitorenschmiede',
    ab: 'SF',
    cost: [400, 120, 200],
    f: 2,
    ds: 'Verkürzt die Bauzeit von Gebäuden.',
    lt: 'Servitoren aus Fleisch und Stahl schuften ohne Rast an den Bauwerken des Planeten.\n\nSo funktioniert es: Jede Stufe verkürzt die Bauzeit der Gebäude auf diesem Planeten, jede etwas weniger als die vorige. Auf Schiffe, Verteidigung und Forschung wirkt sie nicht.',
  },
  // Issue #48. Not in version 1; the classic values (owner, 2026-11-11).
  nanite: {
    n: 'Machina-Schwarmhalle',
    ab: 'MS',
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
    lt: 'Zahllose winzige Machina-Konstrukte formen Stahl und Stein schneller als jede Hand.\n\nSo funktioniert es: Jede Stufe verkürzt auf diesem Planeten die Bauzeit von Gebäuden, Schiffen und Verteidigung erneut kräftig, nicht aber die Forschung. Während des Ausbaus nimmt die Schiffsschmiede keine Aufträge an, und er ist erst möglich, wenn sie leer ist.',
  },
  yard: {
    n: 'Orbitale Schiffsschmiede',
    ab: 'OS',
    cost: [400, 200, 100],
    f: 2,
    ds: 'Baut Schiffe und Verteidigung. Höhere Stufe = schneller.',
    req: {
      b: {
        robot: 2,
      },
    },
    lt: 'In den Docks kreischen Schweißbrenner über neuen Rümpfen.\n\nSo funktioniert es: Sie baut die Schiffe und Verteidigung dieses Planeten, Auftrag für Auftrag; jede Stufe verkürzt die Bauzeit und erschließt größere Baumuster. Während ihres Ausbaus nimmt sie keine Aufträge an, und er ist erst möglich, wenn sie leer ist.',
  },
  lab: {
    n: 'Scholarium',
    ab: 'SC',
    cost: [200, 400, 200],
    f: 2,
    ds: 'Ermöglicht und beschleunigt Forschung.',
    lt: 'Im Scholarium ringen Gelehrte den Sternen ihr Wissen ab.\n\nSo funktioniert es: Forschung beginnt nur auf einem Planeten mit Scholarium, wird dort bezahlt und gilt dann für alle Planeten. Jede Stufe verkürzt dort die Forschungszeit. Während des Ausbaus beginnt hier keine Forschung, und solange eine läuft, kann kein Scholarium ausgebaut werden.',
  },
  smetal: {
    n: 'Adamant-Gewölbe',
    ab: 'AG',
    cost: [1000, 0, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Adamant.',
    lt: 'Unter gepanzerten Kuppeln lagert das Adamant des Planeten, gezählt bis zum letzten Barren.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht die Förderung; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
  scrystal: {
    n: 'Psikristall-Reliquiar',
    ab: 'RQ',
    cost: [1000, 500, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Psikristall.',
    lt: 'In geweihten Schreinen ruht der Psikristall, abgeschirmt gegen sein eigenes Flüstern.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht der Abbau; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
  sdeut: {
    n: 'Promethium-Zisterne',
    ab: 'PZ',
    cost: [1000, 1000, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Promethium.',
    lt: 'In der Zisterne schwappt ein See aus Brennstoff, den der kleinste Funke entzünden könnte.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht die Raffinerie; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
};

export const RES: Record<string, ResearchDef> = {
  energy: {
    n: 'Machina-Energetik',
    ab: 'ME',
    cost: [0, 800, 400],
    req: {
      b: {
        lab: 1,
      },
    },
    ds: 'Grundlage vieler weiterer Technologien.',
    lt: 'Die Machina-Energetik zwingt die Ströme der Reaktoren in die Leitungen der Maschinen.\n\nSo funktioniert es: Jede Stufe steigert die Energie jedes Fusionssanktums auf allen deinen Planeten. Sie ist Grundlage vieler weiterer Lehren.',
  },
  laser: {
    n: 'Lichtlanzen-Lehre',
    ab: 'LZ',
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
    lt: 'Gebündeltes Licht, heiß genug, um Panzerstahl zu schneiden.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Mit wachsender Stufe erschließt sie Lichtlanze, Fregatte, Ionen-Lehre, Schwere Lichtlanze, Plasma-Lehre und zuletzt den Jagdkreuzer.',
  },
  comb: {
    n: 'Promethium-Brennkammer',
    ab: 'PB',
    cost: [400, 0, 600],
    req: {
      b: {
        lab: 1,
      },
      r: {
        energy: 1,
      },
    },
    ds: '+10 % Geschwindigkeit pro Stufe (Frachtläufer, Lastbarken, Abfangjäger, Spähschädel).',
    lt: 'In den Brennkammern zündet Promethium in gebändigten Stößen.\n\nSo funktioniert es: Jede Stufe macht Frachtläufer, Lastbarken, Abfangjäger und Spähschädel schneller. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  impulse: {
    n: 'Plasma-Impulsantrieb',
    ab: 'PI',
    cost: [2000, 4000, 600],
    req: {
      b: {
        lab: 2,
      },
      r: {
        energy: 1,
      },
    },
    ds: '+20 % pro Stufe (Kolonistenarchen, Sturmjäger, Fregatten; Belagerungsbomber bis Warp-Antrieb 8).',
    lt: 'Der Antrieb stößt gebündelte Glut aus und trägt schwerere Rümpfe als jede Brennkammer.\n\nSo funktioniert es: Jede Stufe macht Kolonistenarchen, Sturmjäger und Fregatten schneller, ebenso Belagerungsbomber, bis sie auf den Warp-Antrieb umsteigen. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  hyper: {
    n: 'Warp-Theorie',
    ab: 'WT',
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
    ds: 'Erschließt den Warp.',
    lt: 'Die Warp-Theorie ergründet den Raum hinter dem Raum, in den kein Verstand ungeschützt blicken sollte.\n\nSo funktioniert es: Die Theorie verändert keine Werte. Sie erschließt Warp-Antrieb, Jagdkreuzer, Vernichter, Weltenbrecher und das Sternennetz der Gelehrten.',
  },
  hdrive: {
    n: 'Warp-Antrieb',
    ab: 'WA',
    cost: [10000, 20000, 6000],
    req: {
      b: {
        lab: 7,
      },
      r: {
        hyper: 3,
      },
    },
    ds: '+30 % pro Stufe (Kathedralschiffe, Jagdkreuzer, Vernichter, Weltenbrecher; Belagerungsbomber ab Stufe 8).',
    lt: 'Der Warp-Antrieb reißt schwere Schiffe durch den Raum hinter dem Raum.\n\nSo funktioniert es: Jede Stufe macht Kathedralschiffe, Jagdkreuzer, Vernichter und Weltenbrecher schneller. Weit genug erforscht, treibt er auch die Belagerungsbomber an. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  spy: {
    n: 'Auspex-Lehre',
    ab: 'AU',
    cost: [200, 1000, 200],
    req: {
      b: {
        lab: 3,
      },
    },
    ds: 'Bessere Auspex-Berichte, bessere Abwehr.',
    lt: 'Die Auspex-Lehre schärft die Sinne der Spähschädel und entlarvt fremde Augen am eigenen Himmel.\n\nSo funktioniert es: Je mehr Spähschädel du schickst und je weiter du dem Ziel in dieser Lehre voraus bist, desto mehr verrät der Bericht. Ein Vorsprung senkt die Gefahr, dass sie abgeschossen werden, ein Rückstand erhöht sie.',
  },
  computer: {
    n: 'Kogitator-Doktrin',
    ab: 'KD',
    cost: [0, 400, 600],
    req: {
      b: {
        lab: 1,
      },
    },
    ds: '+1 Flottenslot pro Stufe.',
    lt: 'Kogitatoren berechnen Kurse und Ziele, damit kein Befehlshaber den Überblick verliert.\n\nSo funktioniert es: Jede Stufe erlaubt eine weitere Flotte, die gleichzeitig unterwegs ist, über alle deine Planeten zusammen.',
  },
  weapons: {
    n: 'Waffensegnung',
    ab: 'WS',
    cost: [800, 200, 0],
    req: {
      b: {
        lab: 4,
      },
    },
    ds: '+10 % Angriff pro Stufe.',
    lt: 'Jede Waffe wird gesalbt und geweiht, bevor sie ins Feld zieht.\n\nSo funktioniert es: Jede Stufe verstärkt im Kampf den Angriff aller deiner Schiffe und Verteidigungsanlagen.',
  },
  shield: {
    n: 'Refraktionsfelder',
    ab: 'RE',
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
    lt: 'Flimmernde Felder lenken feindliches Feuer ab, bevor es den Rumpf erreicht.\n\nSo funktioniert es: Jede Stufe stärkt die Schilde aller deiner Schiffe und Verteidigungsanlagen. Schilde laden sich jede Kampfrunde neu auf, und Schüsse unter einem winzigen Bruchteil des Schildes prallen ab.',
  },
  armor: {
    n: 'Adamant-Panzerung',
    ab: 'AP',
    cost: [1000, 0, 0],
    req: {
      b: {
        lab: 2,
      },
    },
    ds: '+10 % Strukturpunkte pro Stufe.',
    lt: 'Schicht um Schicht wird Adamant auf die Rümpfe geschmiedet.\n\nSo funktioniert es: Jede Stufe erhöht die Struktur aller deiner Schiffe und Verteidigungsanlagen im Kampf. Schwer beschädigte Einheiten können nach einem Treffer zerbersten.',
  },
  // Issue #49. Not in version 1; the classic values (owner, 2026-11-12).
  ion: {
    n: 'Ionen-Lehre',
    ab: 'IL',
    cost: [1000, 300, 100],
    req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
    ds: 'Beschleunigte Ionen – Basis für Ionenwaffen.',
    lt: 'Die Ionen-Lehre zwingt geladene Teilchen in gebündelte Ströme.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Sie erschließt die Ionenlanze und ist der Weg zur Plasma-Lehre.',
  },
  plasma: {
    n: 'Plasma-Lehre',
    ab: 'PL',
    cost: [2000, 4000, 1000],
    req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
    ds: 'Gebändigtes Plasma – Basis für Plasmawaffen.',
    lt: 'Die Plasma-Lehre bändigt Materie, die heißer brennt als das Herz eines Sterns.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Sie erschließt den Belagerungsbomber und mit höherer Stufe die Plasmabatterie.',
  },
  graviton: {
    n: 'Gravitonen-Mysterium',
    ab: 'GM',
    cost: [0, 0, 0],
    energy: { base: 300000, f: 3 },
    req: { b: { lab: 12 } },
    ds: 'Kostet keine Rohstoffe, braucht aber eine gewaltige Energieproduktion.',
    lt: 'Das Mysterium ergründet die Kraft, die Welten zusammenhält und Sterne verschlingt.\n\nSo funktioniert es: Es kostet keine Rohstoffe, doch der Planet, auf dem es beginnt, muss genug Energie erzeugen; verbraucht wird sie nicht, und jede Stufe verlangt weit mehr. Es erschließt den Weltenbrecher.',
  },
  ifn: {
    n: 'Sternennetz der Gelehrten',
    ab: 'SN',
    cost: [240000, 400000, 160000],
    req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
    ds: 'Vernetzt pro Stufe ein weiteres Scholarium deiner Planeten.',
    lt: 'Das Sternennetz verbindet die Scholarien deiner Welten zu einem denkenden Chor.\n\nSo funktioniert es: Jede Stufe bindet ein weiteres Scholarium deiner anderen Planeten in jede Forschung ein: die höchsten, die die verlangte Stufe haben und nicht ausgebaut werden. Ihre Stufen zählen zum Scholarium des Startplaneten.',
  },
};

export const SHIPS: Record<string, ShipDef> = {
  sc: {
    n: 'Frachtläufer',
    ab: 'FL',
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
    lt: 'Der Frachtläufer ist ein schmuckloser Lastesel zwischen den Welten.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer und trägt Lieferungen und Beute. Sturmjäger, Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn: Nach einem Schuss auf ihn feuern sie mit einer gewissen Chance sofort erneut.',
  },
  lc: {
    n: 'Lastbarke',
    ab: 'LB',
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
    lt: 'Die Lastbarke ist ein gewaltiger Frachtrumpf für ganze Kolonien und reiche Beute.\n\nSo funktioniert es: Sie fliegt mit der Promethium-Brennkammer, schneller als ein Frachtläufer, und trägt ein Vielfaches seiner Ladung bei höherem Verbrauch. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  colony: {
    n: 'Kolonistenarche',
    ab: 'KA',
    cost: [10000, 20000, 10000],
    atk: 50,
    sh: 100,
    cargo: 7500,
    speed: 2500,
    fuel: 1000,
    drive: 'impulse',
    req: { b: { yard: 4 }, r: { impulse: 3 } },
    lt: 'Die Arche trägt Siedler, Saatgut und Werkzeug zu einer freien Welt.\n\nSo funktioniert es: Bei der Landnahme einer freien Position geht eine Arche in der neuen Kolonie auf, und die Flotte lädt dort ihre Fracht ab. Ist die Position schon besetzt, kehrt die Flotte um. Sie fliegt mit dem Plasma-Impulsantrieb.',
  },
  lf: {
    n: 'Abfangjäger',
    ab: 'AJ',
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
    lt: 'Abfangjäger sind billig, zahlreich und entbehrlich.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer. Jeder Schuss im Kampf wählt ein zufälliges Ziel, darum binden viele Abfangjäger feindliches Feuer. Fregatten und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  hf: {
    n: 'Sturmjäger',
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
    lt: 'Der Sturmjäger ist schwerer gepanzert als der Abfangjäger und der Schrecken ungeschützter Konvois.\n\nSo funktioniert es: Er fliegt mit dem Plasma-Impulsantrieb und hat Schnellfeuer gegen Frachtläufer. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  cr: {
    n: 'Fregatte',
    ab: 'FR',
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
    lt: 'Die Fregatte ist das schnelle, wendige Rückgrat jeder Flotte.\n\nSo funktioniert es: Sie fliegt mit dem Plasma-Impulsantrieb und hat Schnellfeuer gegen Abfangjäger und Raketenbatterien. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  bs: {
    n: 'Kathedralschiff',
    ab: 'KS',
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
    lt: 'Das Kathedralschiff ist eine fliegende Festung voller Gebete und Breitseiten.\n\nSo funktioniert es: Es fliegt mit dem Warp-Antrieb, schlägt hart zu und hält viel aus. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen es.',
  },
  // Issues #58 and #59. Not in version 1; the classic values (owner,
  // 2026-11-12). Every ship has rapid fire 5 against the probe (battle.ts).
  bc: {
    n: 'Jagdkreuzer',
    ab: 'JK',
    cost: [30000, 40000, 15000],
    atk: 700,
    sh: 400,
    cargo: 750,
    speed: 10000,
    fuel: 250,
    drive: 'hdrive',
    req: { b: { yard: 8 }, r: { laser: 12, hyper: 5, hdrive: 5 } },
    rf: { sc: 3, lc: 3, hf: 4, cr: 4, bs: 7 },
    ds: 'Schnell und stark gegen Frachtläufer, Lastbarken, Fregatten und Kathedralschiffe.',
    lt: 'Der Jagdkreuzer ist ein Raubtier, gebaut, um feindliche Verbände zu zerschneiden.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb und hat Schnellfeuer gegen Frachtläufer, Lastbarken, Sturmjäger, Fregatten und Kathedralschiffe. Vernichter und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  dr: {
    n: 'Vernichter',
    ab: 'VN',
    cost: [60000, 50000, 15000],
    atk: 2000,
    sh: 500,
    cargo: 2000,
    speed: 5000,
    fuel: 1000,
    drive: 'hdrive',
    req: { b: { yard: 9 }, r: { hdrive: 6, hyper: 5 } },
    rf: { ll: 10, bc: 2 },
    ds: 'Schweres Kriegsschiff – stark gegen Lichtlanzen und Jagdkreuzer.',
    lt: 'Der Vernichter ist ein gewaltiger Rumpf voller Geschütze, gebaut, um Bollwerke zu brechen.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb und hat Schnellfeuer gegen Lichtlanzen und Jagdkreuzer. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  // Issue #57, classic before the update of 2019-12-13 (owner, 2026-11-12):
  // Impulstriebwerk, from Hyperraumantrieb 8 the Hyperraumantrieb.
  bb: {
    n: 'Belagerungsbomber',
    ab: 'BB',
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
    ds: 'Stark gegen Raketenbatterien, Lichtlanzen und Ionenlanzen; fliegt ab Warp-Antrieb 8 mit dem Warp-Antrieb.',
    lt: 'Der Belagerungsbomber verwandelt Verteidigungsstellungen in glühende Krater.\n\nSo funktioniert es: Er hat Schnellfeuer gegen Raketenbatterien, Lichtlanzen, Schwere Lichtlanzen und Ionenlanzen. Er fliegt mit dem Plasma-Impulsantrieb und, ist der Warp-Antrieb weit genug erforscht, mit diesem. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  // Issue #60, classic values (owner, 2026-11-12). Its 1,250 against the probe
  // and the Solarsatellit replace the general 5 of rapid() in battle.ts. None
  // against the Plasmawerfer and the shield domes (#50).
  dstar: {
    n: 'Weltenbrecher',
    ab: 'WB',
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
    ds: 'Gewaltige Kampfstation; zerstört fast alles mit Schnellfeuer.',
    lt: 'Der Weltenbrecher ist eine Festung von der Größe eines Mondes.\n\nSo funktioniert es: Er hat Schnellfeuer gegen jedes andere Schiff und jede Verteidigung außer Plasmabatterie und Schutzdomen; niemand hat Schnellfeuer gegen ihn. Er ist das langsamste fliegende Schiff und bremst seine Flotte, braucht aber kaum Treibstoff.',
  },
  probe: {
    n: 'Spähschädel',
    ab: 'SP',
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
    lt: 'Der Spähschädel fliegt lautlos zu fremden Welten und berichtet, was er sieht.\n\nSo funktioniert es: Er ist das schnellste Schiff, trägt keine Fracht, und nur Spähschädel fliegen zur Auspex-Erkundung. Je mehr du schickst, desto mehr verrät der Bericht. Fast jedes Schiff hat Schnellfeuer gegen ihn.',
  },
  sat: {
    n: 'Sonnenreliquiar',
    ab: 'SR',
    cost: [0, 2000, 500],
    atk: 1,
    sh: 1,
    cargo: 0,
    speed: 0,
    fuel: 0,
    drive: 'comb',
    req: { b: { yard: 1 } },
    ds: 'Liefert Energie, je wärmer der Planet, desto mehr. Kann nicht fliegen.',
    lt: 'Das Sonnenreliquiar ist ein geweihter Spiegel, der Sternenlicht als Energie zur Welt sendet.\n\nSo funktioniert es: Jedes liefert Energie für seinen Planeten, umso mehr, je heißer dieser ist. Es fliegt nie, kämpft aber bei einem Angriff mit und wird danach nicht wieder aufgebaut. Fast jedes Schiff hat Schnellfeuer gegen es.',
  },
};

export const DEF: Record<string, DefenseDef> = {
  rl: {
    n: 'Raketenbatterie',
    ab: 'RB',
    cost: [2000, 0, 0],
    atk: 80,
    sh: 20,
    req: {
      b: {
        yard: 1,
      },
    },
    lt: 'Die Raketenbatterie ist die billigste Wehr eines Planeten.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Fregatten, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  ll: {
    n: 'Lichtlanze',
    ab: 'LI',
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
    lt: 'Die Lichtlanze bündelt Licht zu einem sengenden Strahl.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Vernichter, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  hl: {
    n: 'Schwere Lichtlanze',
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
    lt: 'Die Schwere Lichtlanze durchschlägt Schilde, an denen leichtere Lanzen verglühen.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  gauss: {
    n: 'Massebeschleuniger',
    ab: 'MB',
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
    lt: 'Der Massebeschleuniger schleudert Adamantgeschosse, an denen selbst schwere Rümpfe bersten.\n\nSo funktioniert es: Er verteidigt nur seinen Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  // Issue #50. Not in version 1; the classic values (owner, 2026-11-12).
  // No unit has rapid fire against these four, and they have none.
  ionc: {
    n: 'Ionenlanze',
    ab: 'IN',
    cost: [2000, 6000, 0],
    atk: 150,
    sh: 500,
    req: { b: { yard: 4 }, r: { ion: 4 } },
    ds: 'Geschütz mit starkem Schild, das viele Treffer einsteckt.',
    lt: 'Die Ionenlanze speist geladene Teilchen in ein mächtiges Schildfeld.\n\nSo funktioniert es: Ihr Angriff ist schwach, ihr Schild stark: Schwache Schüsse prallen an ihm ab. Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  pt: {
    n: 'Plasmabatterie',
    ab: 'PA',
    cost: [50000, 50000, 30000],
    atk: 3000,
    sh: 300,
    req: { b: { yard: 8 }, r: { plasma: 7 } },
    ds: 'Die stärkste Waffe der Verteidigung: feuert Plasma mit gewaltiger Wucht.',
    lt: 'Die Plasmabatterie schleudert gebändigte Sternenglut.\n\nSo funktioniert es: Sie hat den stärksten Angriff aller Verteidigungsanlagen und verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Niemand hat Schnellfeuer gegen sie.',
  },
  ssd: {
    n: 'Kleiner Schutzdom',
    ab: 'SD',
    cost: [10000, 10000, 0],
    atk: 1,
    sh: 2000,
    req: { b: { yard: 1 }, r: { shield: 2 } },
    once: true,
    ds: 'Kuppel mit starkem Schild über dem Planeten; schwache Schüsse prallen ab. Nur eine pro Planet.',
    lt: 'Der Kleine Schutzdom wölbt ein flimmerndes Schildfeld über den Planeten.\n\nSo funktioniert es: Jeder Planet trägt nur einen, auch ein bestellter zählt. Er feuert kaum, doch schwache Schüsse prallen an seinem Schild ab, und weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer für andere ab. Zerstört wird er oft wieder errichtet.',
  },
  lsd: {
    n: 'Großer Schutzdom',
    ab: 'GD',
    cost: [50000, 50000, 0],
    atk: 1,
    sh: 10000,
    req: { b: { yard: 6 }, r: { shield: 6 } },
    once: true,
    ds: 'Die größere Kuppel mit fünffachem Schild; nur starke Schüsse dringen durch. Nur eine pro Planet.',
    lt: 'Der Große Schutzdom spannt ein Schildfeld, durch das nur schwere Waffen dringen.\n\nSo funktioniert es: Jeder Planet trägt nur einen, auch ein bestellter zählt. Er feuert kaum, doch sein Schild ist weit stärker als der kleine, und weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer für andere ab. Zerstört wird er oft wieder errichtet.',
  },
};

export const UNIT: Record<string, UnitDef> = { ...SHIPS, ...DEF };

export const DRIVE_BONUS: Record<DriveKey, number> = {
  comb: 0.1,
  impulse: 0.2,
  hdrive: 0.3,
};

export const MISSION = {
  attack: 'Sturmangriff',
  transport: 'Versorgungsflug',
  spy: 'Auspex-Erkundung',
  colonize: 'Landnahme',
  deploy: 'Verlegung',
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
