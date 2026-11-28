// What the Lexicanum shows (#285, stage 1): the start page, the lists of a
// kind and „Begriffe A–Z“, and the article of a catalog entry or a mission
// with the blocks that depend on the player's state (B5). The page and the
// side panel draw the same article (views/LexicanumArticle.svelte). Its
// tables are computed from the rules: the level table of #187, the values
// of a unit as in the lists, the requirements in both directions.
import { BUILD, DEF, RES, SHIPS, STORAGE } from '../../core/catalog.ts';
import { SPY_MIN_TECH } from '../../core/espionage.ts';
import {
  ARTICLES,
  article,
  type ArticleMeta,
  KIND_TITLES,
  KINDS,
  missionArticle,
  PAGE_KINDS,
  requirementsOf,
  titleOf,
  usedFor,
} from '../../core/lexicon/articles.ts';
import { HEADINGS, hasEffect, searchDocs } from '../../core/lexicon/docs.ts';
import {
  type Hit,
  type HitGroup,
  search,
  type SearchDoc,
} from '../../core/lexicon/search.ts';
import { fill, type Segment, segments } from '../../core/lexicon/links.ts';
import { TARGET_NAMES } from '../../core/lexicon/targets.ts';
import { costFormula, storageFormula } from '../../core/lexicon/parts.ts';
import type {
  ArticleKind,
  Block,
  Cell,
  Formula,
  LexState,
} from '../../core/lexicon/types.ts';
import { TRADING_POST, tradingPostOffered } from '../../core/market.ts';
import { MISSION, missionRules } from '../../core/missions.ts';
import type { Cost } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { unitLines } from './catalog-list.ts';
import { fmt } from './format.ts';
import { iconURL } from './icons.ts';
import { ownState } from './lexicanum-own.ts';
import { producerEffect, storageEffect } from './level-effects.ts';
import {
  effectText,
  type LevelEffect,
  levelOf,
  type LevelTable,
  levelTable,
} from './level-table.ts';

/** The id of the list of a kind, and of „Begriffe A–Z“. */
export const listId = (kind: ArticleKind): string => `list-${kind}`;
export const AZ = 'a-z';

/** A cell as shown: its text, a link, and whether it is a number. */
interface ViewCell {
  text: string;
  link?: string;
  num?: boolean;
}

/** A block as the components draw it. */
export type ViewBlock =
  | { t: 'text'; parts: Segment[] }
  | Extract<Block, { t: 'formula' | 'chips' | 'stand' }>
  | {
      t: 'table';
      caption?: string;
      head: string[];
      rows: { cells: ViewCell[]; mark?: boolean }[];
    }
  | { t: 'facts'; items: { label: string; parts: Segment[] }[] }
  | { t: 'links'; items: { id: string; text: string; note?: string }[] }
  | { t: 'levels'; table: LevelTable };

/** A section of an article, listed in „Auf dieser Seite“. */
export interface Section {
  id: string;
  title: string;
  blocks: ViewBlock[];
}

export interface ArticleView {
  id: string;
  kind: ArticleKind;
  kindTitle: string;
  title: string;
  ab?: string;
  ds?: string;
  icon: string | null;
  cls: string;
  /** „deine Stufe 4“, „vorhanden: 12“ or null (B5). */
  own: string | null;
  /** The paragraphs of the long text, the introduction (#63). */
  intro: string[];
  /** The cost of a unit, shown as in the lists. */
  cost?: Cost;
  /** The values of a unit or the facts below the head. */
  lines: string[];
  sections: Section[];
  /** The other articles of the kind, for the side of the page. */
  siblings: { id: string; title: string }[];
}

/** A page of the Lexicanum. */
export type Page =
  | {
      t: 'start';
      /** The boxes of the pages that are written: „Einstieg“, „Regeln“, „Häufige Fragen“ (#288, #289). */
      boxes: {
        kind: ArticleKind;
        title: string;
        items: { id: string; title: string; line: string }[];
      }[];
      tiles: { id: string; title: string; note: string }[];
    }
  | {
      t: 'list';
      id: string;
      title: string;
      items: { id: string; title: string; ab?: string; line: string }[];
    }
  | { t: 'article'; article: ArticleView };

/** One step of the path above a page; `id` null for the page itself. */
export interface Crumb {
  id: string | null;
  text: string;
}

