// The grimdark naming of issue #94 as test data: the tables of
// okf/features/naming.md, decided by the owner on 2026-11-12. The tests
// compare the catalog of version 1 with this one through these tables, and
// check that no display text shows a classic name any more.

/** Catalog key → classic name, new name and new abbreviation. */
export const NAMES: Readonly<
  Record<string, { classic: string; name: string; ab: string }>
> = {
  metal: { classic: 'Metallmine', name: 'Adamant-Tiefbohrung', ab: 'AT' },
  crystal: {
    classic: 'Kristallmine',
    name: 'Psikristall-Steinbruch',
    ab: 'PS',
  },
  deut: {
    classic: 'Deuteriumsynthetisierer',
    name: 'Promethium-Raffinerie',
    ab: 'PR',
  },
  solar: { classic: 'Solarkraftwerk', name: 'Sonnenkathedrale', ab: 'SK' },
  fusion: { classic: 'Fusionskraftwerk', name: 'Fusionssanktum', ab: 'FS' },
  robot: { classic: 'Roboterfabrik', name: 'Servitorenschmiede', ab: 'SF' },
  nanite: { classic: 'Nanitenfabrik', name: 'Machina-Schwarmhalle', ab: 'MS' },
  yard: {
    classic: 'Raumschiffwerft',
    name: 'Orbitale Schiffsschmiede',
    ab: 'OS',
  },
  lab: { classic: 'Forschungslabor', name: 'Scholarium', ab: 'SC' },
  smetal: { classic: 'Metallspeicher', name: 'Adamant-Gewölbe', ab: 'AG' },
  scrystal: {
    classic: 'Kristallspeicher',
    name: 'Psikristall-Reliquiar',
    ab: 'RQ',
  },
  sdeut: { classic: 'Deuteriumtank', name: 'Promethium-Zisterne', ab: 'PZ' },
  energy: { classic: 'Energietechnik', name: 'Machina-Energetik', ab: 'ME' },
  laser: { classic: 'Lasertechnik', name: 'Lichtlanzen-Lehre', ab: 'LZ' },
  comb: {
    classic: 'Verbrennungstriebwerk',
    name: 'Promethium-Brennkammer',
    ab: 'PB',
  },
  impulse: {
    classic: 'Impulstriebwerk',
    name: 'Plasma-Impulsantrieb',
    ab: 'PI',
  },
  hyper: { classic: 'Hyperraumtechnik', name: 'Warp-Theorie', ab: 'WT' },
  hdrive: { classic: 'Hyperraumantrieb', name: 'Warp-Antrieb', ab: 'WA' },
  spy: { classic: 'Spionagetechnik', name: 'Auspex-Lehre', ab: 'AU' },
  computer: {
    classic: 'Computertechnik',
    name: 'Kogitator-Doktrin',
    ab: 'KD',
  },
  weapons: { classic: 'Waffentechnik', name: 'Waffensegnung', ab: 'WS' },
  shield: { classic: 'Schildtechnik', name: 'Refraktionsfelder', ab: 'RE' },
  armor: {
    classic: 'Raumschiffpanzerung',
    name: 'Adamant-Panzerung',
    ab: 'AP',
  },
  ion: { classic: 'Ionentechnik', name: 'Ionen-Lehre', ab: 'IL' },
  plasma: { classic: 'Plasmatechnik', name: 'Plasma-Lehre', ab: 'PL' },
  graviton: {
    classic: 'Gravitonforschung',
    name: 'Gravitonen-Mysterium',
    ab: 'GM',
  },
  ifn: {
    classic: 'Intergalaktisches Forschungsnetzwerk',
    name: 'Sternennetz der Gelehrten',
    ab: 'SN',
  },
  sc: { classic: 'Kleiner Transporter', name: 'Frachtläufer', ab: 'FL' },
  lc: { classic: 'Großer Transporter', name: 'Lastbarke', ab: 'LB' },
  colony: { classic: 'Kolonialschiff', name: 'Kolonistenarche', ab: 'KA' },
  lf: { classic: 'Leichter Jäger', name: 'Abfangjäger', ab: 'AJ' },
  hf: { classic: 'Schwerer Jäger', name: 'Sturmjäger', ab: 'SJ' },
  cr: { classic: 'Kreuzer', name: 'Fregatte', ab: 'FR' },
  bs: { classic: 'Schlachtschiff', name: 'Kathedralschiff', ab: 'KS' },
  bc: { classic: 'Schlachtkreuzer', name: 'Jagdkreuzer', ab: 'JK' },
  dr: { classic: 'Zerstörer', name: 'Vernichter', ab: 'VN' },
  bb: { classic: 'Bomber', name: 'Belagerungsbomber', ab: 'BB' },
  dstar: { classic: 'Todesstern', name: 'Weltenbrecher', ab: 'WB' },
  probe: { classic: 'Spionagesonde', name: 'Spähschädel', ab: 'SP' },
  sat: { classic: 'Solarsatellit', name: 'Sonnenreliquiar', ab: 'SR' },
  rl: { classic: 'Raketenwerfer', name: 'Raketenbatterie', ab: 'RB' },
  ll: { classic: 'Leichtes Lasergeschütz', name: 'Lichtlanze', ab: 'LI' },
  hl: {
    classic: 'Schweres Lasergeschütz',
    name: 'Schwere Lichtlanze',
    ab: 'SL',
  },
  gauss: { classic: 'Gaußkanone', name: 'Massebeschleuniger', ab: 'MB' },
  ionc: { classic: 'Ionengeschütz', name: 'Ionenlanze', ab: 'IN' },
  pt: { classic: 'Plasmawerfer', name: 'Plasmabatterie', ab: 'PA' },
  ssd: { classic: 'Kleine Schildkuppel', name: 'Kleiner Schutzdom', ab: 'SD' },
  lsd: { classic: 'Große Schildkuppel', name: 'Großer Schutzdom', ab: 'GD' },
};

