// Costs and values of all units are those of version 1; the display texts
// are those of the grimdark naming (#94), compared through its table.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MISSIONS, NAMES, RESOURCES, renamed } from '../test/naming.ts';
import { ENTRIES } from '../features/index.gen.ts';
import * as Catalog from './catalog.ts';
import { text } from './text.ts';

/**
 * The entries of a table with their display texts, which live apart from
 * the rules since #113 and are read through `text(key)`.
 */
const withTexts = <T extends object>(defs: Record<string, T>) =>
  Object.fromEntries(
    Object.entries(defs).map(([k, def]) => [k, { ...text(k)!, ...def }]),
  );

/** The catalog as the tests below read it: every entry with its texts. */
const C = {
  ...Catalog,
  BUILD: withTexts(Catalog.BUILD),
  RES: withTexts(Catalog.RES),
  SHIPS: withTexts(Catalog.SHIPS),
  DEF: withTexts(Catalog.DEF),
  UNIT: withTexts(Catalog.UNIT),
};

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const O: any = require('../test/legacy/game.cjs');

const DISPLAY = ['n', 'ab', 'ds', 'lt'] as const;

/** The game values of the entries: everything but the display texts. */
const values = <T extends object>(
  defs: Record<string, T>,
): Record<string, Partial<T>> =>
  Object.fromEntries(
    Object.entries(defs).map(([k, def]) => {
      const rest = { ...def } as Record<string, unknown>;
      for (const field of DISPLAY) delete rest[field];
      return [k, rest as unknown as Partial<T>];
    }),
  );

/** A long text is there: the exact wording is the owner's (#94). */
const LT = expect.stringMatching(/\S/);

/**
 * Short texts of version 1 that changed beyond the names (#94, [V] for the
 * owner): wrong drive lists and the Hyperraum, now the Warp.
 */
const CHANGED_DS: Readonly<Record<string, string>> = {
  comb: '+10 % Geschwindigkeit pro Stufe (Frachtläufer, Lastbarken, Abfangjäger, Spähschädel).',
  impulse:
    '+20 % pro Stufe (Kolonistenarchen, Sturmjäger, Fregatten; Belagerungsbomber bis Warp-Antrieb 8).',
  hyper: 'Erschließt den Warp.',
  hdrive:
    '+30 % pro Stufe (Kathedralschiffe, Jagdkreuzer, Vernichter, Weltenbrecher; Belagerungsbomber ab Stufe 8).',
  spy: 'Bessere Auspex-Berichte, bessere Abwehr.',
};

/**
 * Short texts of the 12 classic ships and defenses, which never had one, not
 * even in version 1 (owner, 2026-11-13, #113: confirmed exactly as listed).
 */
const NEW_DS: Readonly<Record<string, string>> = {
  sc: 'Kleiner Frachter für Lieferungen und Beute.',
  lc: 'Großer, schnellerer Frachter; trägt ein Vielfaches eines Frachtläufers.',
  colony: 'Gründet eine Kolonie auf einer freien Position.',
  lf: 'Billiger Jäger, der in großer Zahl feindliches Feuer bindet.',
  hf: 'Schwerer Jäger mit Schnellfeuer gegen Frachtläufer.',
  cr: 'Schnelles Kriegsschiff – stark gegen Abfangjäger und Raketenbatterien.',
  bs: 'Schweres Kriegsschiff, das hart zuschlägt und viel aushält.',
  probe:
    'Schnellstes Schiff; erkundet fremde Welten per Auspex, trägt keine Fracht.',
  rl: 'Die billigste Verteidigung eines Planeten.',
  ll: 'Leichtes Strahlgeschütz zur Verteidigung des Planeten.',
  hl: 'Schweres Strahlgeschütz, das stärkere Schilde durchschlägt.',
  gauss: 'Schweres Geschütz; nur der Weltenbrecher hat Schnellfeuer gegen ihn.',
};

/** A short text of version 1 with the new names of entries and resources. */
const withNewNames = (ds: string): string =>
  Object.entries(RESOURCES).reduce(
    (text, [classic, name]) =>
      text.replace(
        new RegExp(`(?<![\\p{L}-])${classic}(?!\\p{L})`, 'gu'),
        name,
      ),
    renamed(ds),
  );