const NAME = 'Lexicanum';

const ICON_CLASS: Readonly<Record<ArticleKind, string>> = {
  building: 'ic-b',
  research: 'ic-r',
  ship: 'ic-s',
  defense: 'ic-d',
  mission: 'ic-m',
  rule: 'ic-m',
  question: 'ic-m',
  guide: 'ic-m',
};

/** Whether the player may open an article, by its id. */
type Open = (id: string) => boolean;

/** Every article: the default where no state is at hand. */
const ALL: Open = () => true;

/**
 * Whether the player sees an article (#404; owner, 2026-11-25, 113a): the
 * page of a feature only while the round offers it (the rule of its page,
 * the one of its view; a mission by the rule of its mission, #440), for the
 * admin as for every player (114a), and the Handelsposten only while the
 * round offers it (#442); every
 * other article, an unknown id too, always. A hidden article is not listed,
 * found or linked, and its address falls back like an unknown one.
 */
export const opens =
  (v: V): Open =>
  (id) =>
    // The Handelsposten follows the page „Marktplatz“ [V] (#442, 226b).
    (id !== TRADING_POST || tradingPostOffered(v.s.round)) &&
    (article(id)?.offered?.(v.s.round) ?? true);

/** The pieces of a text; a link to an article the player does not see is plain words. */
const textParts = (text: string, open: Open): Segment[] =>
  segments(text, titleOf).map((part) =>
    'link' in part && !open(part.link) ? { text: part.text } : part,
  );

/** A cell as shown; a link to an article the player does not see is plain words. */
function cell(c: Cell, open: Open): ViewCell {
  if (typeof c === 'number') return { text: fmt(c), num: true };
  if (typeof c === 'string') return { text: c };
  return open(c.link) ? c : { text: c.text };
}

/** A block of the data as the components draw it; a link to an article the player does not see is left out (#404). */
export function viewBlock(b: Block, open: Open = ALL): ViewBlock {
  switch (b.t) {
    case 'text':
      return { t: 'text', parts: textParts(fill(b.text, b.values), open) };
    case 'facts':
      return {
        t: 'facts',
        items: b.items.map((i) => ({
          label: i.label,
          parts: textParts(i.text, open),
        })),
      };
    case 'links':
      return {
        t: 'links',
        items: b.items
          .filter((i) => open(i.id))
          .map((i) => {
            const item: { id: string; text: string; note?: string } = {
              id: i.id,
              text: i.text ?? titleOf(i.id) ?? i.id,
            };
            if (i.note) item.note = i.note;
            return item;
          }),
      };
    case 'table': {
      const t: Extract<ViewBlock, { t: 'table' }> = {
        t: 'table',
        head: b.head,
        rows: b.rows.map((r) => {
          const row: { cells: ViewCell[]; mark?: boolean } = {
            cells: r.cells.map((c) => cell(c, open)),
          };
          if (r.mark) row.mark = true;
          return row;
        }),
      };
      if (b.caption) t.caption = b.caption;
      return t;
    }
    default:
      return b;
  }
}

const formula = (f: Formula): ViewBlock => ({
  t: 'formula',
  lines: [fill(f.text, f.values)],
});

/** What the player has, for the computed blocks of an entry. */
const lexState = (v: V): LexState => ({
  u: v.s.cfg,
  round: v.s.round,
  research: v.R.research,
  ships: v.P.ships,
  own: ownState(v),
});

/** The effect of a level: the entry's own, a store's capacity, a producer's rate. */
function effectOf(v: V, a: ArticleMeta): LevelEffect | undefined {
  return (
    a.lexicon.effect ?? storageEffect(v, a.key) ?? producerEffect(v, a.key)
  );
}

/**
 * The first effect column of an entry's level table, or undefined for an
 * entry without a numeric effect (the level overview of #187 reads it).
 */
export function entryEffect(v: V, key: string): LevelEffect | undefined {
  const a = article(key);
  return a && effectOf(v, a);
}

/** „Dein Stand: Stufe 4 · Flottenslots 5“, for an entry with an effect (B5). */
function stand(v: V, a: ArticleMeta, e: LevelEffect): ViewBlock[] {
  const level = levelOf(v, a.key);
  if (!level) return [];
  return [
    {
      t: 'stand',
      text: `Dein Stand: Stufe ${level} · ${e.label} ${effectText(e.at(level), e)}`,
    },
  ];
}

