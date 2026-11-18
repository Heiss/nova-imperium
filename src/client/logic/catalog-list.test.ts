// What the generic list of buildings, research, shipyard and defense shows
// (#118): one row per catalog entry of a kind, its texts, cost, lines and
// action; the headers and notices of the four views.
import { describe, expect, it } from 'vitest';
import { BUILD, buildable, DEF, RES, SHIPS } from '../../core/catalog.ts';
import {
  buildTime,
  lvlCost,
  production,
  researchTime,
  unitTime,
} from '../../core/economy.ts';
import { shipSpeed } from '../../core/flight.ts';
import { energyNeed, energyShort } from '../../core/research.ts';
import { text } from '../../core/text.ts';
import type { Cost, Levels, Planet, ResearchQueue } from '../../core/types.ts';
import { orderMax } from '../../core/yard.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import {
  type CatalogAction,
  type CatalogKind,
  type CatalogPage,
  type CatalogRow,
  catalogKind,
  catalogPage,
  CATALOG_VIEWS,
  lockNotice,
  orderNote,
  unitLines,
} from './catalog-list.ts';
import { dur, fmt } from './format.ts';
import { iconURL } from './icons.ts';
import type { GameState } from './types.ts';

interface Setup {
  P?: Partial<Planet>;
  research?: Levels;
  rq?: ResearchQueue | null;
  explain?: string;
  openEx?: Record<string, boolean>;
  labs?: GameState['labs'];
  galaxy?: Partial<GameState['galaxy'][number]>[];
  mainPlanet?: string | null;
  now?: number;
}

const RICH = { m: 1e9, c: 1e9, d: 1e9 };
const NONE: Cost = [0, 0, 0];

function view(o: Setup = {}): V {
  const P = planet({ res: { m: 500, c: 500, d: 0 }, ...o.P });
  const s = {
    cfg: U,
    me: { id: 'u1', explain: o.explain ?? 'icon' },
    labs: o.labs ?? [],
    galaxy: o.galaxy ?? [],
    // The first planet; research from before #49 counts as the main planet's (#221).
    homePlanet: 'p1_9_9',
    mainPlanet: o.mainPlanet ?? P.id,
  } as unknown as GameState;
  return {
    s,
    P,
    R: { research: o.research ?? {}, rq: o.rq ?? null },
    now: o.now ?? 0,
    ui: { openEx: o.openEx ?? {} } as unknown as Ui,
  };
}

/** The list of a page that is not blocked. */
function rows(page: CatalogPage): CatalogRow[] {
  if (page.blocked) throw new Error(`blocked: ${page.notice}`);
  return page.rows;
}

const row = (v: V, kind: CatalogKind, key: string): CatalogRow =>
  rows(catalogPage(v, kind)).find((r) => r.key === key)!;

const action = (v: V, kind: CatalogKind, key: string): CatalogAction =>
  row(v, kind, key).action;

const opened = (page: CatalogPage) => {
  if (page.blocked) throw new Error('blocked');
  return page;
};

describe('the views of the lists', () => {
  it('maps the four views to their kind of entries', () => {
    expect(CATALOG_VIEWS).toEqual({
      buildings: 'building',
      research: 'research',
      shipyard: 'ship',
      defense: 'defense',
    });
    expect(catalogKind('shipyard')).toBe('ship');
    expect(catalogKind('fleet')).toBeUndefined();
    expect(catalogKind('toString')).toBeUndefined();
  });
});

describe('every row', () => {
  it('shows the texts, the icon and the explanation of its entry', () => {
    const r = row(view({ openEx: { metal: true } }), 'building', 'metal');
    const lab = { P: { b: { lab: 1 } } };
    const t = text('metal')!;
    expect(r).toMatchObject({
      key: 'metal',
      name: t.n,
      ab: t.ab,
      ds: t.ds,
      icon: iconURL('metal'),
      cls: 'ic-b',
    });
    expect(r.explanation).toMatchObject({
      key: 'metal',
      panel: 'lexicanum-panel',
      open: true,
    });
    expect(row(view(), 'building', 'metal').explanation?.open).toBe(false);
    expect(
      row(view({ explain: 'hidden' }), 'building', 'metal').explanation,
    ).toBeNull();
    // A stored „Immer anzeigen“ of #63 shows the „?“ (#285 B2).
    expect(
      row(view({ ...lab, explain: 'always' }), 'research', 'energy').explanation
        ?.key,
    ).toBe('energy');
  });

  it('gives each kind its icon class', () => {
    const v = view({ P: { b: { yard: 1, lab: 1 } } });
    expect(row(v, 'research', 'energy').cls).toBe('ic-r');
    expect(row(v, 'ship', 'lf').cls).toBe('ic-s');
    expect(row(v, 'defense', 'rl').cls).toBe('ic-d');
  });
});

