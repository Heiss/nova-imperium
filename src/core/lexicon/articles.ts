// The articles of stage 1 of the Lexicanum (#285): one per catalog entry and
// one per mission, generated from the catalog, its texts and the mission
// rules, plus what an entry adds in its own folder (lexicon.de.ts, through
// the generated lexicon index). Nothing here names a key: a new entry or
// mission gets its article without new code.
import { LEXICON } from '../../features/lexicon.gen.ts';
import { BUILD, DEF, RES, SHIPS } from '../catalog.ts';
import { MISSION } from '../missions.ts';
import { missionText, text } from '../text.ts';
import type { Requirements } from '../types.ts';
import type { ArticleKind, EntryLexicon } from './types.ts';

/** The title of each kind, as the start page lists them (study of #285, [V]). */
export const KIND_TITLES: Readonly<Record<ArticleKind, string>> = {
  building: 'Gebäude',
  research: 'Forschung',
  ship: 'Schiffe',
  defense: 'Verteidigung',
  mission: 'Missionen',
};

/** The kinds in the order of the start page. */
export const KINDS = Object.keys(KIND_TITLES) as ArticleKind[];

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
}

/** The generated index of the lexicon parts, by key. */
const PARTS: ReadonlyMap<string, EntryLexicon> = new Map(
  (LEXICON as readonly (readonly [string, { lexicon: EntryLexicon }])[]).map(
    ([key, part]) => [key, part.lexicon],
  ),
);

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
  ...Object.keys(MISSION).map((m): ArticleMeta => ({
    id: missionArticle(m),
    kind: 'mission',
    title: missionText(m)!.n,
    key: m,
    lexicon: {},
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
