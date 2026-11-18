// What the Lexicanum shows (#285): the pages, the articles with the
// player's state, the missions, and the helpers of the search.
import { describe, expect, it } from 'vitest';
import { RES, SHIPS } from '../../core/catalog.ts';
import { capOf } from '../../core/components/storage.ts';
import { lvlCost, prod } from '../../core/economy.ts';
import { ARTICLES } from '../../core/lexicon/articles.ts';
import { MISSION } from '../../core/missions.ts';
import { text } from '../../core/text.ts';
import type { Levels, Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { unitLines } from './catalog-list.ts';
import {
  type ArticleView,
  articleView,
  AZ,
  crumbs,
  flatHits,
  groupTitle,
  hitsLabel,
  listId,
  missionShips,
  moveMark,
  page,
  searchHits,
  type Section,
  type ViewBlock,
  viewBlock,
} from './lexicanum.ts';
import type { GameState } from './types.ts';

function view(P: Partial<Planet> = {}, research: Levels = {}): V {
  return {
    s: {
      cfg: U,
      me: { id: 'u1', explain: 'icon' },
      labs: [],
      galaxy: [],
      mainPlanet: 'p',
    } as unknown as GameState,
    P: planet({ res: { m: 0, c: 0, d: 0 }, ...P }),
    R: { research, rq: null },
    now: 0,
    ui: { openEx: {} } as unknown as Ui,
  };
}

const art = (id: string, v = view()): ArticleView => articleView(id, v)!;
const section = (a: ArticleView, id: string): Section | undefined =>
  a.sections.find((s) => s.id === id);
const blocks = (a: ArticleView, id: string): ViewBlock[] =>
  section(a, id)?.blocks ?? [];
const of = <T extends ViewBlock['t']>(
  bs: ViewBlock[],
  t: T,
): Extract<ViewBlock, { t: T }>[] =>
  bs.filter((b): b is Extract<ViewBlock, { t: T }> => b.t === t);

describe('the pages of the Lexicanum', () => {
  it('starts with the kinds and „Begriffe A–Z“, for an empty or unknown id', () => {
    for (const id of ['', 'nope']) {
      const p = page(id, view());
      expect(p.t).toBe('start');
      if (p.t !== 'start') return;
      expect(p.tiles.map((t) => t.title)).toEqual([
        'Gebäude',
        'Forschung',
        'Schiffe',
        'Verteidigung',
        'Missionen',
        'Begriffe A–Z',
      ]);
      expect(p.tiles[0]).toEqual({
        id: 'list-building',
        title: 'Gebäude',
        note: `${ARTICLES.filter((a) => a.kind === 'building').length} Einträge`,
      });
      expect(p.tiles[5]).toEqual({
        id: AZ,
        title: 'Begriffe A–Z',
        note: 'alle Namen und Kürzel',
      });
      expect(crumbs(p)).toEqual([{ id: null, text: 'Lexicanum' }]);
    }
  });

  it('lists the articles of a kind and all of them A to Z', () => {
    const list = page(listId('research'), view());
    if (list.t !== 'list') throw new Error(list.t);
    expect(list.title).toBe('Forschung');
    expect(list.items.map((i) => i.id)).toEqual(Object.keys(RES));
    expect(list.items.find((i) => i.id === 'spy')).toEqual({
      id: 'spy',
      title: 'Auspex-Lehre',
      ab: 'AU',
      line: text('spy')!.ds,
    });
    expect(crumbs(list)).toEqual([
      { id: '', text: 'Lexicanum' },
      { id: null, text: 'Forschung' },
    ]);
    const az = page(AZ, view());
    if (az.t !== 'list') throw new Error(az.t);
    expect(az.items).toHaveLength(ARTICLES.length);
    const titles = az.items.map((i) => i.title);
    expect(titles).toEqual(
      [...titles].sort((a, b) => a.localeCompare(b, 'de')),
    );
    expect(az.items.find((i) => i.id === 'mission-spy')).toEqual({
      id: 'mission-spy',
      title: 'Auspex-Erkundung',
      line: '',
    });
  });

  it('shows an article with its path', () => {
    const p = page('spy', view());
    if (p.t !== 'article') throw new Error(p.t);
    expect(crumbs(p)).toEqual([
      { id: '', text: 'Lexicanum' },
      { id: 'list-research', text: 'Forschung' },
      { id: null, text: 'Auspex-Lehre' },
    ]);
    expect(articleView('nope', view())).toBeNull();
  });
});

describe('an article of a catalog entry', () => {
  it('has the texts of the catalog, the own level and the kind', () => {
    const a = art('spy', view({ b: { lab: 3 } }, { spy: 4 }));
    expect(a).toMatchObject({
      id: 'spy',
      kind: 'research',
      kindTitle: 'Forschung',
      title: 'Auspex-Lehre',
      ab: 'AU',
      ds: text('spy')!.ds,
      icon: '/icons/research/espionage_technology.svg',
      cls: 'ic-r',
      own: 'deine Stufe 4',
      lines: [],
    });
    expect(a.intro).toEqual(text('spy')!.lt!.split('\n\n'));
    expect(a.cost).toBeUndefined();
    expect(a.sections.map((s) => [s.id, s.title])).toEqual([
      ['effect', 'Was die Stufen bringen'],
      ['levels', 'Stufen'],
      ['req', 'Voraussetzungen'],
      ['used', 'Wird gebraucht für'],
      ['see', 'Siehe auch'],
    ]);
    expect(a.siblings.map((s) => s.id)).toEqual(Object.keys(RES));
  });

  it('computes „Was die Stufen bringen“ of the Auspex-Lehre from the rules', () => {
    const a = art('spy', view({ ships: { probe: 12 } }, { spy: 4 }));
    const bs = blocks(a, 'effect');
    const text0 = of(bs, 'text')[0]!.parts;
    expect(text0.filter((p) => 'link' in p)).toEqual([
      { text: 'Auspex-Erkundung', link: 'mission-spy' },
      { text: 'Spähschädel', link: 'probe' },
    ]);
    expect(text0.map((p) => p.text).join('')).toContain(
      'eine Stufe voraus bringt 1 Punkt, zwei bringen 4, drei schon 9.',
    );
    expect(of(bs, 'formula').map((f) => f.lines[0])).toEqual([
      'Auspex-Wert = Spähschädel + Vorsprung² (bei Rückstand: − Rückstand²)',
      'Gefahr = 2 % · √Schiffe am Ziel ÷ 2^Vorsprung (höchstens 100 %)',
    ]);
    expect(of(bs, 'stand')).toEqual([
      {
        t: 'stand',
        text: 'Dein Stand: Stufe 4 und 12 Spähschädel. Gegen ein Ziel mit Stufe 4 zeigt der Bericht alles; gegen Stufe 7 brauchst du 16 für die Forschung.',
      },
    ]);
    const [probes, danger] = of(bs, 'table');
    expect(probes!.head).toEqual([
      'Vorsprung in Auspex-Lehre',
      'Rohstoffe',
      'Flotte',
      'Verteidigung',
      'Gebäude',
      'Forschung',
    ]);
    expect(probes!.rows[3]!.cells.map((c) => c.text)).toEqual([
      'gleich',
      '1',
      '2',
      '3',
      '5',
      '7',
    ]);
    expect(probes!.rows[0]!.cells[0]).toEqual({ text: '−3 (Ziel führt)' });
    expect(probes!.rows[6]!.cells[0]!.text).toBe('+3 (du führst)');
    expect(probes!.rows[0]!.cells[5]).toEqual({ text: '16', num: true });
    expect(danger!.rows[1]!.cells.map((c) => c.text)).toEqual([
      '100 Schiffe am Ziel',
      '80 %',
      '40 %',
      '20 %',
      '10 %',
      '5 %',
    ]);
    const few = art('spy', view({ ships: { probe: 3 } }, { spy: 2 }));
    expect(of(blocks(few, 'effect'), 'stand')[0]!.text).toBe(
      'Dein Stand: Stufe 2 und 3 Spähschädel. Gegen ein Ziel mit Stufe 2 brauchst du 7 für die Forschung.',
    );
  });

  it('shows the level table with the effect and „Dein Stand“ (B5)', () => {
    const a = art('computer', view({}, { computer: 3 }));
    expect(of(blocks(a, 'effect'), 'formula')[0]!.lines).toEqual([
      'Flottenslots = 1 + Stufe',
    ]);
    expect(of(blocks(a, 'effect'), 'stand')).toEqual([
      { t: 'stand', text: 'Dein Stand: Stufe 3 · Flottenslots 4' },
    ]);
    const levels = blocks(a, 'levels');
    expect(of(levels, 'formula')[0]!.lines).toEqual([
      'Kosten = Kosten der Stufe 1 · 2^(Stufe − 1)',
    ]);
    const table = of(levels, 'levels')[0]!.table;
    expect(table.effect).toEqual({ label: 'Flottenslots' });
    expect(table.rows[0]).toMatchObject({ level: 3, current: true, effect: 4 });
    expect(table.rows[1]).toMatchObject({
      level: 4,
      current: false,
      effect: 5,
      cost: lvlCost(RES.computer!, 4),
    });
    // No „Dein Stand“ before the first level.
    expect(of(blocks(art('computer'), 'effect'), 'stand')).toEqual([]);
  });

  it('gives a store its capacity and a producer its rate per level', () => {
    const store = art('smetal', view({ b: { smetal: 2 } }));
    expect(of(blocks(store, 'effect'), 'formula')[0]!.lines[0]).toContain(
      'Lagerkapazität = ',
    );
    const t = of(blocks(store, 'levels'), 'levels')[0]!.table;
    expect(t.effect).toEqual({ label: 'Lagerkapazität' });
    expect(t.rows[0]).toMatchObject({ level: 2, effect: capOf(2, U) });
    // Full share and energy: the rate of the mine, as prod() adds it.
    const P = { b: { metal: 7, solar: 30 }, pct: {} };
    const mine = art('metal', view(P));
    const rows = of(blocks(mine, 'levels'), 'levels')[0]!.table;
    // The rate assumes enough energy; the heading says so (owner, 2026-11-17).
    expect(rows.effect).toEqual({ label: 'Adamant/h bei voller Energie' });
    for (const [key, label] of [
      ['crystal', 'Psikristall/h bei voller Energie'],
      ['deut', 'Promethium/h bei voller Energie'],
    ] as const)
      expect(
        of(blocks(art(key, view({ b: { [key]: 1 } })), 'levels'), 'levels')[0]!
          .table.effect,
      ).toEqual({ label });
    const v = view(P);
    expect(rows.rows[0]!.effect).toBeCloseTo(
      prod(v.P, U).m - prod({ ...v.P, b: { solar: 30 } }, U).m,
      6,
    );
    const solar = of(
      blocks(art('solar', view({ b: { solar: 1 } })), 'levels'),
      'levels',
    )[0]!.table;
    expect(solar.effect).toEqual({ label: 'Energie' });
    expect(solar.rows[0]!.effect).toBeGreaterThan(0);
    // An entry without an effect has no such section.
    expect(section(art('robot'), 'effect')).toBeUndefined();
  });

  it('lists the requirements met or not, and what needs the entry', () => {
    const met = blocks(art('spy', view({ b: { lab: 3 } })), 'req');
    expect(met).toEqual([
      {
        t: 'links',
        items: [{ id: 'lab', text: 'Scholarium 3', note: 'erfüllt' }],
      },
    ]);
    const unmet = of(
      blocks(art('spy', view({ b: { lab: 1 } })), 'req'),
      'links',
    );
    expect(unmet[0]!.items[0]!.note).toBe('aktuell 1');
    const used = of(blocks(art('spy'), 'used'), 'table')[0]!;
    expect(used.head).toEqual(['Schaltet frei', 'Art', 'Auspex-Lehre']);
    expect(used.rows[0]!.cells).toEqual([
      { text: 'Spähschädel', link: 'probe' },
      { text: 'Schiffe' },
      { text: 'ab Stufe 2', num: true },
    ]);
    expect(section(art('metal'), 'req')).toBeUndefined();
  });

  it('shows the values of a unit as the lists do and links its mission', () => {
    const v = view({ ships: { probe: 7 } });
    const a = art('probe', v);
    expect(a).toMatchObject({
      kind: 'ship',
      own: 'vorhanden: 7',
      cost: SHIPS.probe!.cost,
      lines: unitLines(v, 'probe'),
      cls: 'ic-s',
    });
    expect(section(a, 'levels')).toBeUndefined();
    expect(blocks(a, 'see')).toEqual([
      {
        t: 'links',
        items: [{ id: 'mission-spy', text: 'Auspex-Erkundung' }],
      },
    ]);
    expect(art('rl', view({ def: { rl: 2 } })).own).toBe('vorhanden: 2');
    expect(blocks(art('spy'), 'see')).toEqual([
      {
        t: 'links',
        items: [
          { id: 'probe', text: 'Spähschädel' },
          { id: 'mission-spy', text: 'Auspex-Erkundung' },
          { id: 'phalanx', text: 'Auspex-Phalanx' },
        ],
      },
    ]);
  });
});

describe('an article of a mission', () => {
  it('knows which ships a mission takes, from its own check', () => {
    expect(missionShips('spy')).toEqual({ only: true, ships: ['probe'] });
    expect(missionShips('colonize')).toEqual({
      only: false,
      ships: ['colony'],
    });
    expect(missionShips('harvest')).toEqual({
      only: false,
      ships: ['recycler'],
    });
    expect(missionShips('attack')).toBeNull();
  });

  it('shows the facts of its rules and links its ships', () => {
    const a = art('mission-spy');
    expect(a).toMatchObject({
      kind: 'mission',
      title: 'Auspex-Erkundung',
      icon: null,
      own: null,
      intro: [],
      cls: 'ic-m',
    });
    expect(a.sections.map((s) => s.id)).toEqual(['mission', 'see']);
    const facts = of(blocks(a, 'mission'), 'facts')[0]!.items;
    expect(
      facts.map((f) => [f.label, f.parts.map((p) => p.text).join('')]),
    ).toEqual([
      ['Ziel', 'fremder Planet'],
      ['Ladung', 'nein'],
      ['Rückflug', 'ja'],
      ['Eigener Bericht bei der Heimkehr', 'nein'],
      ['Schiffe', 'nur Spähschädel'],
    ]);
    expect(facts[4]!.parts[1]).toEqual({ text: 'Spähschädel', link: 'probe' });
    const attack = of(blocks(art('mission-attack'), 'mission'), 'facts')[0]!;
    expect(attack.items.map((f) => f.label)).not.toContain('Schiffe');
    const deploy = of(blocks(art('mission-deploy'), 'mission'), 'facts')[0]!;
    expect(deploy.items.slice(0, 3).map((f) => f.parts[0]!.text)).toEqual([
      'eigener Planet',
      'ja',
      'nein',
    ]);
    expect(section(art('mission-attack'), 'see')).toBeUndefined();
  });

  it('says what happens on arrival before the facts, with its links', () => {
    for (const m of Object.keys(MISSION)) {
      const all = blocks(art(`mission-${m}`), 'mission');
      expect(all.map((b) => b.t)).toEqual(['text', 'facts']);
    }
    const text = of(blocks(art('mission-spy'), 'mission'), 'text')[0]!;
    expect(text.parts[0]!.text).toMatch(/^Am Ziel entsteht ein Auspex-Bericht/);
    expect(text.parts).toContainEqual({ text: 'Auspex-Lehre', link: 'spy' });
    // The search shows its first sentence below the hit of the mission.
    const hit = flatHits(searchHits('Landnahme'))[0]!;
    expect(hit).toMatchObject({ id: 'mission-colonize' });
    expect(hit.line).toBe(
      'Am Ziel gründet eine Kolonistenarche die neue Kolonie und bleibt dort; die Ladung der Flotte wird der erste Vorrat der Kolonie.',
    );
    // A keyword finds the mission, and the entry with the same word first.
    expect(flatHits(searchHits('plündern')).map((h) => h.id)).toEqual([
      'mission-attack',
    ]);
    expect(flatHits(searchHits('ausspähen')).map((h) => h.id)).toEqual([
      'spy',
      'probe',
      'mission-spy',
    ]);
  });
});

describe('the blocks and the search', () => {
  it('turns the data into what the components draw', () => {
    expect(viewBlock({ t: 'text', text: 'Mit [[probe]].' })).toEqual({
      t: 'text',
      parts: [
        { text: 'Mit ' },
        { text: 'Spähschädel', link: 'probe' },
        { text: '.' },
      ],
    });
    expect(
      viewBlock({
        t: 'links',
        items: [{ id: 'spy' }, { id: 'x', text: 'X', note: 'n' }],
      }),
    ).toEqual({
      t: 'links',
      items: [
        { id: 'spy', text: 'Auspex-Lehre' },
        { id: 'x', text: 'X', note: 'n' },
      ],
    });
    expect(viewBlock({ t: 'links', items: [{ id: 'zz' }] })).toEqual({
      t: 'links',
      items: [{ id: 'zz', text: 'zz' }],
    });
    expect(
      viewBlock({
        t: 'table',
        head: ['a'],
        rows: [{ cells: ['x', 1234] }, { cells: ['y'], mark: true }],
      }),
    ).toEqual({
      t: 'table',
      head: ['a'],
      rows: [
        { cells: [{ text: 'x' }, { text: '1.234', num: true }] },
        { cells: [{ text: 'y' }], mark: true },
      ],
    });
    expect(viewBlock({ t: 'stand', text: 's' })).toEqual({
      t: 'stand',
      text: 's',
    });
  });

  it('finds, groups and walks the hits', () => {
    const groups = searchHits('Auspex');
    const titles = groups.map(groupTitle);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toEqual(expect.arrayContaining(['Forschung', 'Missionen']));
    const hits = flatHits(groups);
    expect(hits.map((h) => h.id)).toContain('spy');
    expect(hits.map((h) => h.id)).toContain('mission-spy');
    expect(searchHits('')).toEqual([]);
    expect(hitsLabel(5)).toBe('5 Treffer');
    expect(moveMark(-1, 3, 'ArrowDown')).toBe(0);
    expect(moveMark(2, 3, 'ArrowDown')).toBe(0);
    expect(moveMark(0, 3, 'ArrowUp')).toBe(2);
    expect(moveMark(-1, 3, 'ArrowUp')).toBe(2);
    expect(moveMark(1, 3, 'ArrowUp')).toBe(0);
    expect(moveMark(1, 3, 'x')).toBe(1);
    expect(moveMark(1, 0, 'ArrowDown')).toBe(-1);
  });
});