describe('buildings', () => {
  it('lists the buildings of the place in the order of the game', () => {
    const page = opened(catalogPage(view(), 'building'));
    expect(page.title).toBe('Gebäude');
    expect(page.line).toEqual({ id: 'fields', text: 'Felder: 0 / 163' });
    expect(page.queue).toEqual([]);
    expect(page.warn).toBeNull();
    expect(page.rows.map((r) => r.key)).toEqual(
      Object.keys(BUILD).filter((k) => buildable(k, 'planet')),
    );
    const moon = rows(catalogPage(view({ P: { kind: 'moon' } }), 'building'));
    expect(moon.map((r) => r.key)).toEqual(
      Object.keys(BUILD).filter((k) => buildable(k, 'moon')),
    );
    expect(moon.map((r) => r.key)).toContain('moonbase');
    expect(moon.map((r) => r.key)).not.toContain('metal');
  });

  it('shows the level, the cost of the next one and its time', () => {
    const v = view({ P: { b: { metal: 2 } } });
    const r = row(v, 'building', 'metal');
    const cost = lvlCost(BUILD.metal!, 3);
    expect(r.level).toBe('(Stufe 2)');
    expect(r.cost).toEqual(cost);
    expect(r.energy).toBeUndefined();
    expect(r.running).toBe(false);
    expect(r.req).toBeUndefined();
    expect(r.lines.at(-1)).toBe(`Bauzeit: ${dur(buildTime(cost, v.P, U))}`);
    expect(row(view(), 'building', 'metal').level).toBe('');
    expect(row(view(), 'building', 'fusion').req).toEqual(BUILD.fusion!.req);
  });

  it('shows how the next level changes the energy and the use', () => {
    expect(row(view(), 'building', 'metal').lines).toEqual([
      'Energie auf Stufe 1: 11 mehr Verbrauch',
      `Bauzeit: ${dur(buildTime(lvlCost(BUILD.metal!, 1), view().P, U))}`,
    ]);
    expect(row(view(), 'building', 'solar').lines[0]).toBe(
      'Energie auf Stufe 1: 22 mehr Produktion',
    );
    const fusion = row(
      view({ P: { b: { deut: 5, solar: 10 } }, research: { energy: 3 } }),
      'building',
      'fusion',
    ).lines;
    expect(fusion[0]).toMatch(/^Energie auf Stufe 1: [\d.,]+ mehr Produktion$/);
    expect(fusion[1]).toMatch(
      /^Promethiumverbrauch auf Stufe 1: [\d.,]+ pro Stunde$/,
    );
    expect(fusion).toHaveLength(3);
    expect(row(view(), 'building', 'robot').lines).toHaveLength(1);
  });

  it('starts a building, or upgrades it, when the planet can pay', () => {
    expect(action(view(), 'building', 'metal')).toEqual({
      kind: 'start',
      act: 'build',
      label: 'Bauen',
      disabled: false,
    });
    expect(
      action(view({ P: { b: { metal: 9 } } }), 'building', 'metal'),
    ).toEqual({
      kind: 'start',
      act: 'build',
      label: 'Ausbauen auf Stufe 10',
      disabled: true,
    });
  });

  it('shows the running upgrade with its progress', () => {
    const bq = {
      key: 'metal',
      lvl: 3,
      start: 1000,
      end: 11000,
      cost: NONE,
    };
    const v = view({ P: { b: { metal: 2 }, bq }, now: 5000 });
    expect(row(v, 'building', 'metal').running).toBe(true);
    expect(action(v, 'building', 'metal')).toEqual({
      kind: 'upgrading',
      down: false,
      level: 3,
      end: 11000,
      left: dur(6000),
      max: 10000,
      value: 4000,
    });
    const late = view({ P: { bq }, now: 20000 });
    expect(action(late, 'building', 'metal')).toMatchObject({ value: 10000 });
    expect(action(v, 'building', 'crystal')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Bauschleife belegt',
    });
    expect(row(v, 'building', 'crystal').running).toBe(false);
    // No „Zurückbauen“ while the queue runs (#202).
    expect(row(v, 'building', 'metal').demolish).toBe(false);
  });

  it('shows a running demolition as „Rückbau“ and offers „Zurückbauen“ only with a level (#202)', () => {
    const bq = {
      key: 'metal',
      lvl: 1,
      start: 1000,
      end: 11000,
      cost: NONE,
      back: NONE,
    };
    const v = view({ P: { b: { metal: 2 }, bq }, now: 5000 });
    expect(action(v, 'building', 'metal')).toMatchObject({
      kind: 'upgrading',
      down: true,
      level: 1,
    });
    const idle = view({ P: { b: { metal: 2 } } });
    expect(row(idle, 'building', 'metal').demolish).toBe(true);
    expect(row(idle, 'building', 'crystal').demolish).toBe(false);
  });

  it('names what a building waits for', () => {
    expect(action(view(), 'building', 'fusion')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
    const yard = view({
      P: { b: { robot: 2 }, sq: [{ key: 'lf', n: 1, unit: 1000 }] },
    });
    expect(action(yard, 'building', 'yard')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Schiffsschmiede arbeitet gerade',
    });
    const lab = view({
      rq: {
        key: 'energy',
        lvl: 1,
        start: 0,
        end: 1000,
        cost: NONE,
        planet: 'p1_1_5',
      },
    });
    expect(action(lab, 'building', 'lab')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Scholarium forscht gerade',
    });
    const full = view({ P: { unlimited: false, diameter: 1, b: {} } });
    expect(action(full, 'building', 'metal')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Keine freien Felder.',
    });
  });

  it('asks the energy production of the Weltenschmiede (#51)', () => {
    const v = view({
      P: { b: { nanite: 1, solar: 5 }, res: RICH },
      research: { energy: 12 },
    });
    const r = row(v, 'building', 'terraformer');
    const need = energyNeed(BUILD.terraformer!, 1);
    expect(need).toBeGreaterThan(0);
    expect(r.energy).toEqual({ need, production: expect.any(Number) });
    expect(r.energy!.production).toBeGreaterThan(0);
    expect(r.energy!.production).toBeLessThan(need);
    const short = energyShort(BUILD.terraformer!, 1, v.P, U, v.R.research);
    expect(short).toBe(Math.ceil(need - r.energy!.production));
    expect(r.action).toEqual({
      kind: 'note',
      cls: 'req',
      text: `Zu wenig Energie: es fehlen ${fmt(short)}`,
    });
  });

  it('counts a throttled Fusionskraftwerk as the check does (#47, review of #209)', () => {
    // Without Promethium the reactor runs throttled: `prod()` would count
    // its full 1,442 for the 1,000 the level needs, the check only 72.
    const v = view({
      P: { b: { nanite: 1, fusion: 10, deut: 1 }, res: { ...RICH, d: 0 } },
      research: { energy: 12 },
    });
    const r = row(v, 'building', 'terraformer');
    const made = production(v.P, U, v.R.research).eProd;
    expect(made).toBeLessThan(r.energy!.need);
    expect(r.energy).toEqual({ need: 1000, production: made });
    expect(r.action).toEqual({
      kind: 'note',
      cls: 'req',
      text: `Zu wenig Energie: es fehlen ${fmt(1000 - Math.floor(made))}`,
    });
  });
});