/** The texts of the lexicon part of an article, with their values. */
const partTexts = (a: ArticleMeta, open: Open): ViewBlock[] =>
  (a.lexicon.texts ?? []).map((t) => ({
    t: 'text',
    parts: textParts(fill(t.text, t.values), open),
  }));

/** „Was die Stufen bringen“: texts, formulas, computed blocks, the own state. */
function effectSection(v: V, a: ArticleMeta, e?: LevelEffect): Section | null {
  const store = STORAGE.some((s) => s.key === a.key);
  if (!hasEffect(a) && !e) return null;
  const custom = a.lexicon.blocks?.(lexState(v)) ?? [];
  const open = opens(v);
  const blocks: ViewBlock[] = [
    ...partTexts(a, open),
    ...(a.lexicon.formulas ?? []).map(formula),
    ...(store ? [formula(storageFormula(v.s.cfg))] : []),
    ...custom.map((b) => viewBlock(b, open)),
    ...(e && !custom.some((b) => b.t === 'stand') ? stand(v, a, e) : []),
  ];
  return { id: 'effect', title: HEADINGS.effect, blocks };
}

/** „Stufen“: the cost formula and the level table of #187. */
function levelSection(v: V, a: ArticleMeta, e?: LevelEffect): Section | null {
  const def = BUILD[a.key] ?? RES[a.key];
  const table = def && levelTable(v, a.key, e ? [e] : []);
  if (!def || !table) return null;
  return {
    id: 'levels',
    title: HEADINGS.levels,
    blocks: [formula(costFormula(def.f ?? 2)), { t: 'levels', table }],
  };
}

/** Whether the shown planet or the research has a requirement. */
const met = (v: V, id: string, level: number): boolean =>
  levelOf(v, id) >= level;

function requirementSection(v: V, a: ArticleMeta): Section | null {
  const req = requirementsOf(a.key);
  if (!req.length) return null;
  return {
    id: 'req',
    title: HEADINGS.req,
    blocks: [
      {
        t: 'links',
        items: req.map((r) => ({
          id: r.id,
          text: `${titleOf(r.id)} ${r.level}`,
          note: met(v, r.id, r.level)
            ? 'erfüllt'
            : `aktuell ${levelOf(v, r.id)}`,
        })),
      },
    ],
  };
}

function usedSection(a: ArticleMeta): Section | null {
  const used = usedFor(a.key);
  if (!used.length) return null;
  return {
    id: 'used',
    title: HEADINGS.used,
    blocks: [
      {
        t: 'table',
        head: ['Schaltet frei', 'Art', a.title],
        rows: used.map((u) => ({
          cells: [
            { text: titleOf(u.id)!, link: u.id },
            { text: KIND_TITLES[article(u.id)!.kind] },
            { text: `ab Stufe ${u.level}`, num: true },
          ],
        })),
      },
    ],
  };
}

// ----- missions -----

const yes = (b: boolean): string => (b ? 'ja' : 'nein');

/**
 * Which ships a mission takes, from its own check: only some („nur …“), at
 * least one of some („braucht …“), or any (null).
 */
export function missionShips(
  m: string,
): { only: boolean; ships: string[] } | null {
  const rules = missionRules(m)!;
  // The planet of an ally: a Wache stellen asks for its owner (#55).
  const target = {
    planet: { id: m, owner: m },
    debris: true,
    protects: () => false,
    vacation: () => false,
    ally: () => true,
  };
  // The article names the ships, not the research a mission needs: the
  // sender has the espionage technology the Auspex-Erkundung asks for (#175).
  const research = { spy: SPY_MIN_TECH };
  const check = (ships: Record<string, number>) =>
    rules.canSend({ owner: '', from: '', ships, research }, target);
  const ships = Object.keys(SHIPS).filter((k) => !check({ [k]: 1 }));
  if (ships.length === Object.keys(SHIPS).length) return null;
  return { only: !check({}), ships };
}

/** The missions that need a ship or take only it, for „Siehe auch“. */
const missionsOf = (key: string): string[] =>
  Object.keys(MISSION)
    .filter((m) => missionShips(m)?.ships.includes(key))
    .map(missionArticle);

