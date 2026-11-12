import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import {
  DEFAULT_EXPLAIN,
  EXPLAIN_MODES,
  isExplainMode,
  longText,
} from './explain.ts';

describe('explanation display modes (issue #63)', () => {
  it('are always, the (?) icon and hidden; the icon is the default (D2)', () => {
    expect(EXPLAIN_MODES).toEqual(['always', 'icon', 'hidden']);
    expect(DEFAULT_EXPLAIN).toBe('icon');
  });

  it('accept only the three modes', () => {
    for (const mode of EXPLAIN_MODES) expect(isExplainMode(mode)).toBe(true);
    for (const bad of ['', 'ICON', 'never', 'toString', 1, null, undefined])
      expect(isExplainMode(bad)).toBe(false);
  });
});

describe('long text of a catalog entry', () => {
  it('is the long text when an entry has one', () => {
    expect(longText({ lt: 'Lang.', ds: 'Kurz.' })).toBe('Lang.');
  });

  it('falls back to the short ds for an entry without a long text (D4)', () => {
    expect(longText({ ds: 'Kurz.' })).toBe('Kurz.');
    expect(longText({ lt: '', ds: 'Kurz.' })).toBe('Kurz.');
  });

  it('is the long text, not the short ds, for the catalog entries (#94)', () => {
    expect(longText(BUILD.metal!)).toBe(BUILD.metal!.lt);
    expect(longText(RES.spy!)).toBe(RES.spy!.lt);
    expect(longText(SHIPS.probe!)).toBe(SHIPS.probe!.lt);
    expect(longText(DEF.rl!)).toBe(DEF.rl!.lt);
    expect(BUILD.metal!.lt).not.toBe(BUILD.metal!.ds);
  });

  it('is missing for an entry without any text', () => {
    expect(longText({})).toBeNull();
    expect(longText({ ds: '' })).toBeNull();
    expect(longText({ lt: '', ds: '' })).toBeNull();
  });
});

/**
 * Entries that get their long text later, in the pull request that brings
 * them to `main` or in the rename (#94). The list may only shrink: an entry
 * with a long text must leave it.
 */
const LATER: readonly string[] = [
  'ionc', // Ionengeschütz (#50)
  'pt', // Plasmawerfer (#50)
  'ssd', // Kleine Schildkuppel (#50)
  'lsd', // Große Schildkuppel (#50)
  'dstar', // Todesstern (#60)
];

/**
 * Classic names and the names of the grimdark naming that replace them
 * (okf/features/naming.md, decided by the owner on 2026-11-12). The long
 * texts already use the new names, so none may say a classic one.
 */
const CLASSIC: Readonly<Record<string, string>> = {
  Metall: 'Adamant',
  Kristall: 'Psikristall',
  Deuterium: 'Promethium',
  Metallmine: 'Adamant-Tiefbohrung',
  Kristallmine: 'Psikristall-Steinbruch',
  Deuteriumsynthetisierer: 'Promethium-Raffinerie',
  Solarkraftwerk: 'Sonnenkathedrale',
  Fusionskraftwerk: 'Fusionssanktum',
  Roboterfabrik: 'Servitorenschmiede',
  Nanitenfabrik: 'Machina-Schwarmhalle',
  Raumschiffwerft: 'Orbitale Schiffsschmiede',
  Werft: 'Schiffsschmiede',
  Forschungslabor: 'Scholarium',
  Labor: 'Scholarium',
  Metallspeicher: 'Adamant-Gewölbe',
  Kristallspeicher: 'Psikristall-Reliquiar',
  Deuteriumtank: 'Promethium-Zisterne',
  Energietechnik: 'Machina-Energetik',
  Lasertechnik: 'Lichtlanzen-Lehre',
  Verbrennungstriebwerk: 'Promethium-Brennkammer',
  Impulstriebwerk: 'Plasma-Impulsantrieb',
  Hyperraumtechnik: 'Warp-Theorie',
  Hyperraumantrieb: 'Warp-Antrieb',
  Hyperraum: 'Warp',
  Spionagetechnik: 'Auspex-Lehre',
  Computertechnik: 'Kogitator-Doktrin',
  Waffentechnik: 'Waffensegnung',
  Schildtechnik: 'Refraktionsfelder',
  Raumschiffpanzerung: 'Adamant-Panzerung',
  Ionentechnik: 'Ionen-Lehre',
  Plasmatechnik: 'Plasma-Lehre',
  Gravitonforschung: 'Gravitonen-Mysterium',
  'Intergalaktisches Forschungsnetzwerk': 'Sternennetz der Gelehrten',
  Forschungsnetzwerk: 'Sternennetz der Gelehrten',
  'Kleiner Transporter': 'Frachtläufer',
  'Großer Transporter': 'Lastbarke',
  Transporter: 'Frachtläufer',
  Kolonialschiff: 'Kolonistenarche',
  'Leichter Jäger': 'Abfangjäger',
  'Schwerer Jäger': 'Sturmjäger',
  Kreuzer: 'Fregatte',
  Schlachtschiff: 'Kathedralschiff',
  Schlachtkreuzer: 'Jagdkreuzer',
  Zerstörer: 'Vernichter',
  Bomber: 'Belagerungsbomber',
  Todesstern: 'Weltenbrecher',
  Spionagesonde: 'Spähschädel',
  Sonde: 'Spähschädel',
  Solarsatellit: 'Sonnenreliquiar',
  Satellit: 'Sonnenreliquiar',
  Raketenwerfer: 'Raketenbatterie',
  'Leichtes Lasergeschütz': 'Lichtlanze',
  'Schweres Lasergeschütz': 'Schwere Lichtlanze',
  Lasergeschütz: 'Lichtlanze',
  Gaußkanone: 'Massebeschleuniger',
  Ionengeschütz: 'Ionenlanze',
  Plasmawerfer: 'Plasmabatterie',
  Schildkuppel: 'Schutzdom',
  Spionagebericht: 'Auspex-Bericht',
  Trümmerfeld: 'Wrackfeld',
  Allianz: 'Gilde',
};

