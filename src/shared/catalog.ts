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
    lt: 'Tief unter der Kruste fressen sich Bohrtürme in die Adern des Planeten und reißen Adamant ans Licht, das Fundament jedes Bauwerks und jedes Rumpfes. Jede weitere Stufe treibt die Schächte tiefer und steigert die Förderung, aber auch den Hunger nach Energie. Reicht die Energie des Planeten nicht, stocken alle seine Minen gleichermaßen.',
  },
  crystal: {
    n: 'Psikristall-Steinbruch',
    ab: 'PS',
    cost: [48, 24, 0],
    f: 1.6,
    ds: 'Baut Psikristall ab – nötig für Elektronik und Forschung.',
    lt: 'In den Steinbrüchen schlagen Arbeitskolonnen Psikristall aus dem Fels, dessen Gitter Ströme und Gedanken gleichermaßen leitet; ohne ihn schweigen Scholarien und Kogitatoren. Jede weitere Stufe vergrößert den Abbau, verlangt aber auch mehr Energie.',
  },
  deut: {
    n: 'Promethium-Raffinerie',
    ab: 'PR',
    cost: [225, 75, 0],
    f: 1.5,
    ds: 'Gewinnt Promethium. Kältere Planeten produzieren mehr.',
    lt: 'Die Raffinerie destilliert Promethium, den heiligen Brennstoff, der die Triebwerke jeder Flotte speist und im Fusionssanktum verbrannt wird. Auf kalten Welten läuft sie ergiebiger als auf heißen. Jede weitere Stufe steigert den Ausstoß, verschlingt aber mehr Energie als eine Adamant-Tiefbohrung oder ein Psikristall-Steinbruch gleicher Stufe.',
  },
  solar: {
    n: 'Sonnenkathedrale',
    ab: 'SK',
    cost: [75, 30, 0],
    f: 1.5,
    ds: 'Liefert Energie für die Minen.',
    lt: 'Unter gewaltigen Spiegelgewölben fängt die Sonnenkathedrale das Licht des Sterns und wandelt es in Energie für die Minen des Planeten. Jede weitere Stufe liefert mehr Energie. Reicht sie nicht, fördern alle Minen nur noch einen Teil dessen, was sie könnten.',
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
    lt: 'Im Herzen des Sanktums brennt Promethium in gebändigter Glut und speist die Minen des Planeten mit Energie. Jede weitere Stufe liefert mehr Energie und verbrennt mehr Promethium, und jede Stufe der Machina-Energetik facht die Glut weiter an. Ist der Promethium-Vorrat erschöpft, drosselt sich das Sanktum von selbst, bis es nur noch verbrennt, was die Raffinerie des Planeten nachliefert.',
  },
  robot: {
    n: 'Servitorenschmiede',
    ab: 'SF',
    cost: [400, 120, 200],
    f: 2,
    ds: 'Verkürzt die Bauzeit von Gebäuden.',
    lt: 'In der Servitorenschmiede werden Arbeitsservitoren aus Fleisch und Stahl gefügt, die ohne Rast an den Bauwerken des Planeten schuften. Jede weitere Stufe verkürzt die Bauzeit aller Gebäude auf diesem Planeten.',
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
    lt: 'In der Schwarmhalle wimmeln zahllose winzige Machina-Konstrukte, die Stahl und Stein schneller formen als jede Hand. Jede Stufe halbiert erneut die Bauzeit von Gebäuden, Schiffen und Verteidigung auf diesem Planeten. Solange die Halle ausgebaut wird, nimmt die Orbitale Schiffsschmiede keine Aufträge an, und der Ausbau ist erst möglich, wenn die Schmiede alle Aufträge abgearbeitet hat.',
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
    lt: 'In den Docks der Schiffsschmiede werden Rümpfe unter dem Kreischen der Schweißbrenner gefügt; hier entstehen alle Schiffe und Verteidigungsanlagen des Planeten. Jede weitere Stufe beschleunigt die Fertigung und erschließt größere Baumuster. Solange die Schmiede selbst ausgebaut wird, nimmt sie keine Aufträge an, und ihr Ausbau ist erst möglich, wenn alle Aufträge abgearbeitet sind.',
  },
  lab: {
    n: 'Scholarium',
    ab: 'SC',
    cost: [200, 400, 200],
    f: 2,
    ds: 'Ermöglicht und beschleunigt Forschung.',
    lt: 'Im Scholarium brüten Gelehrte über verbotenen Schriften und ringen den Sternen ihr Wissen ab; nur auf einem Planeten mit Scholarium kann eine Forschung beginnen. Jede weitere Stufe verkürzt die Forschungszeit und öffnet den Weg zu tieferen Lehren. Während das Scholarium ausgebaut wird, beginnt hier keine Forschung, und solange eine Forschung läuft, kann es nicht ausgebaut werden.',
  },
  smetal: {
    n: 'Adamant-Gewölbe',
    ab: 'AG',
    cost: [1000, 0, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Adamant.',
    lt: 'Unter gepanzerten Kuppeln lagert das Adamant des Planeten, bewacht und gezählt bis zum letzten Barren. Jede weitere Stufe erweitert das Gewölbe. Ist es voll, ruht die Förderung; was Flotten darüber hinaus anliefern, geht nicht verloren.',
  },
  scrystal: {
    n: 'Psikristall-Reliquiar',
    ab: 'RQ',
    cost: [1000, 500, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Psikristall.',
    lt: 'Im Reliquiar ruht der Psikristall des Planeten in geweihten Schreinen, abgeschirmt gegen sein eigenes Flüstern. Jede weitere Stufe erweitert das Reliquiar. Ist es voll, ruht der Abbau; was Flotten darüber hinaus anliefern, geht nicht verloren.',
  },
  sdeut: {
    n: 'Promethium-Zisterne',
    ab: 'PZ',
    cost: [1000, 1000, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Promethium.',
    lt: 'In der Zisterne schwappt das Promethium des Planeten, ein See aus Brennstoff, den der kleinste Funke in ein Inferno verwandeln könnte. Jede weitere Stufe erweitert die Zisterne. Ist sie voll, ruht die Raffinerie; was Flotten darüber hinaus anliefern, geht nicht verloren.',
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
    lt: 'Die Machina-Energetik lehrt, die Ströme der Reaktoren zu zähmen und in die Leitungen der Maschinen zu zwingen. Sie ist das Fundament vieler weiterer Lehren, von den Antrieben bis zu den Waffen. Jede weitere Stufe steigert die Energie, die ein Fusionssanktum auf jedem deiner Planeten gewinnt.',
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
    lt: 'Gebündeltes Licht, heiß genug, um Panzerstahl zu schneiden: Die Lichtlanzen-Lehre ist Grundlage der Lichtlanzen, der Fregatten und der Ionen-Lehre. Höhere Stufen öffnen den Weg zu schwereren Waffen bis hin zum Jagdkreuzer.',
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
    lt: 'In den Brennkammern zündet Promethium in gebändigten Stößen und schiebt leichte Rümpfe durch die Leere. Jede Stufe macht Frachtläufer, Lastbarken, Abfangjäger und Spähschädel schneller.',
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
    lt: 'Der Plasma-Impulsantrieb stößt gebündelte Glut aus und trägt schwerere Rümpfe als jede Brennkammer. Jede Stufe macht Kolonistenarchen, Sturmjäger und Fregatten schneller, ebenso Belagerungsbomber, bis diese auf den Warp-Antrieb umsteigen.',
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
    lt: 'Die Warp-Theorie ergründet den Raum hinter dem Raum, ein Reich, in das kein Verstand ungeschützt blicken sollte. Sie selbst bewegt kein Schiff, doch ohne sie gibt es weder Warp-Antrieb noch Jagdkreuzer, Vernichter, Weltenbrecher oder das Sternennetz der Gelehrten.',
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
    lt: 'Der Warp-Antrieb reißt schwere Schiffe durch den Raum hinter dem Raum. Jede Stufe macht Kathedralschiffe, Jagdkreuzer, Vernichter und Weltenbrecher schneller. Ist er weit genug erforscht, steigen auch die Belagerungsbomber auf ihn um.',
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
    lt: 'Die Auspex-Lehre schärft die Sinne der Spähschädel und lehrt, fremde Augen am eigenen Himmel zu erkennen. Je weiter du deinem Ziel in dieser Lehre voraus bist, desto mehr verrät ein Auspex-Bericht und desto seltener werden deine Spähschädel abgeschossen. Ist das Ziel dir voraus, kehrt es sich um.',
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
    lt: 'Kogitatoren berechnen Kurse, Treibstoff und Ziele, damit kein Befehlshaber den Überblick über seine Flotten verliert. Jede Stufe erlaubt eine weitere Flotte, die gleichzeitig unterwegs sein darf.',
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
    lt: 'Jede Waffe wird gesalbt, geweiht und mit Zielrunen versehen, bevor sie ins Feld zieht. Jede Stufe verstärkt im Kampf den Angriff aller deiner Schiffe und Verteidigungsanlagen.',
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
    lt: 'Flimmernde Refraktionsfelder lenken feindliches Feuer ab, bevor es den Rumpf erreicht, und erneuern sich in jeder Kampfrunde. Jede Stufe stärkt die Schilde aller deiner Schiffe und Verteidigungsanlagen.',
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
    lt: 'Schicht um Schicht wird Adamant auf die Rümpfe geschmiedet, bis sie Treffer schlucken, die andere zerreißen. Jede Stufe erhöht die Strukturpunkte aller deiner Schiffe und Verteidigungsanlagen.',
  },
  // Issue #49. Not in version 1; the classic values (owner, 2026-11-12).
  ion: {
    n: 'Ionen-Lehre',
    ab: 'IL',
    cost: [1000, 300, 100],
    req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
    ds: 'Beschleunigte Ionen – Basis für Ionenwaffen.',
    lt: 'Die Ionen-Lehre zwingt geladene Teilchen in gebündelte Ströme, ein gefährliches Wissen, das schon manchen Gelehrten verbrannt hat. Auf ihr beruht die Ionenlanze, und sie ist der nächste Schritt auf dem Weg zur Plasma-Lehre.',
  },
  plasma: {
    n: 'Plasma-Lehre',
    ab: 'PL',
    cost: [2000, 4000, 1000],
    req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
    ds: 'Gebändigtes Plasma – Basis für Plasmawaffen.',
    lt: 'Die Plasma-Lehre bändigt Materie, die heißer brennt als das Herz eines Sterns, und lehrt, sie als Waffe zu schleudern. Auf ihr beruhen die Belagerungsbomber und die Plasmabatterie.',
  },
  graviton: {
    n: 'Gravitonen-Mysterium',
    ab: 'GM',
    cost: [0, 0, 0],
    energy: { base: 300000, f: 3 },
    req: { b: { lab: 12 } },
    ds: 'Kostet keine Rohstoffe, braucht aber eine gewaltige Energieproduktion.',
    lt: 'Das Gravitonen-Mysterium ergründet die Kraft, die Welten zusammenhält und Sterne verschlingt. Der Planet, auf dem die Forschung beginnt, muss die geforderte Energie selbst erzeugen, aus Sonnenkathedrale, Sonnenreliquiaren oder Fusionssanktum; verbraucht wird sie nicht. Jede weitere Stufe verlangt weit mehr davon. Erst wer es ergründet hat, kann einen Weltenbrecher bauen.',
  },
  ifn: {
    n: 'Sternennetz der Gelehrten',
    ab: 'SN',
    cost: [240000, 400000, 160000],
    req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
    ds: 'Vernetzt pro Stufe ein weiteres Scholarium deiner Planeten.',
    lt: 'Das Sternennetz verbindet die Scholarien deiner Welten über die Leere hinweg zu einem einzigen denkenden Chor. Jede Stufe bindet ein weiteres Scholarium in eine Forschung ein, stets die höchsten deiner anderen Planeten, sofern sie selbst die geforderte Scholariumsstufe erreichen und nicht gerade ausgebaut werden. Ihre Stufen zählen zusammen und verkürzen die Forschungszeit.',
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
    lt: 'Der Frachtläufer ist ein schmuckloser Lastesel, der Adamant, Psikristall und Promethium zwischen den Welten trägt. Mehr Läufer tragen mehr Fracht, nach einem gewonnenen Angriff auch mehr Beute. Sturmjäger, Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Die Lastbarke ist ein gewaltiger Frachtrumpf, gebaut, um ganze Kolonien zu versorgen und reiche Beute heimzubringen. Sie trägt ein Vielfaches eines Frachtläufers. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Die Kolonistenarche trägt Siedler, Saatgut und Werkzeug zu einer freien Welt. Bei der Landnahme geht eine Arche in der neuen Kolonie auf, und die Flotte entlädt dort ihre Fracht; die Kolonie beginnt ohne Gebäude. Ist der Platz bei der Ankunft schon besetzt, kehrt die Flotte um.',
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
    lt: 'Abfangjäger sind billig, zahlreich und entbehrlich; ihre Piloten wissen, dass nur wenige heimkehren. In Schwärmen binden sie feindliches Feuer, doch Fregatten und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Der Sturmjäger trägt schwerere Panzerung und Waffen als der Abfangjäger und fliegt mit dem Plasma-Impulsantrieb. Er ist der Schrecken ungeschützter Konvois und hat Schnellfeuer gegen Frachtläufer. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Die Fregatte ist das schnelle Rückgrat jeder Flotte, wendig, gut bewaffnet und gefürchtet von Jägerpiloten. Sie hat Schnellfeuer gegen Abfangjäger und Raketenbatterien. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Das Kathedralschiff ist eine fliegende Festung, deren Türme Gebete und Breitseiten gleichermaßen in die Leere tragen. Es fliegt mit dem Warp-Antrieb und hält Treffer aus, an denen kleinere Schiffe zerbrechen. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen es.',
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
    lt: 'Der Jagdkreuzer ist ein Raubtier unter den Kriegsschiffen, gebaut, um feindliche Verbände zu zerschneiden. Er hat Schnellfeuer gegen Frachtläufer, Lastbarken, Sturmjäger, Fregatten und Kathedralschiffe. Vernichter und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Der Vernichter ist ein langsamer, gewaltiger Rumpf voller Geschütze, gebaut, um Bollwerke zu brechen. Er hat Schnellfeuer gegen Lichtlanzen und Jagdkreuzer.',
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
    lt: 'Der Belagerungsbomber trägt Plasmaladungen, die Verteidigungsstellungen in glühende Krater verwandeln. Er hat Schnellfeuer gegen Raketenbatterien, Lichtlanzen, Schwere Lichtlanzen und Ionenlanzen. Er fliegt mit dem Plasma-Impulsantrieb, bis der Warp-Antrieb weit genug erforscht ist, und dann mit diesem.',
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
    lt: 'Der Weltenbrecher ist eine Festung von der Größe eines Mondes, deren Geschütze ganze Flotten in Asche legen. Er hat Schnellfeuer gegen fast alles, was fliegt oder am Boden steht, und keine Einheit hat Schnellfeuer gegen ihn. Er kriecht mit dem Warp-Antrieb langsamer durch die Leere als jedes andere fliegende Schiff, und erst das Gravitonen-Mysterium erlaubt seinen Bau.',
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
    lt: 'Der Spähschädel ist ein verdrahteter Schädel mit Auspex-Linsen, der lautlos zu fremden Welten fliegt und berichtet, was er sieht. Je mehr Spähschädel du schickst und je weiter deine Auspex-Lehre der des Ziels voraus ist, desto mehr verrät der Auspex-Bericht. Schiffe über dem Ziel können sie abschießen, und im Kampf hat fast jedes Schiff Schnellfeuer gegen sie.',
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
    lt: 'Das Sonnenreliquiar ist ein geweihter Spiegel im Orbit, der das Licht des Sterns einfängt und als Energie zur Welt hinabsendet. Je heißer der Planet, desto mehr Energie liefert jedes Reliquiar; fliegen kann es nicht. Wird der Planet angegriffen, kämpft es mit, doch fast jedes Schiff hat Schnellfeuer gegen es.',
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
    lt: 'Die Raketenbatterie ist die einfachste Wehr eines Planeten, billig und in großer Zahl ein zähes Hindernis. Fregatten, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie. Wie jede Verteidigung bleibt sie am Boden; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
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
    lt: 'Die Lichtlanze bündelt Licht zu einem sengenden Strahl und ist die erste ernsthafte Wehr eines Planeten. Vernichter, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
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
    lt: 'Die Schwere Lichtlanze schleudert einen Strahl, der Schilde durchschlägt, an denen leichtere Lanzen verglühen. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
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
    lt: 'Der Massebeschleuniger schleudert Adamantgeschosse mit solcher Wucht, dass selbst schwere Rümpfe bersten; er ist das Rückgrat jeder Planetenwehr gegen schwere Flotten. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
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
    lt: 'Die Ionenlanze speist einen Strom geladener Teilchen in ein mächtiges Schildfeld und steht noch, wenn leichtere Wehren längst verglüht sind. Ihr Angriff ist bescheiden, doch sie steckt viele Treffer ein. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
  },
  pt: {
    n: 'Plasmabatterie',
    ab: 'PA',
    cost: [50000, 50000, 30000],
    atk: 3000,
    sh: 300,
    req: { b: { yard: 8 }, r: { plasma: 7 } },
    ds: 'Die stärkste Waffe der Verteidigung: feuert Plasma mit gewaltiger Wucht.',
    lt: 'Die Plasmabatterie schleudert Ladungen gebändigter Sternenglut, die kleinere Schiffe mit einem Schuss zerschmelzen. Sie ist die stärkste Waffe, die ein Planet aufbieten kann, und keine Einheit hat Schnellfeuer gegen sie. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt.',
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
    lt: 'Der Kleine Schutzdom wölbt ein flimmerndes Schildfeld über den Planeten, an dem schwache Schüsse wirkungslos verpuffen. Er selbst feuert kaum, zieht aber Feuer auf sich, das sonst andere Einheiten träfe. Jeder Planet trägt höchstens einen; nach einem Kampf wird er mit etwas Glück wieder errichtet.',
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
    lt: 'Der Große Schutzdom spannt ein Schildfeld von gewaltiger Stärke über den Planeten, durch das nur noch schwere Waffen dringen. Er selbst feuert kaum, zieht aber Feuer auf sich, das sonst andere Einheiten träfe. Jeder Planet trägt höchstens einen, neben einem Kleinen Schutzdom; nach einem Kampf wird er mit etwas Glück wieder errichtet.',
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