describe('research', () => {
  const lab = { P: { b: { lab: 1 } } };

  it('needs a lab, else names the own planets that have one (#49)', () => {
    expect(catalogPage(view(), 'research')).toEqual({
      blocked: true,
      title: 'Forschung',
      notice: 'Für Forschung brauchst du ein Scholarium.',
      places: [],
    });
    const v = view({
      labs: [
        { id: 'p1_1_5', lab: 0, upgrading: false },
        { id: 'p1_2_3', lab: 2, upgrading: false },
        { id: 'p1_2_4', lab: 0, upgrading: false },
        { id: 'p1_9_9', lab: 3, upgrading: false },
      ],
      galaxy: [
        { id: 'p1_2_3', name: 'Kolonie' },
        { id: 'p1_2_4', name: 'Leer' },
      ],
    });
    expect(catalogPage(v, 'research')).toEqual({
      blocked: true,
      title: 'Forschung',
      notice:
        'Auf diesem Planeten gibt es kein Scholarium. Geforscht wird auf einem deiner Planeten mit Scholarium.',
      places: [{ id: 'p1_2_3', name: 'Kolonie' }],
    });
    const here = view({
      labs: [{ id: 'p1_1_5', lab: 4, upgrading: false }],
      galaxy: [{ id: 'p1_1_5', name: 'Heimat' }],
    });
    expect(catalogPage(here, 'research')).toMatchObject({ places: [] });
  });

  it('lists every research on the planet with its lab', () => {
    const page = opened(catalogPage(view(lab), 'research'));
    expect(page.title).toBe('Forschung auf Heimat');
    expect(page.line).toEqual({ text: 'Scholarium Stufe 1' });
    expect(page.queue).toEqual([]);
    expect(page.warn).toBeNull();
    expect(page.rows.map((r) => r.key)).toEqual(Object.keys(RES));
    const moon = view({ P: { kind: 'moon', name: 'Luna', b: { lab: 1 } } });
    expect(opened(catalogPage(moon, 'research')).title).toMatch(
      /^Forschung auf .*Luna/,
    );
  });

  it('names how many labs the research network links', () => {
    const line = (ifn: number) =>
      opened(catalogPage(view({ ...lab, research: { ifn } }), 'research')).line
        ?.text;
    expect(line(1)).toBe(
      'Scholarium Stufe 1 · Sternennetz der Gelehrten: bis zu 1 weiteres Scholarium',
    );
    expect(line(2)).toBe(
      'Scholarium Stufe 1 · Sternennetz der Gelehrten: bis zu 2 weitere Scholarien',
    );
  });

  it('shows the level, the cost and the time with the linked labs', () => {
    const v = view({ ...lab, research: { energy: 2 } });
    const r = row(v, 'research', 'energy');
    const cost = lvlCost(RES.energy!, 3);
    expect(r.level).toBe('(Stufe 2)');
    expect(r.cost).toEqual(cost);
    expect(r.running).toBe(false);
    expect(r.req).toEqual(RES.energy!.req);
    expect(r.energy).toBeUndefined();
    expect(r.lines).toEqual([
      `Forschungszeit: ${dur(researchTime(cost, { b: { lab: 1 } }, U))}`,
    ]);
    expect(row(view(lab), 'research', 'energy').level).toBe('');
    const linked = view({
      P: { b: { lab: 4 } },
      research: { ifn: 1 },
      labs: [
        { id: 'p1_1_5', lab: 4, upgrading: false },
        { id: 'p1_2_3', lab: 6, upgrading: false },
      ],
    });
    const time = researchTime(lvlCost(RES.energy!, 1), { b: { lab: 10 } }, U);
    expect(row(linked, 'research', 'energy').lines).toEqual([
      `Forschungszeit: ${dur(time)} (Scholarien zusammen Stufe 10)`,
    ]);
  });

  it('starts a research when the planet can pay', () => {
    expect(action(view(lab), 'research', 'energy')).toEqual({
      kind: 'start',
      act: 'research',
      label: 'Forschen',
      disabled: true,
    });
    const rich = view({ P: { b: { lab: 1 }, res: RICH } });
    expect(action(rich, 'research', 'energy')).toMatchObject({
      disabled: false,
    });
    const v = view({ ...lab, research: { energy: 9 } });
    expect(action(v, 'research', 'energy')).toEqual({
      kind: 'start',
      act: 'research',
      label: 'Forschen (Stufe 10)',
      disabled: true,
    });
  });

  it('shows the running research and where it runs (#49)', () => {
    const rq = (planet?: string) => ({
      key: 'energy',
      lvl: 2,
      start: 0,
      end: 9000,
      cost: NONE,
      ...(planet && { planet }),
    });
    const galaxy = [{ id: 'p1_2_3', name: 'Kolonie' }];
    const here = view({ ...lab, rq: rq('p1_1_5'), now: 4000, galaxy });
    expect(action(here, 'research', 'energy')).toEqual({
      kind: 'researching',
      level: 2,
      place: 'Heimat',
      end: 9000,
      left: dur(5000),
    });
    const there = view({ ...lab, rq: rq('p1_2_3'), galaxy });
    expect(action(there, 'research', 'energy')).toMatchObject({
      place: 'Kolonie',
    });
    const main = view({ ...lab, rq: rq(), galaxy, mainPlanet: 'p1_2_3' });
    expect(action(main, 'research', 'energy')).toMatchObject({
      place: 'Kolonie',
    });
    const gone = view({ ...lab, rq: rq('p9_9_9'), galaxy });
    expect(action(gone, 'research', 'energy')).toMatchObject({ place: '' });
    const due = view({ ...lab, rq: rq('p1_1_5'), now: 9000 });
    expect(action(due, 'research', 'energy')).toMatchObject({ left: null });
    const other = view({ ...lab, rq: rq('p1_1_5'), research: { energy: 2 } });
    expect(action(other, 'research', 'laser')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Es wird bereits geforscht',
    });
  });

  it('names what a research waits for', () => {
    expect(action(view(lab), 'research', 'laser')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
    const upgrading = view({
      P: {
        b: { lab: 1 },
        bq: { key: 'lab', lvl: 2, start: 0, end: 1, cost: NONE },
      },
    });
    expect(action(upgrading, 'research', 'energy')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Scholarium wird ausgebaut',
    });
  });

  it('asks the energy production of the Gravitonforschung (#49)', () => {
    const v = view({ P: { b: { lab: 12, solar: 3 }, res: RICH } });
    const r = row(v, 'research', 'graviton');
    const need = energyNeed(RES.graviton!, 1);
    const made = production(v.P, U, {}).eProd;
    expect(made).toBeGreaterThan(0);
    expect(r.energy).toEqual({ need, production: made });
    expect(r.action).toEqual({
      kind: 'note',
      cls: 'req',
      text: `Zu wenig Energie: es fehlen ${fmt(energyShort(RES.graviton!, 1, v.P, U, {}))}`,
    });
  });
});