describe('catalog', () => {
  it('has the game values of version 1', () => {
    expect(values(C.BUILD)).toEqual({
      ...values(O.BUILD),
      nanite: values(C.BUILD).nanite,
      fusion: values(C.BUILD).fusion,
      terraformer: values(C.BUILD).terraformer,
    });
    expect(values(C.RES)).toEqual({
      ...values(O.RES),
      ion: values(C.RES).ion,
      plasma: values(C.RES).plasma,
      graviton: values(C.RES).graviton,
      ifn: values(C.RES).ifn,
    });
    const ships = values(C.SHIPS);
    const added = {
      colony: ships.colony,
      bc: ships.bc,
      dr: ships.dr,
      bb: ships.bb,
      dstar: ships.dstar,
      sat: ships.sat,
    };
    const defs = values(C.DEF);
    const addedDef = {
      ionc: defs.ionc,
      pt: defs.pt,
      ssd: defs.ssd,
      lsd: defs.lsd,
    };
    expect(ships).toEqual({ ...values(O.SHIPS), ...added });
    expect(defs).toEqual({ ...values(O.DEF), ...addedDef });
    expect(values(C.UNIT)).toEqual({
      ...values(O.UNIT),
      ...added,
      ...addedDef,
    });
    expect(C.DRIVE_BONUS).toEqual(O.DRIVE_BONUS);
  });
  it('names every entry as the grimdark naming decides, version 1 had the classic names (#94)', () => {
    const all = { ...C.BUILD, ...C.RES, ...C.UNIT };
    expect(Object.keys(all).sort()).toEqual(Object.keys(NAMES).sort());
    for (const [k, def] of Object.entries(all)) {
      expect({ n: def.n, ab: def.ab }, k).toEqual({
        n: NAMES[k]!.name,
        ab: NAMES[k]!.ab,
      });
    }
    const old = { ...O.BUILD, ...O.RES, ...O.UNIT };
    for (const [k, def] of Object.entries(old) as [string, { n: string }][])
      expect(def.n, k).toBe(NAMES[k]!.classic);
  });
  it('keeps the short texts of version 1 with the new names (#94)', () => {
    const old = { ...O.BUILD, ...O.RES, ...O.UNIT };
    const all: Record<string, { ds?: string }> = {
      ...C.BUILD,
      ...C.RES,
      ...C.UNIT,
    };
    for (const [k, def] of Object.entries(old) as [string, { ds?: string }][])
      expect(all[k]!.ds, k).toBe(
        def.ds === undefined
          ? NEW_DS[k]
          : (CHANGED_DS[k] ?? withNewNames(def.ds)),
      );
  });
  it("gives the 12 entries without a short text in version 1 the owner's short texts (#113)", () => {
    const old = { ...O.BUILD, ...O.RES, ...O.UNIT } as Record<
      string,
      { ds?: string }
    >;
    const without = Object.keys(old).filter((k) => old[k]!.ds === undefined);
    // The Kolonistenarche came after version 1, without a short text too.
    expect(old).not.toHaveProperty('colony');
    expect([...without, 'colony'].sort()).toEqual(Object.keys(NEW_DS).sort());
    for (const [k, ds] of Object.entries(NEW_DS)) expect(text(k)!.ds).toBe(ds);
  });
  it('shows the missions with their new names; the stored ids stay (#94)', () => {
    expect(Object.keys(C.MISSION)).toEqual([
      ...Object.keys(O.MISSION),
      'colonize',
      'deploy',
    ]);
    expect(C.MISSION).toEqual(
      Object.fromEntries(Object.entries(MISSIONS).map(([k, m]) => [k, m.name])),
    );
    for (const [k, name] of Object.entries(O.MISSION))
      expect(name).toBe(MISSIONS[k as keyof typeof MISSIONS].classic);
  });
  it('has the Nanitenfabrik with the classic values (#48)', () => {
    expect(C.BUILD.nanite).toEqual({
      n: 'Machina-Schwarmhalle',
      ab: 'MS',
      cost: [1000000, 500000, 100000],
      f: 2,
      ds: 'Halbiert die Bauzeit von Gebäuden, Schiffen und Verteidigung pro Stufe.',
      lt: LT,
      req: { b: { robot: 10 }, r: { computer: 10 } },
    });
  });
  it('has the Fusionskraftwerk with the classic values (#47)', () => {
    expect(C.BUILD.fusion).toEqual({
      n: 'Fusionssanktum',
      ab: 'FS',
      cost: [900, 360, 180],
      f: 1.8,
      ds: 'Erzeugt Energie aus Promethium; Machina-Energetik steigert die Leistung.',
      lt: LT,
      req: { b: { deut: 5 }, r: { energy: 3 } },
    });
    const all = [C.BUILD, C.RES, C.UNIT].flatMap((d) =>
      Object.values(d).map((x) => x.ab),
    );
    expect(all.filter((ab) => ab === 'FS')).toEqual(['FS']);
  });
  it('has the Terraformer as Weltenschmiede with the classic values (#51)', () => {
    expect(C.BUILD.terraformer).toEqual({
      n: 'Weltenschmiede',
      ab: 'WE',
      cost: [0, 50000, 100000],
      f: 2,
      ds: '+5 Felder pro Stufe. Braucht eine Energieproduktion, verbraucht sie aber nicht.',
      lt: LT,
      req: { b: { nanite: 1 }, r: { energy: 12 } },
      energy: { base: 1000, f: 2 },
      fields: 5,
    });
    // The buildings page lists it after the Machina-Schwarmhalle.
    const keys = Object.keys(C.BUILD);
    expect(keys.indexOf('terraformer')).toBe(keys.indexOf('nanite') + 1);
    // Only the Weltenschmiede adds fields or needs energy among the buildings.
    expect(Object.keys(C.BUILD).filter((k) => C.BUILD[k]!.fields)).toEqual([
      'terraformer',
    ]);
    expect(Object.keys(C.BUILD).filter((k) => C.BUILD[k]!.energy)).toEqual([
      'terraformer',
    ]);
    const all = [C.BUILD, C.RES, C.UNIT].flatMap((d) =>
      Object.entries(d).map(([k, x]) => [k, x.ab] as const),
    );
    expect(all.filter(([, a]) => a === 'WE').map(([k]) => k)).toEqual([
      'terraformer',
    ]);
  });
  it('has Ionen-, Plasmatechnik, Gravitonforschung and IFN with the classic values (#49)', () => {
    expect(C.RES.ion).toMatchObject({
      n: 'Ionen-Lehre',
      ab: 'IL',
      cost: [1000, 300, 100],
      req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
    });
    expect(C.RES.plasma).toMatchObject({
      n: 'Plasma-Lehre',
      ab: 'PL',
      cost: [2000, 4000, 1000],
      req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
    });
    expect(C.RES.graviton).toMatchObject({
      n: 'Gravitonen-Mysterium',
      ab: 'GM',
      cost: [0, 0, 0],
      energy: { base: 300000, f: 3 },
      req: { b: { lab: 12 } },
    });
    expect(C.RES.ifn).toMatchObject({
      n: 'Sternennetz der Gelehrten',
      ab: 'SN',
      cost: [240000, 400000, 160000],
      req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
    });
    for (const k of ['ion', 'plasma', 'graviton', 'ifn']) {
      // Research has no own factor: every level doubles (lvlCost, f = 2).
      expect(C.RES[k]).not.toHaveProperty('f');
      expect(C.RES[k]!.ds).toMatch(/\S/);
      expect(C.RES[k]!.req.r ?? {}).not.toHaveProperty(k);
    }
    expect(Object.keys(C.RES).filter((k) => C.RES[k]!.energy)).toEqual([
      'graviton',
    ]);
  });
  it('gives the new research abbreviations no other entry uses (#49)', () => {
    const all = [C.BUILD, C.RES, C.UNIT].flatMap((d) =>
      Object.entries(d).map(([k, x]) => [k, x.ab] as const),
    );
    for (const k of ['ion', 'plasma', 'graviton', 'ifn']) {
      const ab = C.RES[k]!.ab;
      expect(all.filter(([, a]) => a === ab).map(([key]) => key)).toEqual([k]);
    }
  });
  it('has the Schlachtkreuzer with the classic values (#58)', () => {
    expect(C.SHIPS.bc).toEqual({
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
      lt: LT,
    });
  });
  it('has the Zerstörer with the classic values (#59)', () => {
    expect(C.SHIPS.dr).toEqual({
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
      lt: LT,
    });
  });
  it('has the Bomber with the classic values and its drive switch (#57)', () => {
    expect(C.SHIPS.bb).toEqual({
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
        {
          drive: 'hdrive',
          speed: 5000,
          from: { research: 'hdrive', level: 8 },
        },
      ],
      req: { b: { yard: 8 }, r: { impulse: 6, plasma: 5 } },
      rf: { rl: 20, ll: 20, hl: 10, ionc: 10 },
      ds: 'Stark gegen Raketenbatterien, Lichtlanzen und Ionenlanzen; fliegt ab Warp-Antrieb 8 mit dem Warp-Antrieb.',
      lt: LT,
    });
    // The Werft lists it after the Zerstörer.
    const keys = Object.keys(C.SHIPS);
    expect(keys.indexOf('bb')).toBe(keys.indexOf('dr') + 1);
    // Only the Bomber switches its drive.
    expect(
      Object.keys(C.SHIPS).filter((k) => C.SHIPS[k]!.drives !== undefined),
    ).toEqual(['bb']);
  });
  it('has the Todesstern with the classic values (#60)', () => {
    expect(C.SHIPS.dstar).toEqual({
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
      lt: LT,
    });
    // The Werft lists it after the Bomber.
    const keys = Object.keys(C.SHIPS);
    expect(keys.indexOf('dstar')).toBe(keys.indexOf('bb') + 1);
    // Its requirements are existing buildings and research.
    const req = C.SHIPS.dstar!.req;
    for (const k of Object.keys(req.b ?? {})) expect(C.BUILD).toHaveProperty(k);
    for (const k of Object.keys(req.r ?? {})) expect(C.RES).toHaveProperty(k);
    // Rapid fire only against units that exist (#60 D4).
    for (const t of Object.keys(C.SHIPS.dstar!.rf!))
      expect(C.UNIT).toHaveProperty(t);
  });
  it('gives no unit rapid fire against the Todesstern (#60)', () => {
    const against = Object.keys(C.UNIT).filter(
      (k) => C.UNIT[k]!.rf?.dstar !== undefined,
    );
    expect(against).toEqual([]);
  });
  it('gives the new ships abbreviations no other entry uses', () => {
    const all = [C.BUILD, C.RES, C.SHIPS, C.DEF].flatMap((defs) =>
      Object.values(defs).map((d) => d.ab),
    );
    const added = [C.SHIPS.bc!, C.SHIPS.dr!, C.SHIPS.bb!, C.SHIPS.dstar!];
    for (const { ab } of added)
      expect(all.filter((x) => x === ab)).toEqual([ab]);
  });
  it('has Ionengeschütz, Plasmawerfer and both shield domes with the classic values (#50)', () => {
    expect(C.DEF.ionc).toEqual({
      n: 'Ionenlanze',
      ab: 'IN',
      cost: [2000, 6000, 0],
      atk: 150,
      sh: 500,
      req: { b: { yard: 4 }, r: { ion: 4 } },
      ds: 'Geschütz mit starkem Schild, das viele Treffer einsteckt.',
      lt: LT,
    });
    expect(C.DEF.pt).toEqual({
      n: 'Plasmabatterie',
      ab: 'PA',
      cost: [50000, 50000, 30000],
      atk: 3000,
      sh: 300,
      req: { b: { yard: 8 }, r: { plasma: 7 } },
      ds: 'Die stärkste Waffe der Verteidigung: feuert Plasma mit gewaltiger Wucht.',
      lt: LT,
    });
    expect(C.DEF.ssd).toEqual({
      n: 'Kleiner Schutzdom',
      ab: 'SD',
      cost: [10000, 10000, 0],
      atk: 1,
      sh: 2000,
      req: { b: { yard: 1 }, r: { shield: 2 } },
      once: true,
      ds: 'Kuppel mit starkem Schild über dem Planeten; schwache Schüsse prallen ab. Nur eine pro Planet.',
      lt: LT,
    });
    expect(C.DEF.lsd).toEqual({
      n: 'Großer Schutzdom',
      ab: 'GD',
      cost: [50000, 50000, 0],
      atk: 1,
      sh: 10000,
      req: { b: { yard: 6 }, r: { shield: 6 } },
      once: true,
      ds: 'Die größere Kuppel mit fünffachem Schild; nur starke Schüsse dringen durch. Nur eine pro Planet.',
      lt: LT,
    });
    // Only the domes are limited; no new unit has rapid fire (#50, D2).
    expect(
      Object.keys(C.UNIT).filter((k) => (C.UNIT[k] as Catalog.DefenseDef).once),
    ).toEqual(['ssd', 'lsd']);
    for (const k of ['ionc', 'pt', 'ssd', 'lsd'])
      expect(C.DEF[k]).not.toHaveProperty('rf');
  });
  it('gives the new defense abbreviations no other entry uses (#50)', () => {
    const all = [C.BUILD, C.RES, C.UNIT].flatMap((defs) =>
      Object.values(defs).map((d) => d.ab),
    );
    for (const k of ['ionc', 'pt', 'ssd', 'lsd']) {
      const ab = C.DEF[k]!.ab;
      expect(all.filter((x) => x === ab)).toEqual([ab]);
    }
  });
  it('has the Solarsatellit with the classic values (#46)', () => {
    expect(C.SHIPS.sat).toEqual({
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
      lt: LT,
    });
  });
  it('knows which ships can fly', () => {
    expect(C.canFly('lf')).toBe(true);
    expect(C.canFly('probe')).toBe(true);
    expect(C.canFly('sat')).toBe(false);
    expect(C.canFly('rl')).toBe(false);
    expect(C.canFly('toString')).toBe(false);
  });
  it('tells ships from defense', () => {
    expect(C.isShip('lf')).toBe(true);
    expect(C.isShip('bc')).toBe(true);
    expect(C.isShip('dr')).toBe(true);
    expect(C.isShip('bb')).toBe(true);
    expect(C.canFly('bb')).toBe(true);
    expect(C.isShip('dstar')).toBe(true);
    expect(C.isDefense('dstar')).toBe(false);
    expect(C.canFly('dstar')).toBe(true);
    expect(C.isShip('rl')).toBe(false);
    expect(C.isShip('toString')).toBe(false);
    expect(C.isDefense('rl')).toBe(true);
    for (const k of ['ionc', 'pt', 'ssd', 'lsd']) {
      expect(C.isDefense(k)).toBe(true);
      expect(C.canFly(k)).toBe(false);
    }
    expect(C.isDefense('lf')).toBe(false);
    expect(C.PRODUCERS).toEqual([
      'metal',
      'crystal',
      'deut',
      'solar',
      'sat',
      'fusion',
    ]);
  });
});

