// The articles of stage 1 of the Lexicanum (#285): one per catalog entry and
// one per mission, generated from the catalog, its texts and the mission
// rules, plus what an entry or a mission adds in its own folder
// (lexicon.de.ts, through the generated lexicon index). Nothing here names a key: a new entry or
// mission gets its article without new code.
import { LEXICON, MISSION_LEXICON } from '../../features/lexicon.gen.ts';
import { BUILD, DEF, RES, SHIPS } from '../catalog.ts';
import { MISSION, missionRules } from '../missions.ts';
import type { RoundRules } from '../round.ts';
import { missionText, text } from '../text.ts';
import type { Requirements } from '../types.ts';
import { PAGES } from './pages/index.ts';
import type {
  ArticleKind,
  EntryKind,
  EntryLexicon,
  PageDef,
  PageKind,
} from './types.ts';

/** The title of each kind, as the start page lists them (study of #285, [V]). */
export const KIND_TITLES: Readonly<Record<ArticleKind, string>> = {
  building: 'Gebäude',
  research: 'Forschung',
  ship: 'Schiffe',
  defense: 'Verteidigung',
  mission: 'Missionen',
  rule: 'Regeln',
  question: 'Häufige Fragen',
  guide: 'Einstieg',
};

/** The kinds of „Nachschlagen“ on the start page: the entries and the missions. */
export const KINDS: readonly EntryKind[] = [
  'building',
  'research',
  'ship',
  'defense',
  'mission',
];

/** The kinds of the pages that are written, each a box of the start page (#288, #289). */
export const PAGE_KINDS: readonly PageKind[] = ['guide', 'rule', 'question'];

/** One article without the blocks that depend on the player's state. */
export interface ArticleMeta {
  /** The address of the article (`?view=lexicanum&a=<id>`). */
  id: string;
  kind: ArticleKind;
  title: string;
  /** Abbreviation, short and long text of a catalog entry. */
  ab?: string;
  ds?: string;
  lt?: string;
  /** The catalog key of an entry, or the name of a mission. */
  key: string;
  lexicon: EntryLexicon;
  /** The page of a rule, a question or a guide, which has no entry (#288, #289). */
  page?: PageDef;
  /**
   * Whether the round offers the article (#404): the rule of its page, or of
   * its mission (#440: „Wache stellen“ off hides its article). Missing:
   * always.
   */
  offered?: (round: RoundRules) => boolean;
}

type Index = readonly (readonly [string, { lexicon: EntryLexicon }])[];

const byKey = (index: Index): ReadonlyMap<string, EntryLexicon> =>
  new Map(index.map(([key, part]) => [key, part.lexicon]));

/** The generated indexes of the lexicon parts, by key and by mission. */
const PARTS = byKey(LEXICON);
const MISSION_PARTS = byKey(MISSION_LEXICON);

/** The id of the article of a mission; `spy` is both a research and a mission. */
export const missionArticle = (m: string): string => `mission-${m}`;

const TABLES = [
  ['building', BUILD],
  ['research', RES],
  ['ship', SHIPS],
  ['defense', DEF],
] as const;

function entryArticle(kind: ArticleKind, key: string): ArticleMeta {
  const t = text(key)!;
  const meta: ArticleMeta = {
    id: key,
    kind,
    title: t.n,
    ab: t.ab,
    ds: t.ds,
    key,
    lexicon: PARTS.get(key) ?? {},
  };
  if (t.lt) meta.lt = t.lt;
  return meta;
}

/** Every article, by kind in the order of the catalog and of the fleet form. */
export const ARTICLES: readonly ArticleMeta[] = [
  ...TABLES.flatMap(([kind, defs]) =>
    Object.keys(defs).map((key) => entryArticle(kind, key)),
  ),
  ...Object.keys(MISSION).map((m): ArticleMeta => {
    const offered = missionRules(m)!.offered;
    return {
      id: missionArticle(m),
      kind: 'mission',
      title: missionText(m)!.n,
      key: m,
      lexicon: MISSION_PARTS.get(m) ?? {},
      ...(offered && { offered: offered.open }),
    };
  }),
  ...PAGES.map((p): ArticleMeta => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    ds: p.line,
    key: p.id,
    lexicon: {
      keywords: p.keywords,
      ...(p.seeAlso ? { seeAlso: p.seeAlso } : {}),
    },
    page: p,
    ...(p.offered && { offered: p.offered }),
  })),
];

const BY_ID: ReadonlyMap<string, ArticleMeta> = new Map(
  ARTICLES.map((a) => [a.id, a]),
);

/** The article of an id; undefined for an id that is no article. */
export const article = (id: string): ArticleMeta | undefined => BY_ID.get(id);

/** The title of an article, for links. */
export const titleOf = (id: string): string | undefined => BY_ID.get(id)?.title;

/** A requirement of an entry, or an entry that needs it, with the level. */
export interface Link {
  id: string;
  level: number;
}

const reqOf = (key: string): Requirements | undefined =>
  (BUILD[key] ?? RES[key] ?? SHIPS[key] ?? DEF[key])?.req;

/** The direct requirements of an entry: buildings first, then research. */
export const requirementsOf = (key: string): Link[] => {
  const req = reqOf(key);
  return [...Object.entries(req?.b ?? {}), ...Object.entries(req?.r ?? {})].map(
    ([id, level]) => ({ id, level }),
  );
};

/** The entries that need an entry directly, in the order of the articles. */
export const usedFor = (key: string): Link[] =>
  ARTICLES.flatMap((a) => {
    const req = reqOf(a.key);
    const level =
      a.kind === 'mission' ? undefined : (req?.b?.[key] ?? req?.r?.[key]);
    return level ? [{ id: a.id, level }] : [];
  });