describe('shipyard and defense', () => {
  const yard = (P: Partial<Planet> = {}, o: Setup = {}): V =>
    view({ ...o, P: { ...P, b: { yard: 1, ...P.b } } });

  it('needs a shipyard', () => {
    expect(catalogPage(view(), 'ship')).toEqual({
      blocked: true,
      title: 'Schiffsschmiede',
      notice: 'Dafür brauchst du eine Orbitale Schiffsschmiede.',
      places: [],
    });
    expect(catalogPage(view(), 'defense')).toMatchObject({
      blocked: true,
      title: 'Verteidigung',
    });
  });

  it('lists every ship and every defense', () => {
    const ships = opened(catalogPage(yard(), 'ship'));
    expect(ships.title).toBe('Schiffsschmiede');
    expect(ships.line).toBeNull();
    expect(ships.warn).toBeNull();
    expect(ships.queue).toEqual([]);
    expect(ships.rows.map((r) => r.key)).toEqual(Object.keys(SHIPS));
    const defense = opened(catalogPage(yard(), 'defense'));
    expect(defense.title).toBe('Verteidigung');
    expect(defense.rows.map((r) => r.key)).toEqual(Object.keys(DEF));
  });

  it('counts the units of the planet; a shield dome once (#50)', () => {
    const v = yard({ ships: { lf: 1200 }, def: { ssd: 1 } });
    expect(row(v, 'ship', 'lf').level).toBe('(vorhanden: 1.200)');
    expect(row(v, 'ship', 'sc').level).toBe('(vorhanden: 0)');
    expect(row(v, 'defense', 'ssd').level).toBe('(vorhanden: 1 · max. 1)');
    expect(row(v, 'defense', 'rl').level).toBe('(vorhanden: 0)');
    const lf = row(v, 'ship', 'lf');
    expect(lf.cost).toEqual(SHIPS.lf!.cost);
    expect(lf.energy).toBeUndefined();
    expect(lf.running).toBe(false);
    expect(lf.req).toEqual(SHIPS.lf!.req);
    expect(lf.lines[1]).toBe(
      `Bauzeit: ${dur(unitTime(SHIPS.lf!, v.P, U))} je Einheit`,
    );
  });

  it('shows attack, shield and structure with the research', () => {
    const plain = row(yard(), 'defense', 'rl').lines[0];
    const d = DEF.rl!;
    expect(plain).toBe(
      `Angriff ${fmt(d.atk)} · Schild ${fmt(d.sh)} · Struktur ${fmt(d.cost[0] + d.cost[1])}`,
    );
    const tech = { weapons: 2, shield: 3, armor: 5 };
    const strong = row(yard({}, { research: tech }), 'defense', 'rl');
    expect(strong.lines[0]).toBe(
      `Angriff ${fmt(d.atk * 1.2)} · Schild ${fmt(d.sh * 1.3)} · Struktur ${fmt((d.cost[0] + d.cost[1]) * 1.5)}`,
    );
  });

  it('shows the cargo and the speed of a ship that flies, its drive when it switches (#57)', () => {
    const lf = row(yard(), 'ship', 'lf').lines[0];
    expect(lf).toBe(
      `Angriff 50 · Schild 10 · Struktur 4.000 · Ladung 50 · Tempo ${fmt(shipSpeed('lf', { research: {} }))}`,
    );
    const research = { hdrive: 8 };
    const bb = row(yard({}, { research }), 'ship', 'bb').lines[0];
    expect(bb).toMatch(
      new RegExp(
        ` · Ladung 500 · Tempo ${fmt(shipSpeed('bb', { research }))} \\(${text('hdrive')!.n}\\)$`,
      ),
    );
    const slow = row(yard(), 'ship', 'bb').lines[0];
    expect(slow).toMatch(new RegExp(` \\(${text('impulse')!.n}\\)$`));
  });

  it('gives the lines of a unit, and none for a key that is no unit (#285)', () => {
    const v = yard();
    expect(unitLines(v, 'lf')).toEqual(row(v, 'ship', 'lf').lines);
    expect(unitLines(v, 'rl')).toEqual(row(v, 'defense', 'rl').lines);
    expect(unitLines(v, 'metal')).toBeUndefined();
    expect(unitLines(v, 'spy')).toBeUndefined();
    expect(unitLines(v, 'nope')).toBeUndefined();
  });

  it('shows the energy of a Sonnenreliquiar per piece, and no cargo (#114)', () => {
    const sat = row(yard({ temp: 50 }), 'ship', 'sat').lines[0];
    expect(sat).toMatch(
      new RegExp(
        `^Angriff 1 · Schild 1 · Struktur 2.000 · Energie \\d+ ${text('sat')!.per}$`,
      ),
    );
  });

  it('orders as many units as the planet can pay and may have', () => {
    const v = yard({ res: RICH }, { research: { comb: 1, shield: 2 } });
    expect(action(v, 'ship', 'lf')).toEqual({
      kind: 'order',
      max: orderMax(v.P, 'lf'),
      once: false,
      disabled: false,
    });
    expect(action(v, 'defense', 'ssd')).toMatchObject({
      kind: 'order',
      once: true,
      max: 1,
    });
    const built = yard(
      { res: RICH, def: { ssd: 1 } },
      { research: { shield: 2 } },
    );
    expect(action(built, 'defense', 'ssd')).toMatchObject({
      max: 0,
      disabled: true,
    });
    const poor = yard({ res: { m: 0, c: 0, d: 0 } }, { research: { comb: 1 } });
    expect(action(poor, 'ship', 'lf')).toEqual({
      kind: 'order',
      max: 0,
      once: false,
      disabled: true,
    });
    expect(action(yard(), 'ship', 'lf')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
  });

  it('stops orders while a building of the lock is upgraded (#48)', () => {
    const bq = { key: 'yard', lvl: 2, start: 0, end: 1000, cost: NONE };
    const v = yard({ res: RICH, bq });
    expect(opened(catalogPage(v, 'ship')).warn).toBe(
      'Die Schiffsschmiede wird gerade ausgebaut und kann nicht produzieren.',
    );
    expect(opened(catalogPage(v, 'defense')).warn).toBe(
      opened(catalogPage(v, 'ship')).warn,
    );
    expect(action(v, 'defense', 'rl')).toMatchObject({
      kind: 'order',
      disabled: true,
    });
    expect(lockNotice('nanite')).toBe(
      'Die Machina-Schwarmhalle wird gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.',
    );
  });

  it('keeps its own order of the checks of an order (#214)', () => {
    const bq = { key: 'yard', lvl: 2, start: 0, end: 1000, cost: NONE };
    // The requirements before the lock, which the page names above the list.
    expect(action(yard({ res: RICH, bq }), 'ship', 'lf')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
    // 20 orders: only the server refuses them.
    const sq = Array.from({ length: 20 }, () => ({
      key: 'rl',
      n: 1,
      unit: 1,
    }));
    expect(action(yard({ res: RICH, sq }), 'defense', 'rl')).toMatchObject({
      kind: 'order',
      disabled: false,
    });
  });

  it('asks for a count before an order is sent (F10)', () => {
    const v = yard({ res: { m: 0, c: 0, d: 0 } });
    expect(orderNote(v, 'rl', 0)).toBe('Bitte eine Anzahl eingeben.');
    expect(orderNote(v, 'rl', 1)).toBeNull();
    expect(orderNote(yard({ res: RICH }), 'rl', 5)).toBeNull();
  });

  it('shows the orders of the shipyard', () => {
    const sq = [
      { key: 'lf', n: 2, unit: 5000 },
      { key: 'sc', n: 1200, unit: 3000 },
    ];
    const queue = (now: number, sqT: number | null = 1000) =>
      opened(catalogPage(yard({ sq, sqT }, { now }), 'defense')).queue;
    expect(queue(2000)).toEqual([
      {
        label: `2× ${text('lf')!.n}`,
        next: { end: 6000, left: dur(4000) },
        each: `je ${dur(5000)}`,
      },
      {
        label: `1.200× ${text('sc')!.n}`,
        next: null,
        each: `je ${dur(3000)}`,
      },
    ]);
    expect(queue(6000)[0]!.next).toEqual({ end: 6000, left: null });
    expect(queue(2000, null)[0]!.next).toEqual({ end: 7000, left: dur(5000) });
  });
});

describe('the notes of the checks of #214', () => {
  const busy = { key: 'metal', lvl: 1, start: 0, end: 9, cost: NONE };
  it('show the fields and the requirements before the build queue (F8)', () => {
    // 10,000 km: 100 fields, all taken.
    const full = view({
      P: { res: RICH, diameter: 10000, b: { metal: 100 }, bq: busy },
    });
    expect(action(full, 'building', 'crystal')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Keine freien Felder.',
    });
    const building = view({ P: { res: RICH, bq: busy } });
    expect(action(building, 'building', 'yard')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
    expect(action(building, 'building', 'crystal')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Bauschleife belegt',
    });
  });
  it('show the requirements before the running research (F9)', () => {
    const rq = { ...busy, key: 'spy', planet: 'p1_1_5' };
    const v = view({ P: { res: RICH, b: { lab: 1 } }, rq });
    expect(action(v, 'research', 'laser')).toEqual({
      kind: 'note',
      cls: 'req',
      text: 'Das Wissen ist noch verschlossen',
    });
    expect(action(v, 'research', 'energy')).toEqual({
      kind: 'note',
      cls: 'dim',
      text: 'Es wird bereits geforscht',
    });
  });
  it('disable „Bauen“ and „Forschen“ for the price only', () => {
    const poor = view({ P: { res: { m: 0, c: 0, d: 0 }, b: { lab: 1 } } });
    expect(action(poor, 'building', 'metal')).toMatchObject({
      kind: 'start',
      disabled: true,
    });
    expect(action(poor, 'research', 'energy')).toMatchObject({
      kind: 'start',
      disabled: true,
    });
    const rich = view({ P: { res: RICH, b: { lab: 1 } } });
    expect(action(rich, 'building', 'metal')).toMatchObject({
      kind: 'start',
      disabled: false,
    });
    expect(action(rich, 'research', 'energy')).toMatchObject({
      kind: 'start',
      disabled: false,
    });
  });
});