// The entries live in src/features/<key>/entry.ts (#114): each has a kind and
// an order, and the tables keep the order of the game from before (owner,
// 2026-11-13). The lists below are that order, as players see it.
describe('catalog from the entry folders', () => {
  it('keeps the order of the game in every table', () => {
    expect(Object.keys(C.BUILD)).toEqual([
      'metal',
      'crystal',
      'deut',
      'solar',
      'fusion',
      'robot',
      'nanite',
      'terraformer',
      'yard',
      'lab',
      'smetal',
      'scrystal',
      'sdeut',
    ]);
    expect(Object.keys(C.RES)).toEqual([
      'energy',
      'laser',
      'comb',
      'impulse',
      'hyper',
      'hdrive',
      'spy',
      'computer',
      'weapons',
      'shield',
      'armor',
      'ion',
      'plasma',
      'graviton',
      'ifn',
    ]);
    const ships = [
      'sc',
      'lc',
      'colony',
      'lf',
      'hf',
      'cr',
      'bs',
      'bc',
      'dr',
      'bb',
      'dstar',
      'probe',
      'sat',
    ];
    const defense = ['rl', 'll', 'hl', 'gauss', 'ionc', 'pt', 'ssd', 'lsd'];
    expect(Object.keys(C.SHIPS)).toEqual(ships);
    expect(Object.keys(C.DEF)).toEqual(defense);
    expect(Object.keys(C.UNIT)).toEqual([...ships, ...defense]);
  });

  it('has one folder per entry, each with its kind and its own order', () => {
    expect(ENTRIES).toHaveLength(49);
    const kinds = {
      building: C.BUILD,
      research: C.RES,
      ship: C.SHIPS,
      defense: C.DEF,
    };
    for (const [kind, table] of Object.entries(kinds)) {
      const own = ENTRIES.filter(([, e]) => e.kind === kind);
      expect(own.map(([k]) => k).sort()).toEqual(Object.keys(table).sort());
      const orders = own.map(([, e]) => e.order);
      expect(new Set(orders).size, kind).toBe(orders.length);
    }
  });

  it('lists the producers and the stores from their components', () => {
    expect(C.PRODUCTION.map((e) => [e.key, e.kind])).toEqual([
      ['metal', 'building'],
      ['crystal', 'building'],
      ['deut', 'building'],
      ['solar', 'building'],
      ['sat', 'ship'],
      ['fusion', 'building'],
    ]);
    expect(C.STORAGE).toEqual([
      { key: 'smetal', storage: { res: 'm' } },
      { key: 'scrystal', storage: { res: 'c' } },
      { key: 'sdeut', storage: { res: 'd' } },
    ]);
  });
});