function missionFacts(m: string, open: Open): ViewBlock {
  const r = missionRules(m)!;
  const ships = missionShips(m);
  const items: { label: string; text: string }[] = [
    { label: 'Ziel', text: TARGET_NAMES[r.target] },
    { label: 'Ladung', text: yes(r.cargo) },
    { label: 'Rückflug', text: yes(r.returns) },
    { label: 'Eigener Bericht bei der Heimkehr', text: yes(!r.silent) },
  ];
  if (ships)
    items.push({
      label: 'Schiffe',
      text: `${ships.only ? 'nur' : 'braucht'} ${ships.ships.map((k) => `[[${k}]]`).join(', ')}`,
    });
  return viewBlock({ t: 'facts', items }, open);
}

// ----- articles -----

function seeSection(a: ArticleMeta, open: Open): Section | null {
  const ids = [
    ...(a.lexicon.seeAlso ?? []),
    ...(a.kind === 'mission'
      ? (missionShips(a.key)?.ships ?? [])
      : missionsOf(a.key)),
  ].filter((id, i, all) => all.indexOf(id) === i && open(id));
  if (!ids.length) return null;
  return {
    id: 'see',
    title: HEADINGS.see,
    blocks: [
      { t: 'links', items: ids.map((id) => ({ id, text: titleOf(id)! })) },
    ],
  };
}

/** „deine Stufe 4“ or „vorhanden: 12“ on the shown planet (B5). */
function own(v: V, a: ArticleMeta): string | null {
  if (a.kind === 'building' || a.kind === 'research')
    return `deine Stufe ${levelOf(v, a.key)}`;
  if (a.kind === 'ship') return `vorhanden: ${fmt(v.P.ships[a.key] ?? 0)}`;
  if (a.kind === 'defense') return `vorhanden: ${fmt(v.P.def[a.key] ?? 0)}`;
  return null;
}

/** The article of an id with the player's state; null for an unknown id. */
/** The sections of an article, the empty ones left out. */
function sections(v: V, a: ArticleMeta): Section[] {
  const open = opens(v);
  // A rule, a question or a guide is written; its sections are computed from
  // the rules for this player (#288, #289).
  if (a.page)
    return [
      ...a.page.sections(lexState(v)).map((x) => ({
        id: x.id,
        title: x.title,
        blocks: x.blocks.map((b) => viewBlock(b, open)),
      })),
      seeSection(a, open),
    ].filter((s): s is Section => !!s);
  // A mission has the name of a research (`spy`): its text, facts and links.
  const all =
    a.kind === 'mission'
      ? [
          {
            id: 'mission',
            title: '',
            blocks: [...partTexts(a, open), missionFacts(a.key, open)],
          },
          seeSection(a, open),
        ]
      : [
          effectSection(v, a, effectOf(v, a)),
          levelSection(v, a, effectOf(v, a)),
          requirementSection(v, a),
          usedSection(a),
          seeSection(a, open),
        ];
  return all.filter((s): s is Section => !!s);
}

/** The cost of a unit, shown as in the lists; undefined for anything else. */
const unitCost = (a: ArticleMeta): Cost | undefined =>
  a.kind === 'ship' || a.kind === 'defense'
    ? (SHIPS[a.key] ?? DEF[a.key])?.cost
    : undefined;

/** The article of an id with the player's state; null for an unknown id and for one the player does not see (#404). */
export function articleView(id: string, v: V): ArticleView | null {
  const a = article(id);
  if (!a || !opens(v)(id)) return null;
  const cost = unitCost(a);
  const view: ArticleView = {
    id,
    kind: a.kind,
    kindTitle: KIND_TITLES[a.kind],
    title: a.title,
    icon: a.kind === 'mission' || a.page ? null : iconURL(a.key),
    cls: ICON_CLASS[a.kind],
    own: own(v, a),
    intro: a.lt ? a.lt.split('\n\n').map((p) => p.trim()) : [],
    lines: cost ? unitLines(v, a.key)! : [],
    sections: sections(v, a),
    siblings: shownArticles(v, a.kind).map((x) => ({
      id: x.id,
      title: x.title,
    })),
  };
  if (a.ab) view.ab = a.ab;
  if (a.ds) view.ds = a.ds;
  if (cost) view.cost = cost;
  return view;
}

const plural = (n: number): string =>
  `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`;

