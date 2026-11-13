// The display texts of the catalog (owner, 2026-11-12, #131): the name `n`,
// the abbreviation `ab`, the short text `ds` and the long explanation `lt`
// of every building, research, ship and defense, keyed like the catalog,
// and the names of the missions. Data only, German like the interface;
// catalog.ts spreads each entry into its game values.
//
// Display texts are not mutation-tested: Stryker leaves this file out
// (stryker.config.json), because every text was a static mutant that
// reloaded all tests. Their exactness is guarded by the catalog, naming and
// explanation tests (catalog.test.ts, src/test/naming.test.ts,
// explain.test.ts, texts.test.ts).

interface EntryText {
  n: string;
  ab: string;
  ds?: string;
  /** Long explanation text (issue #63); without it the short `ds` stands in. */
  lt?: string;
}
type DescribedText = EntryText & { ds: string };

export const MISSION_TEXT = {
  attack: 'Sturmangriff',
  transport: 'Versorgungsflug',
  spy: 'Auspex-Erkundung',
  colonize: 'Landnahme',
  deploy: 'Verlegung',
} as const;

export const BUILD_TEXT = {
  metal: {
    n: 'Adamant-Tiefbohrung',
    ab: 'AT',
    ds: 'Fördert Adamant, den wichtigsten Grundrohstoff.',
    lt: 'Bohrtürme reißen Adamant aus den Adern des Planeten, das Fundament jedes Bauwerks.\n\nSo funktioniert es: Jede Stufe steigert die Förderung auf diesem Planeten und ebenso den Energiebedarf. Fehlt Energie, fördern alle Minen des Planeten im selben Verhältnis weniger. Eine kleine Grundmenge kommt auch ohne Mine.',
  },
  crystal: {
    n: 'Psikristall-Steinbruch',
    ab: 'PS',
    ds: 'Baut Psikristall ab – nötig für Elektronik und Forschung.',
    lt: 'Arbeitskolonnen schlagen Psikristall aus dem Fels, dessen Gitter Ströme und Gedanken leitet.\n\nSo funktioniert es: Jede Stufe steigert den Abbau auf diesem Planeten und ebenso den Energiebedarf. Fehlt Energie, fördern alle Minen des Planeten im selben Verhältnis weniger. Eine kleine Grundmenge kommt auch ohne Steinbruch.',
  },
  deut: {
    n: 'Promethium-Raffinerie',
    ab: 'PR',
    ds: 'Gewinnt Promethium. Kältere Planeten produzieren mehr.',
    lt: 'Die Raffinerie destilliert Promethium, den heiligen Brennstoff jeder Flotte.\n\nSo funktioniert es: Jede Stufe steigert den Ausstoß auf diesem Planeten, kostet aber mehr Energie als andere Minen gleicher Stufe. Kalte Planeten liefern mehr als heiße. Fehlt Energie, fördern alle Minen im selben Verhältnis weniger.',
  },
  solar: {
    n: 'Sonnenkathedrale',
    ab: 'SK',
    ds: 'Liefert Energie für die Minen.',
    lt: 'Unter Spiegelgewölben fängt die Kathedrale das Licht des Sterns und wandelt es in Energie.\n\nSo funktioniert es: Jede Stufe liefert mehr Energie für diesen Planeten, unabhängig von seiner Temperatur. Reicht die Energie nicht für die Minen, fördern alle im selben Verhältnis weniger.',
  },
  fusion: {
    n: 'Fusionssanktum',
    ab: 'FS',
    ds: 'Erzeugt Energie aus Promethium; Machina-Energetik steigert die Leistung.',
    lt: 'Im Herzen des Sanktums brennt Promethium in gebändigter Glut.\n\nSo funktioniert es: Jede Stufe liefert mehr Energie für diesen Planeten und verbrennt mehr Promethium aus seinem Vorrat; die Machina-Energetik steigert die Energie zusätzlich. Ist der Vorrat leer, drosselt es sich auf das, was der Planet nachliefert.',
  },
  robot: {
    n: 'Servitorenschmiede',
    ab: 'SF',
    ds: 'Verkürzt die Bauzeit von Gebäuden.',
    lt: 'Servitoren aus Fleisch und Stahl schuften ohne Rast an den Bauwerken des Planeten.\n\nSo funktioniert es: Jede Stufe verkürzt die Bauzeit der Gebäude auf diesem Planeten, jede etwas weniger als die vorige. Auf Schiffe, Verteidigung und Forschung wirkt sie nicht.',
  },
  nanite: {
    n: 'Machina-Schwarmhalle',
    ab: 'MS',
    ds: 'Halbiert die Bauzeit von Gebäuden, Schiffen und Verteidigung pro Stufe.',
    lt: 'Zahllose winzige Machina-Konstrukte formen Stahl und Stein schneller als jede Hand.\n\nSo funktioniert es: Jede Stufe verkürzt auf diesem Planeten die Bauzeit von Gebäuden, Schiffen und Verteidigung erneut kräftig, nicht aber die Forschung. Während des Ausbaus nimmt die Schiffsschmiede keine Aufträge an, und er ist erst möglich, wenn sie leer ist.',
  },
  terraformer: {
    n: 'Weltenschmiede',
    ab: 'WE',
    ds: '+5 Felder pro Stufe. Braucht eine Energieproduktion, verbraucht sie aber nicht.',
    lt: 'Die Weltenschmiede bricht Gebirge, füllt Schluchten und hämmert aus totem Fels neuen Baugrund.\n\nSo funktioniert es: Jede Stufe schafft auf diesem Planeten mehrere neue Felder für Gebäude und belegt selbst eines. Der Planet muss genug Energie erzeugen; verbraucht wird sie nicht, und jede Stufe verlangt mehr.',
  },
  yard: {
    n: 'Orbitale Schiffsschmiede',
    ab: 'OS',
    ds: 'Baut Schiffe und Verteidigung. Höhere Stufe = schneller.',
    lt: 'In den Docks kreischen Schweißbrenner über neuen Rümpfen.\n\nSo funktioniert es: Sie baut die Schiffe und Verteidigung dieses Planeten, Auftrag für Auftrag; jede Stufe verkürzt die Bauzeit und erschließt größere Baumuster. Während ihres Ausbaus nimmt sie keine Aufträge an, und er ist erst möglich, wenn sie leer ist.',
  },
  lab: {
    n: 'Scholarium',
    ab: 'SC',
    ds: 'Ermöglicht und beschleunigt Forschung.',
    lt: 'Im Scholarium ringen Gelehrte den Sternen ihr Wissen ab.\n\nSo funktioniert es: Forschung beginnt nur auf einem Planeten mit Scholarium, wird dort bezahlt und gilt dann für alle Planeten. Jede Stufe verkürzt dort die Forschungszeit. Während des Ausbaus beginnt hier keine Forschung, und solange eine läuft, kann kein Scholarium ausgebaut werden.',
  },
  smetal: {
    n: 'Adamant-Gewölbe',
    ab: 'AG',
    ds: 'Erhöht die Lagerkapazität für Adamant.',
    lt: 'Unter gepanzerten Kuppeln lagert das Adamant des Planeten, gezählt bis zum letzten Barren.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht die Förderung; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
  scrystal: {
    n: 'Psikristall-Reliquiar',
    ab: 'RQ',
    ds: 'Erhöht die Lagerkapazität für Psikristall.',
    lt: 'In geweihten Schreinen ruht der Psikristall, abgeschirmt gegen sein eigenes Flüstern.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht der Abbau; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
  sdeut: {
    n: 'Promethium-Zisterne',
    ab: 'PZ',
    ds: 'Erhöht die Lagerkapazität für Promethium.',
    lt: 'In der Zisterne schwappt ein See aus Brennstoff, den der kleinste Funke entzünden könnte.\n\nSo funktioniert es: Jede Stufe vergrößert das Lager dieses Planeten deutlich. Ist es voll, ruht die Raffinerie; was Flotten darüber hinaus bringen, bleibt erhalten.',
  },
} satisfies Record<string, DescribedText>;

export const RES_TEXT = {
  energy: {
    n: 'Machina-Energetik',
    ab: 'ME',
    ds: 'Grundlage vieler weiterer Technologien.',
    lt: 'Die Machina-Energetik zwingt die Ströme der Reaktoren in die Leitungen der Maschinen.\n\nSo funktioniert es: Jede Stufe steigert die Energie jedes Fusionssanktums auf allen deinen Planeten. Sie ist Grundlage vieler weiterer Lehren.',
  },
  laser: {
    n: 'Lichtlanzen-Lehre',
    ab: 'LZ',
    ds: 'Gebündeltes Licht – Basis für Laserwaffen.',
    lt: 'Gebündeltes Licht, heiß genug, um Panzerstahl zu schneiden.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Mit wachsender Stufe erschließt sie Lichtlanze, Fregatte, Ionen-Lehre, Schwere Lichtlanze, Plasma-Lehre und zuletzt den Jagdkreuzer.',
  },
  comb: {
    n: 'Promethium-Brennkammer',
    ab: 'PB',
    ds: '+10 % Geschwindigkeit pro Stufe (Frachtläufer, Lastbarken, Abfangjäger, Spähschädel).',
    lt: 'In den Brennkammern zündet Promethium in gebändigten Stößen.\n\nSo funktioniert es: Jede Stufe macht Frachtläufer, Lastbarken, Abfangjäger und Spähschädel schneller. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  impulse: {
    n: 'Plasma-Impulsantrieb',
    ab: 'PI',
    ds: '+20 % pro Stufe (Kolonistenarchen, Sturmjäger, Fregatten; Belagerungsbomber bis Warp-Antrieb 8).',
    lt: 'Der Antrieb stößt gebündelte Glut aus und trägt schwerere Rümpfe als jede Brennkammer.\n\nSo funktioniert es: Jede Stufe macht Kolonistenarchen, Sturmjäger und Fregatten schneller, ebenso Belagerungsbomber, bis sie auf den Warp-Antrieb umsteigen. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  hyper: {
    n: 'Warp-Theorie',
    ab: 'WT',
    ds: 'Erschließt den Warp.',
    lt: 'Die Warp-Theorie ergründet den Raum hinter dem Raum, in den kein Verstand ungeschützt blicken sollte.\n\nSo funktioniert es: Die Theorie verändert keine Werte. Sie erschließt Warp-Antrieb, Jagdkreuzer, Vernichter, Weltenbrecher und das Sternennetz der Gelehrten.',
  },
  hdrive: {
    n: 'Warp-Antrieb',
    ab: 'WA',
    ds: '+30 % pro Stufe (Kathedralschiffe, Jagdkreuzer, Vernichter, Weltenbrecher; Belagerungsbomber ab Stufe 8).',
    lt: 'Der Warp-Antrieb reißt schwere Schiffe durch den Raum hinter dem Raum.\n\nSo funktioniert es: Jede Stufe macht Kathedralschiffe, Jagdkreuzer, Vernichter und Weltenbrecher schneller. Weit genug erforscht, treibt er auch die Belagerungsbomber an. Eine Flotte fliegt so schnell wie ihr langsamstes Schiff.',
  },
  spy: {
    n: 'Auspex-Lehre',
    ab: 'AU',
    ds: 'Bessere Auspex-Berichte, bessere Abwehr.',
    lt: 'Die Auspex-Lehre schärft die Sinne der Spähschädel und entlarvt fremde Augen am eigenen Himmel.\n\nSo funktioniert es: Je mehr Spähschädel du schickst und je weiter du dem Ziel in dieser Lehre voraus bist, desto mehr verrät der Bericht. Ein Vorsprung senkt die Gefahr, dass sie abgeschossen werden, ein Rückstand erhöht sie.',
  },
  computer: {
    n: 'Kogitator-Doktrin',
    ab: 'KD',
    ds: '+1 Flottenslot pro Stufe.',
    lt: 'Kogitatoren berechnen Kurse und Ziele, damit kein Befehlshaber den Überblick verliert.\n\nSo funktioniert es: Jede Stufe erlaubt eine weitere Flotte, die gleichzeitig unterwegs ist, über alle deine Planeten zusammen.',
  },
  weapons: {
    n: 'Waffensegnung',
    ab: 'WS',
    ds: '+10 % Angriff pro Stufe.',
    lt: 'Jede Waffe wird gesalbt und geweiht, bevor sie ins Feld zieht.\n\nSo funktioniert es: Jede Stufe verstärkt im Kampf den Angriff aller deiner Schiffe und Verteidigungsanlagen.',
  },
  shield: {
    n: 'Refraktionsfelder',
    ab: 'RE',
    ds: '+10 % Schilde pro Stufe.',
    lt: 'Flimmernde Felder lenken feindliches Feuer ab, bevor es den Rumpf erreicht.\n\nSo funktioniert es: Jede Stufe stärkt die Schilde aller deiner Schiffe und Verteidigungsanlagen. Schilde laden sich jede Kampfrunde neu auf, und Schüsse unter einem winzigen Bruchteil des Schildes prallen ab.',
  },
  armor: {
    n: 'Adamant-Panzerung',
    ab: 'AP',
    ds: '+10 % Strukturpunkte pro Stufe.',
    lt: 'Schicht um Schicht wird Adamant auf die Rümpfe geschmiedet.\n\nSo funktioniert es: Jede Stufe erhöht die Struktur aller deiner Schiffe und Verteidigungsanlagen im Kampf. Schwer beschädigte Einheiten können nach einem Treffer zerbersten.',
  },
  ion: {
    n: 'Ionen-Lehre',
    ab: 'IL',
    ds: 'Beschleunigte Ionen – Basis für Ionenwaffen.',
    lt: 'Die Ionen-Lehre zwingt geladene Teilchen in gebündelte Ströme.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Sie erschließt die Ionenlanze und ist der Weg zur Plasma-Lehre.',
  },
  plasma: {
    n: 'Plasma-Lehre',
    ab: 'PL',
    ds: 'Gebändigtes Plasma – Basis für Plasmawaffen.',
    lt: 'Die Plasma-Lehre bändigt Materie, die heißer brennt als das Herz eines Sterns.\n\nSo funktioniert es: Die Lehre verändert keine Werte. Sie erschließt den Belagerungsbomber und mit höherer Stufe die Plasmabatterie.',
  },
  graviton: {
    n: 'Gravitonen-Mysterium',
    ab: 'GM',
    ds: 'Kostet keine Rohstoffe, braucht aber eine gewaltige Energieproduktion.',
    lt: 'Das Mysterium ergründet die Kraft, die Welten zusammenhält und Sterne verschlingt.\n\nSo funktioniert es: Es kostet keine Rohstoffe, doch der Planet, auf dem es beginnt, muss genug Energie erzeugen; verbraucht wird sie nicht, und jede Stufe verlangt weit mehr. Es erschließt den Weltenbrecher.',
  },
  ifn: {
    n: 'Sternennetz der Gelehrten',
    ab: 'SN',
    ds: 'Vernetzt pro Stufe ein weiteres Scholarium deiner Planeten.',
    lt: 'Das Sternennetz verbindet die Scholarien deiner Welten zu einem denkenden Chor.\n\nSo funktioniert es: Jede Stufe bindet ein weiteres Scholarium deiner anderen Planeten in jede Forschung ein: die höchsten, die die verlangte Stufe haben und nicht ausgebaut werden. Ihre Stufen zählen zum Scholarium des Startplaneten.',
  },
} satisfies Record<string, DescribedText>;

export const SHIP_TEXT = {
  sc: {
    n: 'Frachtläufer',
    ab: 'FL',
    lt: 'Der Frachtläufer ist ein schmuckloser Lastesel zwischen den Welten.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer und trägt Lieferungen und Beute. Sturmjäger, Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn: Nach einem Schuss auf ihn feuern sie mit einer gewissen Chance sofort erneut.',
  },
  lc: {
    n: 'Lastbarke',
    ab: 'LB',
    lt: 'Die Lastbarke ist ein gewaltiger Frachtrumpf für ganze Kolonien und reiche Beute.\n\nSo funktioniert es: Sie fliegt mit der Promethium-Brennkammer, schneller als ein Frachtläufer, und trägt ein Vielfaches seiner Ladung bei höherem Verbrauch. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  colony: {
    n: 'Kolonistenarche',
    ab: 'KA',
    lt: 'Die Arche trägt Siedler, Saatgut und Werkzeug zu einer freien Welt.\n\nSo funktioniert es: Bei der Landnahme einer freien Position geht eine Arche in der neuen Kolonie auf, und die Flotte lädt dort ihre Fracht ab. Ist die Position schon besetzt, kehrt die Flotte um. Sie fliegt mit dem Plasma-Impulsantrieb.',
  },
  lf: {
    n: 'Abfangjäger',
    ab: 'AJ',
    lt: 'Abfangjäger sind billig, zahlreich und entbehrlich.\n\nSo funktioniert es: Er fliegt mit der Promethium-Brennkammer. Jeder Schuss im Kampf wählt ein zufälliges Ziel, darum binden viele Abfangjäger feindliches Feuer. Fregatten und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  hf: {
    n: 'Sturmjäger',
    ab: 'SJ',
    lt: 'Der Sturmjäger ist schwerer gepanzert als der Abfangjäger und der Schrecken ungeschützter Konvois.\n\nSo funktioniert es: Er fliegt mit dem Plasma-Impulsantrieb und hat Schnellfeuer gegen Frachtläufer. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  cr: {
    n: 'Fregatte',
    ab: 'FR',
    lt: 'Die Fregatte ist das schnelle, wendige Rückgrat jeder Flotte.\n\nSo funktioniert es: Sie fliegt mit dem Plasma-Impulsantrieb und hat Schnellfeuer gegen Abfangjäger und Raketenbatterien. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  bs: {
    n: 'Kathedralschiff',
    ab: 'KS',
    lt: 'Das Kathedralschiff ist eine fliegende Festung voller Gebete und Breitseiten.\n\nSo funktioniert es: Es fliegt mit dem Warp-Antrieb, schlägt hart zu und hält viel aus. Jagdkreuzer und Weltenbrecher haben Schnellfeuer gegen es.',
  },
  bc: {
    n: 'Jagdkreuzer',
    ab: 'JK',
    ds: 'Schnell und stark gegen Frachtläufer, Lastbarken, Fregatten und Kathedralschiffe.',
    lt: 'Der Jagdkreuzer ist ein Raubtier, gebaut, um feindliche Verbände zu zerschneiden.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb und hat Schnellfeuer gegen Frachtläufer, Lastbarken, Sturmjäger, Fregatten und Kathedralschiffe. Vernichter und Weltenbrecher haben Schnellfeuer gegen ihn.',
  },
  dr: {
    n: 'Vernichter',
    ab: 'VN',
    ds: 'Schweres Kriegsschiff – stark gegen Lichtlanzen und Jagdkreuzer.',
    lt: 'Der Vernichter ist ein gewaltiger Rumpf voller Geschütze, gebaut, um Bollwerke zu brechen.\n\nSo funktioniert es: Er fliegt mit dem Warp-Antrieb und hat Schnellfeuer gegen Lichtlanzen und Jagdkreuzer. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  bb: {
    n: 'Belagerungsbomber',
    ab: 'BB',
    ds: 'Stark gegen Raketenbatterien, Lichtlanzen und Ionenlanzen; fliegt ab Warp-Antrieb 8 mit dem Warp-Antrieb.',
    lt: 'Der Belagerungsbomber verwandelt Verteidigungsstellungen in glühende Krater.\n\nSo funktioniert es: Er hat Schnellfeuer gegen Raketenbatterien, Lichtlanzen, Schwere Lichtlanzen und Ionenlanzen. Er fliegt mit dem Plasma-Impulsantrieb und, ist der Warp-Antrieb weit genug erforscht, mit diesem. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  dstar: {
    n: 'Weltenbrecher',
    ab: 'WB',
    ds: 'Gewaltige Kampfstation; zerstört fast alles mit Schnellfeuer.',
    lt: 'Der Weltenbrecher ist eine Festung von der Größe eines Mondes.\n\nSo funktioniert es: Er hat Schnellfeuer gegen jedes andere Schiff und jede Verteidigung außer Plasmabatterie und Schutzdomen; niemand hat Schnellfeuer gegen ihn. Er ist das langsamste fliegende Schiff und bremst seine Flotte, braucht aber kaum Treibstoff.',
  },
  probe: {
    n: 'Spähschädel',
    ab: 'SP',
    lt: 'Der Spähschädel fliegt lautlos zu fremden Welten und berichtet, was er sieht.\n\nSo funktioniert es: Er ist das schnellste Schiff, trägt keine Fracht, und nur Spähschädel fliegen zur Auspex-Erkundung. Je mehr du schickst, desto mehr verrät der Bericht. Fast jedes Schiff hat Schnellfeuer gegen ihn.',
  },
  sat: {
    n: 'Sonnenreliquiar',
    ab: 'SR',
    ds: 'Liefert Energie, je wärmer der Planet, desto mehr. Kann nicht fliegen.',
    lt: 'Das Sonnenreliquiar ist ein geweihter Spiegel, der Sternenlicht als Energie zur Welt sendet.\n\nSo funktioniert es: Jedes liefert Energie für seinen Planeten, umso mehr, je heißer dieser ist. Es fliegt nie, kämpft aber bei einem Angriff mit und wird danach nicht wieder aufgebaut. Fast jedes Schiff hat Schnellfeuer gegen es.',
  },
} satisfies Record<string, EntryText>;

export const DEF_TEXT = {
  rl: {
    n: 'Raketenbatterie',
    ab: 'RB',
    lt: 'Die Raketenbatterie ist die billigste Wehr eines Planeten.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Fregatten, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  ll: {
    n: 'Lichtlanze',
    ab: 'LI',
    lt: 'Die Lichtlanze bündelt Licht zu einem sengenden Strahl.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Vernichter, Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  hl: {
    n: 'Schwere Lichtlanze',
    ab: 'SL',
    lt: 'Die Schwere Lichtlanze durchschlägt Schilde, an denen leichtere Lanzen verglühen.\n\nSo funktioniert es: Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  gauss: {
    n: 'Massebeschleuniger',
    ab: 'MB',
    lt: 'Der Massebeschleuniger schleudert Adamantgeschosse, an denen selbst schwere Rümpfe bersten.\n\nSo funktioniert es: Er verteidigt nur seinen Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
  },
  ionc: {
    n: 'Ionenlanze',
    ab: 'IN',
    ds: 'Geschütz mit starkem Schild, das viele Treffer einsteckt.',
    lt: 'Die Ionenlanze speist geladene Teilchen in ein mächtiges Schildfeld.\n\nSo funktioniert es: Ihr Angriff ist schwach, ihr Schild stark: Schwache Schüsse prallen an ihm ab. Sie verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Belagerungsbomber und Weltenbrecher haben Schnellfeuer gegen sie.',
  },
  pt: {
    n: 'Plasmabatterie',
    ab: 'PA',
    ds: 'Die stärkste Waffe der Verteidigung: feuert Plasma mit gewaltiger Wucht.',
    lt: 'Die Plasmabatterie schleudert gebändigte Sternenglut.\n\nSo funktioniert es: Sie hat den stärksten Angriff aller Verteidigungsanlagen und verteidigt nur ihren Planeten; nach einem Kampf wird ein großer Teil der zerstörten Anlagen wieder aufgebaut. Niemand hat Schnellfeuer gegen sie.',
  },
  ssd: {
    n: 'Kleiner Schutzdom',
    ab: 'SD',
    ds: 'Kuppel mit starkem Schild über dem Planeten; schwache Schüsse prallen ab. Nur eine pro Planet.',
    lt: 'Der Kleine Schutzdom wölbt ein flimmerndes Schildfeld über den Planeten.\n\nSo funktioniert es: Jeder Planet trägt nur einen, auch ein bestellter zählt. Er feuert kaum, doch schwache Schüsse prallen an seinem Schild ab, und weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer für andere ab. Zerstört wird er oft wieder errichtet.',
  },
  lsd: {
    n: 'Großer Schutzdom',
    ab: 'GD',
    ds: 'Die größere Kuppel mit fünffachem Schild; nur starke Schüsse dringen durch. Nur eine pro Planet.',
    lt: 'Der Große Schutzdom spannt ein Schildfeld, durch das nur schwere Waffen dringen.\n\nSo funktioniert es: Jeder Planet trägt nur einen, auch ein bestellter zählt. Er feuert kaum, doch sein Schild ist weit stärker als der kleine, und weil jeder Schuss ein zufälliges Ziel wählt, fängt er Feuer für andere ab. Zerstört wird er oft wieder errichtet.',
  },
} satisfies Record<string, EntryText>;