/**
 * Whether `text` says `name` as a word or at the start of a compound
 * („Deuteriumvorrat“), case-sensitive. A new name that ends in the classic
 * one in lower case („Jagdkreuzer“, „Psikristall“) is not a match.
 */
const says = (text: string, name: string): boolean =>
  new RegExp(`(?<![\\p{L}-])${name}`, 'u').test(text);

const CATALOG = { BUILD, RES, SHIPS, DEF } as const;
const entries = Object.entries(CATALOG).flatMap(([part, defs]) =>
  Object.entries(defs as Record<string, { lt?: string; ds?: string }>).map(
    ([key, def]) => ({ part, key, def }),
  ),
);

describe('long texts of the catalog (#94, drafts for the owner)', () => {
  it('cover every entry on main but the ones listed for later', () => {
    const missing = entries
      .filter(({ key, def }) => !LATER.includes(key) && !def.lt?.trim())
      .map(({ part, key }) => `${part}.${key}`);
    expect(missing).toEqual([]);
    expect(entries.length).toBeGreaterThan(40);
  });

  it('lets only entries without a long text stay on the list for later', () => {
    const written = entries
      .filter(({ key, def }) => LATER.includes(key) && def.lt)
      .map(({ key }) => key);
    expect(written).toEqual([]);
  });

  it('use no classic name that the grimdark naming replaces', () => {
    const found = entries.flatMap(({ key, def }) =>
      Object.keys(CLASSIC)
        .filter((name) => says(def.lt ?? '', name))
        .map((name) => `${key}: ${name} → ${CLASSIC[name]}`),
    );
    expect(found).toEqual([]);
  });

  it('are plain text of two to four sentences, other than the short ds', () => {
    for (const { key, def } of entries.filter(({ def }) => def.lt)) {
      const lt = def.lt!;
      const sentences = lt.split(/(?<=[.!?])\s+/);
      expect(sentences.length, key).toBeGreaterThanOrEqual(2);
      expect(sentences.length, key).toBeLessThanOrEqual(4);
      expect(lt, key).toMatch(/^[A-ZÄÖÜ].*[.!?]$/su);
      expect(lt, key).not.toMatch(/[<>\n]|\s{2}/);
      expect(lt, key).not.toBe(def.ds);
    }
  });

  it('find a classic name as a word or the start of a compound only', () => {
    expect(says('Der Kreuzer feuert.', 'Kreuzer')).toBe(true);
    expect(says('Ein Deuteriumvorrat.', 'Deuterium')).toBe(true);
    expect(says('Der Jagdkreuzer feuert.', 'Kreuzer')).toBe(false);
    expect(says('Psikristall', 'Kristall')).toBe(false);
    expect(says('Adamant-Panzerung', 'Panzerung')).toBe(false);
  });

  it('name no protected Games Workshop terms', () => {
    const protectedTerms =
      /Imperator|Space Marine|Adeptus|Astartes|Mechanicus|Omnissiah|Warhammer/i;
    for (const { key, def } of entries)
      expect(def.lt ?? '', key).not.toMatch(protectedTerms);
  });
});