/** The articles the player sees, of one kind or of all (#404). */
function shownArticles(v: V, kind?: ArticleKind): ArticleMeta[] {
  const open = opens(v);
  return ARTICLES.filter(
    (a) => (kind === undefined || a.kind === kind) && open(a.id),
  );
}

/** The page of an address: the start, a list, „Begriffe A–Z“ or an article. */
export function page(id: string, v: V): Page {
  const kind = [...KINDS, ...PAGE_KINDS].find((k) => listId(k) === id);
  if (kind)
    return {
      t: 'list',
      id,
      title: KIND_TITLES[kind],
      items: shownArticles(v, kind).map(item),
    };
  if (id === AZ)
    return {
      t: 'list',
      id,
      title: 'Begriffe A–Z',
      items: shownArticles(v)
        .sort((a, b) => a.title.localeCompare(b.title, 'de'))
        .map(item),
    };
  const view = articleView(id, v);
  if (view) return { t: 'article', article: view };
  return {
    t: 'start',
    boxes: PAGE_KINDS.flatMap((k) => {
      const items = shownArticles(v, k).map((a) => ({
        id: a.id,
        title: a.title,
        line: a.ds ?? '',
      }));
      return items.length ? [{ kind: k, title: KIND_TITLES[k], items }] : [];
    }),
    tiles: [
      ...KINDS.map((k) => ({
        id: listId(k),
        title: KIND_TITLES[k],
        note: plural(shownArticles(v, k).length),
      })),
      { id: AZ, title: 'Begriffe A–Z', note: 'alle Namen und Kürzel' },
    ],
  };
}

function item(a: ArticleMeta): {
  id: string;
  title: string;
  ab?: string;
  line: string;
} {
  const i: { id: string; title: string; ab?: string; line: string } = {
    id: a.id,
    title: a.title,
    line: a.ds ?? '',
  };
  if (a.ab) i.ab = a.ab;
  return i;
}

/** The path above a page: „Lexicanum › Forschung › Auspex-Lehre“. */
export function crumbs(p: Page): Crumb[] {
  if (p.t === 'start') return [{ id: null, text: NAME }];
  const home: Crumb = { id: '', text: NAME };
  if (p.t === 'list') return [home, { id: null, text: p.title }];
  const a = p.article;
  return [
    home,
    { id: listId(a.kind), text: a.kindTitle },
    { id: null, text: a.title },
  ];
}

// ----- the search (B6) -----

let docs: SearchDoc[] | null = null;

/** The hits of a query, grouped by kind; none for an empty query, and no article the player does not see (#404). */
export const searchHits = (query: string, open: Open = ALL): HitGroup[] =>
  search(query, (docs ??= searchDocs()))
    .map((g) => ({ kind: g.kind, hits: g.hits.filter((h) => open(h.id)) }))
    .filter((g) => g.hits.length > 0);

/** The hits one after another, as the keys ↑ ↓ walk them. */
export const flatHits = (groups: readonly HitGroup[]): Hit[] =>
  groups.flatMap((g) => g.hits);

/** „5 Treffer“ (the study of #285, [V]). */
export const hitsLabel = (n: number): string => `${n} Treffer`;

/** The kind of a group of hits, as the start page names it. */
export const groupTitle = (g: HitGroup): string => KIND_TITLES[g.kind];

/** The marked hit, by its id and its place when it was marked. */
export interface Marked {
  readonly id: string;
  readonly at: number;
}

/**
 * The place of the marked hit in the hits as they are now (#404): a state
 * update can hide a page while the results are open. The marked hit keeps
 * its mark where it went; a hit gone hands the mark to the hit at its place,
 * or to the last hit when the list got shorter; no hit, no mark (-1).
 */
export function markOf(hits: readonly Hit[], marked: Marked | null): number {
  if (!marked) return -1;
  const i = hits.findIndex((h) => h.id === marked.id);
  return i >= 0 ? i : Math.min(marked.at, hits.length - 1);
}

/**
 * The hit marked after a key: ↓ and ↑ walk the hits and wrap around; any
 * other key keeps the mark. -1 is no mark.
 */
export function moveMark(mark: number, count: number, key: string): number {
  if (!count) return -1;
  if (key === 'ArrowDown') return (mark + 1) % count;
  if (key === 'ArrowUp') return mark <= 0 ? count - 1 : mark - 1;
  return mark;
}
