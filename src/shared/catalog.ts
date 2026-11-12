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
    lt: 'Tief unter der Kruste fressen sich Bohrtürme in die Adern des Planeten und reißen Adamant ans Licht, das Fundament jedes Bauwerks und jedes Rumpfes.\n\nSo funktioniert es: Die Tiefbohrung fördert Adamant nur auf diesem Planeten, und jede weitere Stufe steigert die Förderung pro Stunde stärker als die vorige. Mit jeder Stufe wächst aber auch ihr Energiebedarf. Liefert der Planet weniger Energie, als seine Minen verlangen, fördern alle Minen im selben Verhältnis weniger. Auch ohne Tiefbohrung liefert jeder Planet eine kleine Grundmenge Adamant, die keine Energie braucht. Auf der Rohstoffseite stellst du ihren Anteil ein; ein kleinerer Anteil senkt Förderung und Energiebedarf gemeinsam. Ist das Adamant-Gewölbe voll, ruht die Förderung.',
  },
  crystal: {
    n: 'Psikristall-Steinbruch',
    ab: 'PS',
    cost: [48, 24, 0],
    f: 1.6,
    ds: 'Baut Psikristall ab – nötig für Elektronik und Forschung.',
    lt: 'In den Steinbrüchen schlagen Arbeitskolonnen Psikristall aus dem Fels, dessen Gitter Ströme und Gedanken gleichermaßen leitet.\n\nSo funktioniert es: Der Steinbruch baut Psikristall nur auf diesem Planeten ab; jede weitere Stufe steigert den Abbau pro Stunde stärker als die vorige und ebenso seinen Energiebedarf. Fehlt Energie, fördern alle Minen des Planeten im selben Verhältnis weniger. Eine kleine Grundmenge Psikristall kommt auch ohne Steinbruch und ohne Energie. Seinen Anteil stellst du auf der Rohstoffseite ein, und ist das Psikristall-Reliquiar voll, ruht der Abbau.',
  },
  deut: {
    n: 'Promethium-Raffinerie',
    ab: 'PR',
    cost: [225, 75, 0],
    f: 1.5,
    ds: 'Gewinnt Promethium. Kältere Planeten produzieren mehr.',
    lt: 'Die Raffinerie destilliert Promethium, den heiligen Brennstoff, der jede Flotte antreibt und im Fusionssanktum verbrannt wird.\n\nSo funktioniert es: Die Raffinerie gewinnt Promethium nur auf diesem Planeten; jede weitere Stufe steigert den Ausstoß pro Stunde stärker als die vorige. Auf kalten Planeten läuft sie ergiebiger als auf heißen, und sie braucht mehr Energie als eine Tiefbohrung oder ein Steinbruch gleicher Stufe. Fehlt Energie, fördern alle Minen im selben Verhältnis weniger. Ohne Raffinerie gewinnt ein Planet kein Promethium, und ein Fusionssanktum auf demselben Planeten verbrennt einen Teil davon. Ihren Anteil stellst du auf der Rohstoffseite ein, und ist die Promethium-Zisterne voll, ruht die Raffinerie.',
  },
  solar: {
    n: 'Sonnenkathedrale',
    ab: 'SK',
    cost: [75, 30, 0],
    f: 1.5,
    ds: 'Liefert Energie für die Minen.',
    lt: 'Unter gewaltigen Spiegelgewölben fängt die Sonnenkathedrale das Licht des Sterns und wandelt es in Energie.\n\nSo funktioniert es: Die Kathedrale liefert Energie nur für diesen Planeten, und jede weitere Stufe liefert mehr davon als die vorige; die Temperatur des Planeten spielt für sie keine Rolle. Die Energie aller Erzeuger des Planeten wird zusammengezählt, und reicht sie nicht für den Bedarf der Minen, fördern alle Minen im selben Verhältnis weniger. Ihren Anteil stellst du auf der Rohstoffseite ein. Überschüssige Energie wird nicht gespeichert.',
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
    lt: 'Im Herzen des Sanktums brennt Promethium in gebändigter Glut und speist die Minen des Planeten mit Energie.\n\nSo funktioniert es: Das Sanktum liefert Energie nur für diesen Planeten und verbrennt dafür ständig Promethium aus dessen Vorrat. Jede weitere Stufe liefert mehr Energie und verbrennt mehr Promethium, und jede Stufe der Machina-Energetik steigert seine Energie zusätzlich. Mit seinem Anteil auf der Rohstoffseite senkst du Energie und Verbrauch gemeinsam. Ist der Promethium-Vorrat leer, drosselt sich das Sanktum von selbst so weit, dass es nur noch verbrennt, was der Planet gerade an Promethium gewinnt; der Vorrat bleibt dann leer, sinkt aber nicht weiter. Seine Energie zählt auch für das Gravitonen-Mysterium.',
  },
  robot: {
    n: 'Servitorenschmiede',
    ab: 'SF',
    cost: [400, 120, 200],
    f: 2,
    ds: 'Verkürzt die Bauzeit von Gebäuden.',
    lt: 'In der Servitorenschmiede werden Arbeitsservitoren aus Fleisch und Stahl gefügt, die ohne Rast an den Bauwerken des Planeten schuften.\n\nSo funktioniert es: Jede Stufe verkürzt die Bauzeit aller Gebäude, deren Ausbau auf diesem Planeten beginnt; jede weitere Stufe bringt dabei etwas weniger zusätzlichen Gewinn als die vorige. Auf Schiffe, Verteidigung und Forschung wirkt sie nicht. Sie ist Voraussetzung der Orbitalen Schiffsschmiede und der Machina-Schwarmhalle.',
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
    lt: 'In der Schwarmhalle wimmeln zahllose winzige Machina-Konstrukte, die Stahl und Stein schneller formen als jede Hand.\n\nSo funktioniert es: Jede Stufe verkürzt auf diesem Planeten die Bauzeit der Gebäude und die der Schiffe und Verteidigungsanlagen erneut kräftig, zusätzlich zur Servitorenschmiede und zur Orbitalen Schiffsschmiede. Forschung beschleunigt sie nicht. Solange die Halle ausgebaut wird, nimmt die Schiffsschmiede dieses Planeten keine neuen Aufträge an, und ihr Ausbau ist erst möglich, wenn die Schiffsschmiede alle Aufträge abgearbeitet hat.',
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
    lt: 'In den Docks der Schiffsschmiede werden Rümpfe unter dem Kreischen der Schweißbrenner gefügt; hier entstehen alle Schiffe und Verteidigungsanlagen des Planeten.\n\nSo funktioniert es: Die Schmiede arbeitet ihre Aufträge nacheinander ab, Einheit für Einheit, und ihre Bauliste fasst nur eine begrenzte Zahl von Aufträgen. Jede weitere Stufe verkürzt die Bauzeit aller Schiffe und Verteidigungsanlagen, die auf diesem Planeten in Auftrag gehen, und höhere Stufen erschließen größere Baumuster. Solange die Schmiede selbst ausgebaut wird, nimmt sie keine neuen Aufträge an, und ihr Ausbau ist erst möglich, wenn alle Aufträge abgearbeitet sind.',
  },
  lab: {
    n: 'Scholarium',
    ab: 'SC',
    cost: [200, 400, 200],
    f: 2,
    ds: 'Ermöglicht und beschleunigt Forschung.',
    lt: 'Im Scholarium brüten Gelehrte über verbotenen Schriften und ringen den Sternen ihr Wissen ab.\n\nSo funktioniert es: Eine Forschung kann nur auf einem Planeten mit Scholarium beginnen und wird mit den Rohstoffen dieses Planeten bezahlt; du forschst immer nur an einer Lehre zugleich, und ihr Wissen gilt danach für alle deine Planeten. Jede Stufe verkürzt die Dauer jeder Forschung, die auf diesem Planeten beginnt, und mit dem Sternennetz der Gelehrten zählen die Stufen verbundener Scholarien anderer Planeten hinzu. Höhere Stufen erschließen tiefere Lehren. Während das Scholarium ausgebaut wird, kann hier keine Forschung beginnen, und solange eine deiner Forschungen läuft, kann kein Scholarium ausgebaut werden.',
  },
  smetal: {
    n: 'Adamant-Gewölbe',
    ab: 'AG',
    cost: [1000, 0, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Adamant.',
    lt: 'Unter gepanzerten Kuppeln lagert das Adamant des Planeten, bewacht und gezählt bis zum letzten Barren.\n\nSo funktioniert es: Das Gewölbe bestimmt, wie viel Adamant dieser Planet aus eigener Förderung ansammeln kann; schon ohne Gewölbe gibt es ein kleines Grundlager. Jede weitere Stufe vergrößert es, und jede mehr als die vorige. Ist es voll, ruht die Förderung von Adamant. Was Flotten, Beute oder Belohnungen darüber hinaus bringen, bleibt erhalten.',
  },
  scrystal: {
    n: 'Psikristall-Reliquiar',
    ab: 'RQ',
    cost: [1000, 500, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Psikristall.',
    lt: 'Im Reliquiar ruht der Psikristall des Planeten in geweihten Schreinen, abgeschirmt gegen sein eigenes Flüstern.\n\nSo funktioniert es: Das Reliquiar bestimmt, wie viel Psikristall dieser Planet aus eigener Förderung ansammeln kann; schon ohne Reliquiar gibt es ein kleines Grundlager. Jede weitere Stufe vergrößert es, und jede mehr als die vorige. Ist es voll, ruht der Abbau von Psikristall. Was Flotten, Beute oder Belohnungen darüber hinaus bringen, bleibt erhalten.',
  },
  sdeut: {
    n: 'Promethium-Zisterne',
    ab: 'PZ',
    cost: [1000, 1000, 0],
    f: 2,
    ds: 'Erhöht die Lagerkapazität für Promethium.',
    lt: 'In der Zisterne schwappt das Promethium des Planeten, ein See aus Brennstoff, den der kleinste Funke in ein Inferno verwandeln könnte.\n\nSo funktioniert es: Die Zisterne bestimmt, wie viel Promethium dieser Planet aus eigener Förderung ansammeln kann; schon ohne Zisterne gibt es ein kleines Grundlager. Jede weitere Stufe vergrößert sie, und jede mehr als die vorige. Ist sie voll, ruht die Raffinerie. Was Flotten, Beute oder Belohnungen darüber hinaus bringen, bleibt erhalten, und ein Fusionssanktum zehrt auch dann weiter vom Vorrat.',
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
    lt: 'Die Machina-Energetik lehrt, die Ströme der Reaktoren zu zähmen und in die Leitungen der Maschinen zu zwingen.\n\nSo funktioniert es: Jede Stufe steigert die Energie jedes Fusionssanktums auf allen deinen Planeten, von dem Moment an, in dem die Forschung abgeschlossen ist. Auf Minen, Sonnenkathedralen und Sonnenreliquiare wirkt sie nicht. Sie ist Voraussetzung vieler weiterer Lehren, von der Promethium-Brennkammer über die Refraktionsfelder bis zur Plasma-Lehre, und des Fusionssanktums, der Lichtlanzen und des Massebeschleunigers.',
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
    lt: 'Gebündeltes Licht, heiß genug, um Panzerstahl zu schneiden.\n\nSo funktioniert es: Die Lehre selbst verändert keine Werte; sie erschließt Baupläne. Mit wachsender Stufe öffnet sie den Weg zur Lichtlanze, zur Fregatte, zur Ionen-Lehre, zur Schweren Lichtlanze, zur Plasma-Lehre und schließlich zum Jagdkreuzer.',
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
    lt: 'In den Brennkammern zündet Promethium in gebändigten Stößen und schiebt leichte Rümpfe durch die Leere.\n\nSo funktioniert es: Jede Stufe macht Frachtläufer, Lastbarken, Abfangjäger und Spähschädel schneller. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff, und ihr Tempo wird beim Start festgelegt. Den Treibstoff bestimmen Schiffe, Entfernung und gewählte Geschwindigkeit, nicht die Brennkammer. Sie ist Voraussetzung dieser Schiffe.',
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
    lt: 'Der Plasma-Impulsantrieb stößt gebündelte Glut aus und trägt schwerere Rümpfe als jede Brennkammer.\n\nSo funktioniert es: Jede Stufe macht Kolonistenarchen, Sturmjäger und Fregatten schneller, ebenso Belagerungsbomber, solange diese noch nicht auf den Warp-Antrieb umgestiegen sind. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff, und ihr Tempo wird beim Start festgelegt. Er ist Voraussetzung dieser Schiffe.',
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
    lt: 'Die Warp-Theorie ergründet den Raum hinter dem Raum, ein Reich, in das kein Verstand ungeschützt blicken sollte.\n\nSo funktioniert es: Die Theorie selbst bewegt kein Schiff und verändert keine Werte. Mit wachsender Stufe öffnet sie den Weg zum Warp-Antrieb, zu Jagdkreuzer, Vernichter und Weltenbrecher und zum Sternennetz der Gelehrten.',
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
    lt: 'Der Warp-Antrieb reißt schwere Schiffe durch den Raum hinter dem Raum.\n\nSo funktioniert es: Jede Stufe macht Kathedralschiffe, Jagdkreuzer, Vernichter und Weltenbrecher schneller. Ist er weit genug erforscht, steigen die Belagerungsbomber vom Plasma-Impulsantrieb auf ihn um und werden mit jeder weiteren Stufe ebenfalls schneller. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff, und ihr Tempo wird beim Start festgelegt. Er ist Voraussetzung von Kathedralschiff, Jagdkreuzer, Vernichter und Weltenbrecher.',
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
    lt: 'Die Auspex-Lehre schärft die Sinne der Spähschädel und lehrt, fremde Augen am eigenen Himmel zu erkennen.\n\nSo funktioniert es: Bei einer Auspex-Erkundung zählt, wie viele Spähschädel du schickst und wie weit deine Lehre der des Ziels voraus ist; ein Vorsprung wiegt mit jeder Stufe schwerer, ein Rückstand ebenso gegen dich. Der Bericht zeigt immer die Rohstoffe, bei besserem Ergebnis auch Schiffe, dann Verteidigung, Gebäude und zuletzt die Forschung. Je mehr Schiffe über dem Ziel stehen und je weiter das Ziel dir in dieser Lehre voraus ist, desto eher werden deine Spähschädel abgeschossen; jede Stufe Vorsprung senkt diese Gefahr deutlich. Das Ziel erfährt von jeder Erkundung.',
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
    lt: 'Kogitatoren berechnen Kurse, Treibstoff und Ziele, damit kein Befehlshaber den Überblick über seine Flotten verliert.\n\nSo funktioniert es: Jede Stufe erlaubt dir eine weitere Flotte, die gleichzeitig unterwegs sein darf, über alle deine Planeten zusammen; eine Flotte belegt ihren Platz vom Start bis zur Heimkehr. Sonnenreliquiare fliegen nie und belegen keinen. Sie ist Voraussetzung der Machina-Schwarmhalle und des Sternennetzes der Gelehrten.',
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
    lt: 'Jede Waffe wird gesalbt, geweiht und mit Zielrunen versehen, bevor sie ins Feld zieht.\n\nSo funktioniert es: Jede Stufe verstärkt im Kampf jeden Schuss aller deiner Schiffe und Verteidigungsanlagen um denselben Anteil ihres Grundwerts, im Sturmangriff wie in der Verteidigung. Es zählt dein Stand in dem Moment, in dem der Kampf stattfindet. Sie ist Voraussetzung des Massebeschleunigers.',
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
    lt: 'Flimmernde Refraktionsfelder lenken feindliches Feuer ab, bevor es den Rumpf erreicht.\n\nSo funktioniert es: Jede Stufe stärkt die Schilde aller deiner Schiffe und Verteidigungsanlagen im Kampf um denselben Anteil ihres Grundwerts. Schilde fangen Schaden ab, bevor er die Struktur trifft, und laden sich zu Beginn jeder Kampfrunde wieder voll auf. Ein Schuss, der schwächer ist als ein winziger Bruchteil des getroffenen Schildes, prallt wirkungslos ab. Die Lehre ist Voraussetzung der Warp-Theorie, des Massebeschleunigers und der Schutzdome.',
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
    lt: 'Schicht um Schicht wird Adamant auf die Rümpfe geschmiedet, bis sie Treffer schlucken, die andere zerreißen.\n\nSo funktioniert es: Jede Stufe erhöht die Struktur aller deiner Schiffe und Verteidigungsanlagen im Kampf um denselben Anteil ihres Grundwerts; dieser richtet sich nach dem Adamant und Psikristall, die eine Einheit kostet. Ist eine Einheit schwer beschädigt, kann sie nach jedem Treffer zufällig zerbersten, umso eher, je weniger Struktur ihr bleibt. Sie ist Voraussetzung des Sturmjägers.',
  },
  // Issue #49. Not in version 1; the classic values (owner, 2026-11-12).
  ion: {
    n: 'Ionen-Lehre',
    ab: 'IL',
    cost: [1000, 300, 100],
    req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
    ds: 'Beschleunigte Ionen – Basis für Ionenwaffen.',
    lt: 'Die Ionen-Lehre zwingt geladene Teilchen in gebündelte Ströme, ein gefährliches Wissen, das schon manchen Gelehrten verbrannt hat.\n\nSo funktioniert es: Die Lehre selbst verändert keine Werte. Sie öffnet den Weg zur Ionenlanze und ist der nächste Schritt zur Plasma-Lehre.',
  },
  plasma: {
    n: 'Plasma-Lehre',
    ab: 'PL',
    cost: [2000, 4000, 1000],
    req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
    ds: 'Gebändigtes Plasma – Basis für Plasmawaffen.',
    lt: 'Die Plasma-Lehre bändigt Materie, die heißer brennt als das Herz eines Sterns, und lehrt, sie als Waffe zu schleudern.\n\nSo funktioniert es: Die Lehre selbst verändert keine Werte und steigert keine Förderung. Sie öffnet den Weg zum Belagerungsbomber und mit höherer Stufe zur Plasmabatterie.',
  },
  graviton: {
    n: 'Gravitonen-Mysterium',
    ab: 'GM',
    cost: [0, 0, 0],
    energy: { base: 300000, f: 3 },
    req: { b: { lab: 12 } },
    ds: 'Kostet keine Rohstoffe, braucht aber eine gewaltige Energieproduktion.',
    lt: 'Das Gravitonen-Mysterium ergründet die Kraft, die Welten zusammenhält und Sterne verschlingt.\n\nSo funktioniert es: Die Forschung kostet keine Rohstoffe, doch der Planet, auf dem sie beginnt, muss in diesem Moment genug Energie erzeugen. Es zählt, was Sonnenkathedrale, Sonnenreliquiare und Fusionssanktum dort gerade liefern, nicht der Bedarf der Minen, und die Energie wird nicht verbraucht. Jede weitere Stufe verlangt ein Vielfaches mehr. Erst wer das Mysterium ergründet hat, kann einen Weltenbrecher bauen.',
  },
  ifn: {
    n: 'Sternennetz der Gelehrten',
    ab: 'SN',
    cost: [240000, 400000, 160000],
    req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
    ds: 'Vernetzt pro Stufe ein weiteres Scholarium deiner Planeten.',
    lt: 'Das Sternennetz verbindet die Scholarien deiner Welten über die Leere hinweg zu einem einzigen denkenden Chor.\n\nSo funktioniert es: Jede Stufe bindet ein weiteres Scholarium in jede Forschung ein, die du beginnst. Gewählt werden die höchsten Scholarien deiner anderen Planeten, die selbst die Scholariumsstufe erreichen, welche die Forschung verlangt, und nicht gerade ausgebaut werden. Ihre Stufen werden zur Stufe des Scholariums addiert, auf dem die Forschung beginnt, und verkürzen so ihre Dauer.',
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
    lt: 'Der Frachtläufer ist ein schmuckloser Lastesel, der Adamant, Psikristall und Promethium zwischen den Welten trägt.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer und verbraucht wenig Treibstoff. Sein Laderaum trägt Lieferungen, und nach einem gewonnenen Kampf nimmt die Flotte einen Teil jedes Rohstoffs des Ziels mit, so viel in die freien Laderäume passt. Er hat Schnellfeuer nur gegen Spähschädel und Sonnenreliquiare. Sturmjäger, Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn: Nach einem Schuss auf ihn dürfen sie mit einer gewissen Chance sofort erneut feuern.',
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
    lt: 'Die Lastbarke ist ein gewaltiger Frachtrumpf, gebaut, um ganze Kolonien zu versorgen und reiche Beute heimzubringen.\n\nSo funktioniert es: Sie fliegt mit der Promethium-Brennkammer, schneller als ein Frachtläufer, und trägt ein Vielfaches seiner Ladung, verbraucht dafür aber mehr Treibstoff. Ihr Laderaum zählt für Lieferungen und Beute. Sie hat Schnellfeuer nur gegen Spähschädel und Sonnenreliquiare; Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Die Kolonistenarche trägt Siedler, Saatgut und Werkzeug zu einer freien Welt.\n\nSo funktioniert es: Sie fliegt mit dem Plasma-Impulsantrieb. Mit dem Auftrag Landnahme fliegt die Flotte zu einer freien Position; bei der Ankunft geht eine Arche in der neuen Kolonie auf, die Flotte entlädt dort ihre ganze Fracht als ersten Vorrat, und die übrigen Schiffe kehren heim. Die Kolonie beginnt ohne Gebäude. Ist die Position bei der Ankunft schon besetzt, kehrt die Flotte mit Schiffen und Fracht um. Sie hat Schnellfeuer nur gegen Spähschädel und Sonnenreliquiare; der Weltenbrecher hat Schnellfeuer gegen sie.',
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
    lt: 'Abfangjäger sind billig, zahlreich und entbehrlich; ihre Piloten wissen, dass nur wenige heimkehren.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer und trägt nur wenig Fracht. Im Kampf wählt jeder Schuss ein zufälliges Ziel, darum binden viele billige Abfangjäger feindliches Feuer. Er hat Schnellfeuer nur gegen Spähschädel und Sonnenreliquiare; Fregatten und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Der Sturmjäger trägt schwerere Panzerung und Waffen als der Abfangjäger und ist der Schrecken ungeschützter Konvois.\n\nSo funktioniert es: Er fliegt mit dem Plasma-Impulsantrieb und trägt wenig Fracht. Er hat Schnellfeuer gegen Frachtläufer, Spähschädel und Sonnenreliquiare. Nach einem Schuss auf eines dieser Ziele darf er mit einer gewissen Chance sofort erneut feuern, auf ein zufälliges Ziel. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Die Fregatte ist das schnelle Rückgrat jeder Flotte, wendig, gut bewaffnet und gefürchtet von Jägerpiloten.\n\nSo funktioniert es: Sie fliegt mit dem Plasma-Impulsantrieb, und ihr Laderaum reicht für etwas Beute. Sie hat Schnellfeuer gegen Abfangjäger, Raketenbatterien, Spähschädel und Sonnenreliquiare: Nach einem Schuss auf eines dieser Ziele darf sie mit einer gewissen Chance sofort erneut feuern. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Das Kathedralschiff ist eine fliegende Festung, deren Türme Gebete und Breitseiten gleichermaßen in die Leere tragen.\n\nSo funktioniert es: Es fliegt mit dem Warp-Antrieb, schlägt hart zu und hält mit seiner starken Struktur viele Treffer aus. Es hat Schnellfeuer nur gegen Spähschädel und Sonnenreliquiare; Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen es.',
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
    lt: 'Der Jagdkreuzer ist ein Raubtier unter den Kriegsschiffen, gebaut, um feindliche Verbände zu zerschneiden.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb. Er hat Schnellfeuer gegen Frachtläufer, Lastbarken, Sturmjäger, Fregatten, Kathedralschiffe, Spähschädel und Sonnenreliquiare. Nach einem Schuss auf eines dieser Ziele darf er mit einer gewissen Chance sofort erneut feuern, auf ein zufälliges Ziel. Vernichter und Weltenbrecher haben Schnellfeuer gegen ihn.',
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
    lt: 'Der Vernichter ist ein langsamer, gewaltiger Rumpf voller Geschütze, gebaut, um Bollwerke zu brechen.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb. Er hat Schnellfeuer gegen Lichtlanzen, Jagdkreuzer, Spähschädel und Sonnenreliquiare. Nach einem Schuss auf eines dieser Ziele darf er mit einer gewissen Chance sofort erneut feuern, auf ein zufälliges Ziel. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
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
    lt: 'Der Belagerungsbomber trägt Plasmaladungen, die Verteidigungsstellungen in glühende Krater verwandeln.\n\nSo funktioniert es: Er fliegt mit dem Plasma-Impulsantrieb; ist der Warp-Antrieb weit genug erforscht, steigt er auf ihn um, und dann zählt dessen Stufe für sein Tempo. Er hat Schnellfeuer gegen Raketenbatterien, Lichtlanzen, Schwere Lichtlanzen, Ionenlanzen, Spähschädel und Sonnenreliquiare. Nach einem Schuss auf eines dieser Ziele darf er mit einer gewissen Chance sofort erneut feuern, auf ein zufälliges Ziel. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
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
    lt: 'Der Weltenbrecher ist eine Festung von der Größe eines Mondes, deren Geschütze ganze Flotten in Asche legen.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb, kriecht aber langsamer als jedes andere fliegende Schiff und bremst so jede Flotte, in der er fliegt; dafür braucht er kaum Treibstoff und hat einen riesigen Laderaum. Er hat Schnellfeuer gegen jedes andere Schiff und gegen Raketenbatterien, Lichtlanzen, Schwere Lichtlanzen, Massebeschleuniger und Ionenlanzen, nicht aber gegen Plasmabatterien und Schutzdome. Keine Einheit hat Schnellfeuer gegen ihn. Erst das Gravitonen-Mysterium erlaubt seinen Bau.',
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
    lt: 'Der Spähschädel ist ein verdrahteter Schädel mit Auspex-Linsen, der lautlos zu fremden Welten fliegt und berichtet, was er sieht.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer, schneller als jedes andere Schiff, verbraucht kaum Treibstoff und trägt keine Fracht. Eine Auspex-Erkundung fliegt nur mit Spähschädeln; je mehr du schickst und je weiter deine Auspex-Lehre der des Ziels voraus ist, desto mehr verrät der Bericht. Schiffe über dem Ziel können sie abschießen. Im Kampf hat jedes andere Schiff außer dem Sonnenreliquiar Schnellfeuer gegen ihn, der Weltenbrecher besonders starkes.',
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
    lt: 'Das Sonnenreliquiar ist ein geweihter Spiegel im Orbit, der das Licht des Sterns einfängt und als Energie zur Welt hinabsendet.\n\nSo funktioniert es: Jedes Reliquiar liefert Energie nur für seinen Planeten, umso mehr, je heißer dieser ist; Planeten nahe ihrem Stern sind heißer. Ihren gemeinsamen Anteil stellst du auf der Rohstoffseite ein. Reliquiare können nicht fliegen und belegen keinen Flottenplatz. Wird der Planet angegriffen, kämpfen sie mit; jedes andere Schiff außer dem Spähschädel hat Schnellfeuer gegen sie, der Weltenbrecher besonders starkes, und zerstörte Reliquiare werden nicht wieder aufgebaut.',
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
    lt: 'Die Raketenbatterie ist die einfachste Wehr eines Planeten, billig und in großer Zahl ein zähes Hindernis.\n\nSo funktioniert es: Wie jede Verteidigung bleibt sie am Boden, kämpft nur, wenn ihr Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Fregatten, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Die Lichtlanze bündelt Licht zu einem sengenden Strahl und ist die erste ernsthafte Wehr eines Planeten.\n\nSo funktioniert es: Wie jede Verteidigung bleibt sie am Boden, kämpft nur, wenn ihr Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Vernichter, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Die Schwere Lichtlanze schleudert einen Strahl, der Schilde durchschlägt, an denen leichtere Lanzen verglühen.\n\nSo funktioniert es: Wie jede Verteidigung bleibt sie am Boden, kämpft nur, wenn ihr Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
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
    lt: 'Der Massebeschleuniger schleudert Adamantgeschosse mit solcher Wucht, dass selbst schwere Rümpfe bersten.\n\nSo funktioniert es: Wie jede Verteidigung bleibt er am Boden, kämpft nur, wenn sein Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
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
    lt: 'Die Ionenlanze speist einen Strom geladener Teilchen in ein mächtiges Schildfeld und steht noch, wenn leichtere Wehren längst verglüht sind.\n\nSo funktioniert es: Ihr Angriff ist bescheiden, ihr Schild aber stark: Schüsse, die schwächer sind als ein winziger Bruchteil ihres Schildes, prallen wirkungslos ab, und der Schild lädt sich in jeder Kampfrunde neu auf. Wie jede Verteidigung bleibt sie am Boden, kämpft nur, wenn ihr Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  pt: {
    n: 'Plasmabatterie',
    ab: 'PA',
    cost: [50000, 50000, 30000],
    atk: 3000,
    sh: 300,
    req: { b: { yard: 8 }, r: { plasma: 7 } },
    ds: 'Die stärkste Waffe der Verteidigung: feuert Plasma mit gewaltiger Wucht.',
    lt: 'Die Plasmabatterie schleudert Ladungen gebändigter Sternenglut, die kleinere Schiffe mit einem Schuss zerschmelzen.\n\nSo funktioniert es: Sie hat den stärksten Angriff aller Verteidigungsanlagen. Wie jede Verteidigung bleibt sie am Boden, kämpft nur, wenn ihr Planet angegriffen wird, und hat selbst kein Schnellfeuer. Nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder instand gesetzt; sind es nur wenige, entscheidet für jede einzelne der Zufall. Keine Einheit hat Schnellfeuer gegen sie.',
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
    lt: 'Der Kleine Schutzdom wölbt ein flimmerndes Schildfeld über den Planeten.\n\nSo funktioniert es: Jeder Planet trägt höchstens einen Kleinen Schutzdom; ein bestehender oder bereits in Auftrag gegebener zählt mit. Er feuert kaum, doch an seinem starken Schild prallen Schüsse, die schwächer sind als ein winziger Bruchteil davon, wirkungslos ab, und der Schild lädt sich in jeder Kampfrunde neu auf. Weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer ab, das sonst andere Einheiten träfe. Wie jede Verteidigung bleibt er am Boden und kämpft nur, wenn sein Planet angegriffen wird; keine Einheit hat Schnellfeuer gegen ihn. Nach einem Kampf wird ein zerstörter Schutzdom mit einer guten Chance wieder errichtet.',
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
    lt: 'Der Große Schutzdom spannt ein Schildfeld von gewaltiger Stärke über den Planeten, durch das nur noch schwere Waffen dringen.\n\nSo funktioniert es: Jeder Planet trägt höchstens einen Großen Schutzdom, neben einem Kleinen; ein bestehender oder bereits in Auftrag gegebener zählt mit. Er feuert kaum, doch sein Schild ist weit stärker als der des kleinen Doms: Schüsse, die schwächer sind als ein winziger Bruchteil davon, prallen wirkungslos ab, und der Schild lädt sich in jeder Kampfrunde neu auf. Weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer ab, das sonst andere Einheiten träfe. Wie jede Verteidigung bleibt er am Boden und kämpft nur, wenn sein Planet angegriffen wird; keine Einheit hat Schnellfeuer gegen ihn. Nach einem Kampf wird ein zerstörter Schutzdom mit einer guten Chance wieder errichtet.',
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