/** Resources: Energie stays. */
export const RESOURCES: Readonly<Record<string, string>> = {
  Metall: 'Adamant',
  Kristall: 'Psikristall',
  Deuterium: 'Promethium',
};

/** Display texts of the missions; the stored ids are the keys. */
export const MISSIONS = {
  attack: { classic: 'Angreifen', name: 'Sturmangriff' },
  transport: { classic: 'Transport', name: 'Versorgungsflug' },
  spy: { classic: 'Spionage', name: 'Auspex-Erkundung' },
  colonize: { classic: 'Kolonisieren', name: 'Landnahme' },
} as const;

/**
 * Classic words no display text may show any more: the names and
 * resources above, plus the short forms the interface used for them
 * („Werft“, „Labor“, „Sonde“ …). Each maps to what replaces it.
 */
export const CLASSIC: Readonly<Record<string, string>> = {
  ...RESOURCES,
  ...Object.fromEntries(Object.values(NAMES).map((x) => [x.classic, x.name])),
  Werft: 'Schiffsschmiede',
  Labor: 'Scholarium',
  Hyperraum: 'Warp',
  Forschungsnetzwerk: 'Sternennetz der Gelehrten',
  Transporter: 'Frachtläufer, Lastbarke',
  Sonde: 'Spähschädel',
  Satellit: 'Sonnenreliquiar',
  Lasergeschütz: 'Lichtlanze',
  Schildkuppel: 'Schutzdom',
  Spionagebericht: 'Auspex-Bericht',
  Trümmerfeld: 'Wrackfeld',
  Allianz: 'Gilde',
  'Nicht genug Rohstoffe': 'Der Zehnte reicht nicht aus.',
  'Voraussetzungen fehlen': 'Das Wissen ist noch verschlossen.',
  'Flotte zurückgekehrt': 'Die Flotte kehrt heim.',
  'Ausbau abgeschlossen': 'Das Werk ist vollbracht',
  'Angriff auf': 'Feindkontakt! … wird von … angegriffen',
  Spionageaktivität: 'Auspex-Aktivität',
  Spionageabwehr: 'Auspex-Abwehr',
};

/**
 * Whether `text` says `word` as a word or at the start of a compound
 * („Deuteriumvorrat“), case-sensitive. A new name that ends in the classic
 * one in lower case („Jagdkreuzer“, „Psikristall“) is not a match.
 */
export const says = (text: string, word: string): boolean =>
  new RegExp(`(?<![\\p{L}-])${word}`, 'u').test(text);

/** The classic words that `text` says. */
export const classicIn = (text: string): string[] =>
  Object.keys(CLASSIC).filter((w) => says(text, w));

/**
 * `text` of version 1 with every classic catalog name replaced by its new
 * name, the longest first („Schlachtkreuzer“ before „Kreuzer“).
 */
export function renamed(text: string): string {
  const pairs = Object.values(NAMES).sort(
    (a, b) => b.classic.length - a.classic.length,
  );
  let out = text;
  for (const { classic, name } of pairs)
    out = out.replace(
      new RegExp(`(?<![\\p{L}-])${classic}(?!\\p{L})`, 'gu'),
      name,
    );
  return out;
}
