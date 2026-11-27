// What the Lexicanum shows (#285): the pages, the articles with the
// player's state, the missions, and the helpers of the search.
import { describe, expect, it } from 'vitest';
import { DEF, RES, SHIPS } from '../../core/catalog.ts';
import { capOf } from '../../core/components/storage.ts';
import { lvlCost, prod } from '../../core/economy.ts';
import { ARTICLES } from '../../core/lexicon/articles.ts';
import { MISSION } from '../../core/missions.ts';
import { text } from '../../core/text.ts';
import type { Levels, Planet } from '../../core/types.ts';
import { planet, roundDefaults, U } from '../../test/fixtures.ts';
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
  markOf,
  moveMark,
  opens,
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
      round: { number: 1, ...roundDefaults() },
      me: { id: 'u1', explain: 'icon' },
      labs: [],
      players: {},
      fleets: [],
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
    expect(az.title).toBe('Begriffe A–Z');
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

  it('gives every kind of article its own icon class', () => {
    expect(
      ['metal', 'spy', 'sc', 'll', 'mission-spy'].map((id) => art(id).cls),
    ).toEqual(['ic-b', 'ic-r', 'ic-s', 'ic-d', 'ic-m']);
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
      'Höchste Chance auf Auspex-Abwehr in % = Spähschädel ÷ 4 · Auspex-Lehre des Ziels ÷ deine Auspex-Lehre · (1 + Schiffe am Ziel ÷ 100) (höchstens 100)',
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
    expect(danger!.caption).toBe(
      'Höchste Chance auf Auspex-Abwehr bei gleicher Auspex-Lehre',
    );
    expect(danger!.head).toEqual([
      'Schiffe am Ziel',
      '1 Spähschädel',
      '4 Spähschädel',
      '12 Spähschädel',
      '40 Spähschädel',
    ]);
    expect(danger!.rows[2]!.cells.map((c) => c.text)).toEqual([
      '100',
      '0,5 %',
      '2 %',
      '6 %',
      '20 %',
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
    expect(table.effects).toEqual([{ label: 'Flottenslots' }]);
    expect(table.rows[0]).toMatchObject({
      level: 3,
      current: true,
      values: [4],
    });
    expect(table.rows[1]).toMatchObject({
      level: 4,
      current: false,
      values: [5],
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
    expect(t.effects).toEqual([{ label: 'Lagerkapazität' }]);
    expect(t.rows[0]).toMatchObject({ level: 2, values: [capOf(2, U)] });
    // Full share and energy: the rate of the mine, as prod() adds it.
    const P = { b: { metal: 7, solar: 30 }, pct: {} };
    const mine = art('metal', view(P));
    const rows = of(blocks(mine, 'levels'), 'levels')[0]!.table;
    // The rate assumes enough energy; the heading says so (owner, 2026-11-17).
    expect(rows.effects).toEqual([{ label: 'Adamant/h bei voller Energie' }]);
    for (const [key, label] of [
      ['crystal', 'Psikristall/h bei voller Energie'],
      ['deut', 'Promethium/h bei voller Energie'],
    ] as const)
      expect(
        of(blocks(art(key, view({ b: { [key]: 1 } })), 'levels'), 'levels')[0]!
          .table.effects,
      ).toEqual([{ label }]);
    const v = view(P);
    expect(rows.rows[0]!.values[0]).toBeCloseTo(
      prod(v.P, U).m - prod({ ...v.P, b: { solar: 30 } }, U).m,
      6,
    );
    const solar = of(
      blocks(art('solar', view({ b: { solar: 1 } })), 'levels'),
      'levels',
    )[0]!.table;
    expect(solar.effects).toEqual([{ label: 'Energie' }]);
    expect(solar.rows[0]!.values[0]).toBeGreaterThan(0);
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
    // Selected by its link, not by position: a new entry that needs the
    // Auspex-Lehre (#190, Auspex-Kartographie) joins the rows.
    const rowOf = (id: string) =>
      used.rows.find((r) => (r.cells[0] as { link: string }).link === id);
    expect(rowOf('probe')!.cells).toEqual([
      { text: 'Spähschädel', link: 'probe' },
      { text: 'Schiffe' },
      { text: 'ab Stufe 2', num: true },
    ]);
    expect(rowOf('carto')!.cells).toEqual([
      { text: 'Auspex-Kartographie', link: 'carto' },
      { text: 'Forschung' },
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
    // A Wache stellen takes every ship, though its own check asks for an ally (#55).
    expect(missionShips('hold')).toBeNull();
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

  it('names the target, cargo, return, report and ships of every mission', () => {
    const facts = (m: string): [string, string][] =>
      of(blocks(art(`mission-${m}`), 'mission'), 'facts')[0]!.items.map((f) => [
        f.label,
        f.parts.map((p) => p.text).join(''),
      ]);
    const common = (
      target: string,
      cargo: string,
      back: string,
      report: string,
    ): [string, string][] => [
      ['Ziel', target],
      ['Ladung', cargo],
      ['Rückflug', back],
      ['Eigener Bericht bei der Heimkehr', report],
    ];
    expect(facts('attack')).toEqual(common('fremder Planet', 'ja', 'ja', 'ja'));
    expect(facts('deploy')).toEqual(
      common('eigener Planet', 'ja', 'nein', 'ja'),
    );
    expect(facts('transport')).toEqual(
      common('jeder Planet', 'ja', 'ja', 'ja'),
    );
    expect(facts('colonize')).toEqual([
      ...common('Freie Position', 'ja', 'ja', 'ja'),
      ['Schiffe', 'braucht Kolonistenarche'],
    ]);
    expect(facts('harvest')).toEqual([
      ...common('Trümmerfeld', 'nein', 'ja', 'ja'),
      ['Schiffe', 'braucht Bergungsbarke'],
    ]);
    // [V]: the target kind of #55 is named after the refusal of the mission.
    expect(facts('hold')).toEqual(
      common('Planet eines Gildenmitglieds oder Freundes', 'ja', 'ja', 'ja'),
    );
  });

  it('finds a Wache stellen by its keywords, with the first sentence of its text below the hit (#55)', () => {
    for (const word of ['verteidigen', 'stationieren', 'beistehen'])
      expect(flatHits(searchHits(word)).map((h) => h.id)).toContain(
        'mission-hold',
      );
    const hit = flatHits(searchHits('Wache stellen'))[0]!;
    expect(hit).toMatchObject({ id: 'mission-hold' });
    expect(hit.line).toBe(
      'Am Ziel, dem Planeten eines Gildenmitglieds oder Freundes, bleibt die Flotte für die Haltezeit, die du beim Start wählst (von 0 bis 32 Stunden), und verteidigt den Planeten in jedem Kampf zusammen mit seinem Besitzer.',
    );
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
    // The rule page and the question of #288 have the word too, after them.
    expect(flatHits(searchHits('ausspähen')).map((h) => h.id)).toEqual([
      'spy',
      'probe',
      'mission-spy',
      'rule-spy',
      'faq-intel',
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

describe('the rule pages, the questions and the start page of #288', () => {
  const rule = (id: string, v = view()): ArticleView => art(id, v);

  it('shows the boxes „Einstieg“, „Regeln“ and „Häufige Fragen“ on the start page, none of them empty', () => {
    const p = page('', view());
    if (p.t !== 'start') throw new Error(p.t);
    expect(p.boxes.map((b) => [b.kind, b.title])).toEqual([
      ['guide', 'Einstieg'],
      ['rule', 'Regeln'],
      ['question', 'Häufige Fragen'],
    ]);
    expect(p.boxes[0]!.items.map((i) => i.id)).toEqual([
      'guide-start',
      'guide-colony',
      'guide-fleet',
      'guide-defense',
      'guide-next',
    ]);
    const rules = p.boxes.find((b) => b.kind === 'rule')!;
    expect(rules.title).toBe('Regeln');
    expect(rules.items.map((i) => i.id)).toEqual(
      ARTICLES.filter((a) => a.kind === 'rule').map((a) => a.id),
    );
    expect(rules.items[0]).toEqual({
      id: 'rule-battle',
      title: 'Kampf',
      line: expect.stringMatching(/^Wie ein Kampf abläuft/) as string,
    });
    for (const box of p.boxes) expect(box.items.length).toBeGreaterThan(0);
  });

  it('lists the rule pages and the questions, and finds them in „Begriffe A–Z“', () => {
    const list = page(listId('question'), view());
    if (list.t !== 'list') throw new Error(list.t);
    expect(list.title).toBe('Häufige Fragen');
    expect(list.items.map((i) => i.id)).toContain('faq-intel');
    const az = page(AZ, view());
    if (az.t !== 'list') throw new Error(az.t);
    expect(az.items.map((i) => i.id)).toContain('rule-universe');
  });

  it('draws a rule page from the rules and the round of the state', () => {
    const a = rule('rule-vacation');
    expect(a).toMatchObject({
      kind: 'rule',
      kindTitle: 'Regeln',
      title: 'Urlaubsmodus',
      icon: null,
      own: null,
      intro: [],
    });
    expect(a.ds).toMatch(/^Wie du das Spiel pausierst/);
    const end = of(blocks(a, 'end'), 'text')[0]!;
    expect(end.parts.map((x) => x.text).join('')).toContain(
      'in dieser Runde 48 Stunden',
    );
    // The admin changes the minimum duration: the page follows.
    const v = view();
    v.s.round = { ...v.s.round, vacationHours: 72 };
    const changed = of(blocks(rule('rule-vacation', v), 'end'), 'text')[0]!;
    expect(changed.parts.map((x) => x.text).join('')).toContain(
      'in dieser Runde 72 Stunden',
    );
  });

  it('draws formulas, links in tables and the list of „Siehe auch“', () => {
    const a = rule('rule-battle');
    expect(blocks(a, 'rapid').map((b) => b.t)).toEqual([
      'text',
      'formula',
      'text',
      'table',
    ]);
    const table = of(blocks(a, 'rapid'), 'table')[0]!;
    expect(table.rows[0]!.cells[0]).toMatchObject({ link: expect.any(String) });
    expect(of(blocks(a, 'rapid'), 'formula')[0]!.lines).toEqual([
      'Chance auf einen weiteren Schuss = (Schnellfeuer − 1) ÷ Schnellfeuer',
    ]);
    const see = of(blocks(a, 'see'), 'links')[0]!;
    expect(see.items.map((i) => i.id)).toContain('mission-attack');
    expect(see.items[0]).toEqual({ id: 'weapons', text: 'Waffensegnung' });
  });

  it('has a path through its kind and the other pages of the kind at its side', () => {
    const p = page('faq-slots', view());
    if (p.t !== 'article') throw new Error(p.t);
    expect(crumbs(p)).toEqual([
      { id: '', text: 'Lexicanum' },
      { id: 'list-question', text: 'Häufige Fragen' },
      { id: null, text: 'Wie bekomme ich mehr Flottenslots?' },
    ]);
    expect(p.article.siblings.map((s) => s.id)).toContain('faq-intel');
    expect(p.article.sections.map((s) => s.id)).toEqual([
      'answer',
      'steps',
      'values',
      'see',
    ]);
  });

  it('shows the own state in a question: slots, Auspex-Lehre and Spähschädel', () => {
    const v = view({ ships: { probe: 12 } }, { computer: 3, spy: 4 });
    const slots = of(blocks(rule('faq-slots', v), 'values'), 'stand')[0]!;
    expect(slots.text).toBe(
      'Dein Stand: Stufe 3 der Kogitator-Doktrin, 4 Flottenslots.',
    );
    const intel = of(blocks(rule('faq-intel', v), 'values'), 'stand')[0]!;
    expect(intel.text).toContain('Stufe 4 der Auspex-Lehre und 12 Spähschädel');
  });
});

describe('the guides and the personal hints of #289', () => {
  it('computes „Deine nächsten Ziele“ from the shown planet and the research', () => {
    // Ten levels of a mine and no power: energy is short, and the Scholarium is near.
    const v = view({ b: { metal: 10, lab: 2 }, res: { m: 1, c: 1, d: 0 } });
    const a = art('guide-next', v);
    expect(a).toMatchObject({
      kind: 'guide',
      kindTitle: 'Einstieg',
      own: null,
    });
    const texts = of(blocks(a, 'now'), 'text').map((t) =>
      t.parts.map((x) => x.text).join(''),
    );
    expect(texts[1]).toMatch(
      /^Dir fehlt Energie: .* nur mit [\d,]+ % ihrer Leistung/,
    );
    expect(texts.join(' ')).toContain(
      'Auspex-Lehre zu bekommen: Scholarium steht auf Stufe 2',
    );
    expect(of(blocks(a, 'stand'), 'stand')[0]!.text).toBe(
      'Dein Stand: Planeten: 0 · Flotten unterwegs: 0 · Punkte: 0',
    );
    // A hint links its words to articles of the Lexicanum.
    const links = of(blocks(a, 'now'), 'text')[1]!.parts.filter(
      (x) => 'link' in x,
    );
    expect(links.map((x) => 'link' in x && x.link)).toContain('solar');
  });

  it('names a requirement that is one level away, for a planet in order', () => {
    const v = view(
      {
        b: { metal: 2, crystal: 1, solar: 8, lab: 10 },
        res: { m: 10, c: 10, d: 0 },
      },
      { computer: 20 },
    );
    const text = of(blocks(art('guide-next', v), 'now'), 'text').map((t) =>
      t.parts.map((x) => x.text).join(''),
    );
    expect(
      text.slice(1).every((t) => t.startsWith('Dir fehlt noch eine Stufe')),
    ).toBe(true);
  });

  it('draws a guide with its steps, its numbers from the catalog and the universe', () => {
    const a = art('guide-start');
    const begin = of(blocks(a, 'begin'), 'text')[0]!;
    expect(begin.parts.map((x) => x.text).join('')).toContain(
      'mit 500 Adamant und 500 Psikristall',
    );
    const steps = of(blocks(a, 'steps'), 'facts')[0]!;
    expect(steps.items.map((i) => i.label)).toEqual(
      steps.items.map((_, i) => `Schritt ${i + 1}`),
    );
    expect(steps.items[0]!.parts.map((x) => x.text).join('')).toContain(
      'Die erste Stufe kostet 60 Adamant und 15 Psikristall beziehungsweise 48 Adamant und 24 Psikristall',
    );
    // A guide links the others of the Einstieg.
    const links = steps.items
      .flatMap((i) => i.parts)
      .filter((x) => 'link' in x);
    expect(links.map((x) => 'link' in x && x.link)).toEqual(
      expect.arrayContaining(['guide-fleet', 'guide-colony', 'guide-next']),
    );
  });

  it('lists the missions of the fleet form with their targets, and no missile', () => {
    const table = of(blocks(art('guide-fleet'), 'missions'), 'table')[0]!;
    expect(table.rows).toHaveLength(Object.keys(MISSION).length - 1);
    const attack = table.rows.find(
      (r) => r.cells[0]!.link === 'mission-attack',
    )!;
    expect(attack.cells.map((c) => c.text)).toEqual([
      'Sturmangriff',
      'fremder Planet',
      'ja',
      'ja',
    ]);
  });
});

describe('what an article holds and what it leaves out', () => {
  const kinds = (a: ArticleView, id: string): string[] =>
    blocks(a, id).map((b) => b.t);

  it('has the blocks of „Was die Stufen bringen“ and nothing else, with and without a level', () => {
    expect(kinds(art('computer'), 'effect')).toEqual(['text', 'formula']);
    expect(kinds(art('computer', view({}, { computer: 3 })), 'effect')).toEqual(
      ['text', 'formula', 'stand'],
    );
    // A store has its capacity as a formula of its own.
    expect(kinds(art('smetal', view({ b: { smetal: 2 } })), 'effect')).toEqual([
      'text',
      'formula',
      'stand',
    ]);
  });

  it('has no column of effects for an entry without an effect, and no section of effects', () => {
    const a = art('robot');
    expect(section(a, 'effect')).toBeUndefined();
    expect(of(blocks(a, 'levels'), 'levels')[0]!.table.effects).toEqual([]);
  });

  it('has no „Wird gebraucht für“ for an entry nothing needs', () => {
    expect(section(art('phalanx'), 'used')).toBeUndefined();
    expect(section(art('metal'), 'used')).toBeUndefined();
    expect(section(art('spy'), 'used')).toBeDefined();
  });

  it('shows the own level of a building and of a research, the own number of a unit', () => {
    expect(art('metal', view({ b: { metal: 4 } })).own).toBe('deine Stufe 4');
    expect(art('spy', view({}, { spy: 2 })).own).toBe('deine Stufe 2');
    expect(art('sc', view({ ships: { sc: 3 } })).own).toBe('vorhanden: 3');
    expect(art('rl', view({ def: { rl: 5 } })).own).toBe('vorhanden: 5');
    expect(art('mission-spy').own).toBeNull();
    expect(art('rule-flight').own).toBeNull();
  });

  it('shows the cost of a ship and of a defense, and of nothing else', () => {
    expect(art('sc').cost).toEqual(SHIPS.sc!.cost);
    expect(art('rl').cost).toEqual(DEF.rl!.cost);
    expect(art('metal')).not.toHaveProperty('cost');
    expect(art('spy')).not.toHaveProperty('cost');
    expect(art('mission-spy')).not.toHaveProperty('cost');
  });

  it('has the abbreviation and the short text only where the entry has them', () => {
    const spy = art('spy');
    expect(spy.ab).toBe('AU');
    expect(spy.ds).toBe(text('spy')!.ds);
    const mission = art('mission-spy');
    expect(mission).not.toHaveProperty('ab');
    expect(mission).not.toHaveProperty('ds');
    const list = page(listId('mission'), view());
    if (list.t !== 'list') throw new Error(list.t);
    for (const item of list.items) expect(item).not.toHaveProperty('ab');
  });

  it('draws a mission without a heading, and a rule, a question and a guide like a mission', () => {
    expect(section(art('mission-spy'), 'mission')!.title).toBe('');
    expect(
      ['rule-flight', 'faq-intel', 'guide-start'].map((id) => art(id).cls),
    ).toEqual(['ic-m', 'ic-m', 'ic-m']);
  });

  it('leaves out the note of a link without one and the caption of a table without one', () => {
    const links = viewBlock({ t: 'links', items: [{ id: 'spy' }] });
    expect(links).toStrictEqual({
      t: 'links',
      items: [{ id: 'spy', text: 'Auspex-Lehre' }],
    });
    const table = viewBlock({
      t: 'table',
      head: ['a'],
      rows: [{ cells: ['x'] }],
    });
    expect(table).toStrictEqual({
      t: 'table',
      head: ['a'],
      rows: [{ cells: [{ text: 'x' }] }],
    });
    expect(
      viewBlock({ t: 'table', caption: 'C', head: [], rows: [] }),
    ).toMatchObject({ caption: 'C' });
  });
});

describe('the page of a feature switched off for the round (#404; owner, 2026-11-25, 113a, 114a)', () => {
  /** The view of a player, or the admin, in a round with these values. */
  const inRound = (round: Record<string, unknown>, admin = false): V => {
    const v = view();
    return {
      ...v,
      s: {
        ...v.s,
        round: { ...v.s.round, ...round },
        me: { ...v.s.me, admin },
      },
    };
  };
  const ids = (p: ReturnType<typeof page>): string[] =>
    p.t === 'list'
      ? p.items.map((i) => i.id)
      : p.t === 'start'
        ? p.boxes.flatMap((b) => b.items.map((i) => i.id))
        : [];
  const linked = (a: ArticleView): string[] =>
    a.sections.flatMap((s) =>
      s.blocks.flatMap((b) => {
        if (b.t === 'links') return b.items.map((i) => i.id);
        if (b.t === 'text')
          return b.parts.flatMap((p) => ('link' in p ? [p.link] : []));
        if (b.t === 'facts')
          return b.items.flatMap((i) =>
            i.parts.flatMap((p) => ('link' in p ? [p.link] : [])),
          );
        return [];
      }),
    );
  const hits = (query: string, v: V): string[] =>
    flatHits(searchHits(query, opens(v))).map((h) => h.id);

  /**
   * The switch, its value off, the page it hides, an article that links it,
   * and the other articles it hides (the Handelsposten with the marketplace,
   * #442).
   */
  const CASES = [
    {
      off: { marketOn: 0 },
      id: 'rule-market',
      from: 'faq-resources',
      query: 'Marktplatz',
      also: ['market'],
    },
    {
      off: { guilds: false },
      id: 'rule-guilds',
      from: 'rule-allies',
      query: 'Gilden',
      also: [],
    },
    {
      off: { achievements: false, daily: false },
      id: 'rule-rewards',
      from: 'faq-resources',
      query: 'Tagesbelohnung',
      also: [],
    },
  ] as const;

  it('lists the page, finds it, links it and opens it while the feature is on, as before', () => {
    for (const { id, from, query } of CASES) {
      const v = inRound({});
      expect(opens(v)(id), id).toBe(true);
      expect(ids(page(listId('rule'), v)), id).toContain(id);
      expect(ids(page(AZ, v)), id).toContain(id);
      expect(ids(page('', v)), id).toContain(id);
      expect(page(id, v).t, id).toBe('article');
      expect(art(from, v).siblings.length, id).toBeGreaterThan(0);
      expect(linked(art(from, v)), id).toContain(id);
      expect(hits(query, v), id).toContain(id);
    }
  });

  it('hides it for every player and the admin while the feature is off: not listed, found or linked, and its address falls back like an unknown one', () => {
    for (const { off, id, from, query, also } of CASES)
      for (const admin of [false, true]) {
        const v = inRound(off, admin);
        expect(opens(v)(id), id).toBe(false);
        expect(ids(page(listId('rule'), v)), id).not.toContain(id);
        expect(ids(page(AZ, v)), id).not.toContain(id);
        expect(ids(page('', v)), id).not.toContain(id);
        expect(page(id, v)).toEqual(page('nope', v));
        expect(articleView(id, v), id).toBeNull();
        const other = art(from, v);
        expect(
          other.siblings.map((s) => s.id),
          id,
        ).not.toContain(id);
        expect(linked(other), id).not.toContain(id);
        expect(hits(query, v), id).not.toContain(id);
        // Every other article stays.
        expect(page(AZ, v)).toMatchObject({ t: 'list' });
        expect(ids(page(AZ, v))).toHaveLength(
          ARTICLES.length - 1 - also.length,
        );
      }
  });

  it('hides the article of a mission the round switched off: Wache stellen (#440)', () => {
    const id = 'mission-hold';
    expect(opens(inRound({}))(id)).toBe(true);
    expect(linked(art('rule-allies', inRound({})))).toContain(id);
    for (const admin of [false, true]) {
      const v = inRound({ holdOn: 0 }, admin);
      expect(opens(v)(id)).toBe(false);
      expect(ids(page(AZ, v))).not.toContain(id);
      expect(page(id, v)).toEqual(page('nope', v));
      expect(linked(art('rule-allies', v))).not.toContain(id);
      expect(hits('Wache stellen', v)).not.toContain(id);
      expect(ids(page(AZ, v))).toHaveLength(ARTICLES.length - 1);
    }
  });

  it('hides the Handelsposten with the marketplace, like its page (#442) [V]', () => {
    for (const admin of [false, true]) {
      const off = inRound({ marketOn: 0 }, admin);
      expect(opens(off)('market')).toBe(false);
      expect(page('market', off)).toEqual(page('nope', off));
      expect(articleView('market', off)).toBeNull();
      expect(ids(page(AZ, off))).not.toContain('market');
      expect(hits('Handelsposten', off)).not.toContain('market');
      expect(linked(art('rule-market', inRound({})))).toContain('market');
      const on = inRound({ marketOn: 1 }, admin);
      expect(opens(on)('market')).toBe(true);
      expect(page('market', on).t).toBe('article');
      expect(hits('Handelsposten', on)).toContain('market');
    }
  });

  it('keeps the words of a link to a hidden page, as plain text', () => {
    const v = inRound({ guilds: false });
    const text = blocks(art('rule-allies', v), 'guard')
      .flatMap((b) => (b.t === 'text' ? b.parts : []))
      .find((p) => p.text === 'Gilden');
    expect(text).toEqual({ text: 'Gilden' });
  });

  it('counts only the articles shown in the tiles of the start page', () => {
    const v = inRound({ marketOn: 0, guilds: false });
    const p = page('', v);
    if (p.t !== 'start') throw new Error(p.t);
    // The Handelsposten is hidden with the marketplace (#442).
    expect(p.tiles[0]!.note).toBe(
      `${ARTICLES.filter((a) => a.kind === 'building').length - 1} Einträge`,
    );
    expect(p.boxes.find((b) => b.kind === 'rule')!.items).toHaveLength(
      ARTICLES.filter((a) => a.kind === 'rule').length - 2,
    );
  });

  it('turns a link of a table and of a list to a hidden article into plain words', () => {
    const hidden = (id: string) => id !== 'x';
    expect(
      viewBlock(
        {
          t: 'table',
          head: ['a'],
          rows: [
            {
              cells: [
                { text: 'X', link: 'x' },
                { text: 'Y', link: 'y' },
              ],
            },
          ],
        },
        hidden,
      ),
    ).toEqual({
      t: 'table',
      head: ['a'],
      rows: [{ cells: [{ text: 'X' }, { text: 'Y', link: 'y' }] }],
    });
    expect(
      viewBlock({ t: 'links', items: [{ id: 'x' }, { id: 'spy' }] }, hidden),
    ).toEqual({ t: 'links', items: [{ id: 'spy', text: 'Auspex-Lehre' }] });
    expect(
      viewBlock({ t: 'text', text: 'Mit [[x|X]] und [[probe]].' }, hidden),
    ).toEqual({
      t: 'text',
      parts: [
        { text: 'Mit ' },
        { text: 'X' },
        { text: ' und ' },
        { text: 'Spähschädel', link: 'probe' },
        { text: '.' },
      ],
    });
  });

  it('leaves out a group of the search whose hits are all hidden', () => {
    const all = searchHits('Auspex');
    expect(all.length).toBeGreaterThan(1);
    const ids = new Set(all[0]!.hits.map((h) => h.id));
    expect(searchHits('Auspex', (id) => !ids.has(id))).toEqual(all.slice(1));
    expect(searchHits('Auspex', () => false)).toEqual([]);
  });

  it('opens every article while the round offers every view, an unknown id too', () => {
    const v = inRound({});
    expect(ARTICLES.every((a) => opens(v)(a.id))).toBe(true);
    expect(opens(v)('nope')).toBe(true);
  });
});

describe('the mark of the search when a state update hides a hit (#404)', () => {
  const hits = (...ids: string[]) =>
    ids.map(
      (id) =>
        ({ id, title: id }) as unknown as Parameters<typeof markOf>[0][number],
    );

  it('keeps no mark without one', () => {
    expect(markOf(hits('a', 'b'), null)).toBe(-1);
  });

  it('follows the marked hit to its new place', () => {
    expect(markOf(hits('a', 'b', 'c'), { id: 'c', at: 2 })).toBe(2);
    expect(markOf(hits('b', 'c'), { id: 'c', at: 2 })).toBe(1);
    expect(markOf(hits('x', 'a', 'b'), { id: 'a', at: 0 })).toBe(1);
  });

  it('hands the mark of a hit gone to the hit at its place, or to the last hit', () => {
    expect(markOf(hits('a', 'c'), { id: 'b', at: 1 })).toBe(1);
    expect(markOf(hits('a', 'b'), { id: 'c', at: 2 })).toBe(1);
    expect(markOf(hits('a'), { id: 'c', at: 5 })).toBe(0);
  });

  it('marks nothing when no hit is left', () => {
    expect(markOf([], { id: 'c', at: 2 })).toBe(-1);
  });
});
