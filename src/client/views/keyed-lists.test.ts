// Every keyed list of a view, judged (#369). A list keyed twice by the same
// value throws Svelte's `each_key_duplicate` and the view stops drawing: the
// fleet page did so on the live server (#362), where „Schnellwahl“ merged
// friends, guild members and last targets. A server render in Vitest does
// not throw on a duplicate key, so this guard reads the sources instead:
// every `{#each … (key)}` of `src/client` must be listed below with the
// reason its key cannot repeat, a list fed by more than one source names the
// unit test that proves its keys unique, and a list without a key fails.
// A new list fails here until it is judged; a list that is gone fails too.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Why the key of a list cannot repeat. */
type Verdict =
  /** The loop index, or a number derived from it. */
  | { kind: 'index' }
  /** A constant list, a catalog or a registry with unique keys. */
  | { kind: 'constant'; why: string }
  /** One source with a unique key (a primary key, a unique index). */
  | { kind: 'one source'; why: string }
  /** More than one source: the unit test that proves the keys unique. */
  | { kind: 'merged'; why: string; test: string };

const index = { kind: 'index' } as const;
const constant = (why: string): Verdict => ({ kind: 'constant', why });
const source = (why: string): Verdict => ({ kind: 'one source', why });
const merged = (why: string, test: string): Verdict => ({
  kind: 'merged',
  why,
  test,
});

/**
 * The keyed lists by component and key expression (the audit of #369,
 * 2026-11-24). The same key in one component stands once.
 */
const LISTS: Record<string, Record<string, Verdict>> = {
  'Achievements.svelte': {
    'choice.key': constant('object keys of CATEGORIES and STATUS_LABELS'),
    'group.status': constant('object keys of STATUS_LABELS'),
    'row.id': constant('ACHIEVEMENTS ids, one status group each'),
  },
  'Admin.svelte': {
    '`${page?.settings.owner}/${row.key}`': constant(
      'UNIVERSE_SPECS keys, the same owner for every row',
    ),
    'choice.value': constant('the choices of one registry setting'),
    'tab.key': constant('object keys of ADMIN_TABS'),
    'section.heading ?? i': constant(
      'one section per heading of ROUND_SECTIONS',
    ),
  },
  'AdminBotCheck.svelte': {
    line: source('one line per day, grouped in a Map, starting with the date'),
  },
  'AdminDiagnostics.svelte': {
    id: constant('object keys of the players'),
    value: constant('three outcome literals'),
    limit: constant('four limit literals'),
  },
  'AdminErrors.svelte': {
    value: constant('three kind literals'),
    limit: constant('four limit literals'),
  },
  'AdminTable.svelte': {
    header: constant('the header literals of each table'),
    r: index,
    c: index,
    i: index,
  },
  'Auth.svelte': { galaxy: constant('the range 1 to the galaxies') },
  'BattleReport.svelte': { i: index },
  'CatalogList.svelte': {
    'seg.view': constant('SEGMENTS'),
    'place.id': source('planet ids, one lab site per planet'),
    i: index,
    'f.key': constant('FILTERS'),
    'row.key': constant('object keys of the catalog'),
  },
  'ChatLog.svelte': { 'line.id': source('guild_chat primary key') },
  'Cost.svelte': {
    'x.key': constant('the three resources and energy, each once'),
  },
  'Fleet.svelte': {
    'union.id': source('union ids of the server (#362)'),
    'attack.id': source('fleet ids (#362)'),
    'ship.key': constant('object keys of SHIPS'),
    'place.id': merged(
      'own places, friends, guild members and last targets, the first kept',
      'src/client/logic/fleet-quick.test.ts',
    ),
    'option.value': constant('FLEET_MISSIONS (fleet-keys.test.ts)'),
    'union.value': source('union ids of the server (#362)'),
    hours: constant('HOLD_HOURS (fleet-keys.test.ts)'),
    'speed.value': constant('SPEEDS (fleet-keys.test.ts)'),
    'field.key': constant('CARGO_FIELDS (fleet-keys.test.ts)'),
    'place.value': source('moon ids with a gate'),
  },
  'FleetMoves.svelte': { 'fleet.id': source('fleet ids, one filter') },
  'FleetText.svelte': { i: index },
  'Friends.svelte': {
    'friend.id': source('unique index friendships_pair'),
    'player.id': source('unique index friendships_pair'),
  },
  'Galaxy.svelte': {
    i: index,
    'row.position': constant('the range of the positions'),
  },
  'GuildDialogs.svelte': { 'rank.id': source('guild_ranks primary key') },
  'GuildMembers.svelte': {
    'row.id': source('guild_members primary key'),
    'option.id': source('guild_ranks primary key'),
  },
  'GuildRanks.svelte': {
    'rank.id': source('guild_ranks primary key'),
    'box.right': constant('GUILD_RIGHTS'),
    text: source('primary key (rank, right), distinct texts per right'),
  },
  'Guilds.svelte': {
    'row.id': source('guilds primary key'),
    'applicant.id': source('guild_members primary key'),
  },
  'Header.svelte': { 'place.id': source('planets primary key') },
  'Highscore.svelte': {
    'button.key': constant('object keys of HIGHSCORE_CATEGORIES'),
    'row.id': constant('object keys of the players'),
  },
  'LevelTable.svelte': {
    'head.label': constant('disjoint literal labels of the effects'),
    'row.level': constant('strictly increasing levels'),
    note: constant('at most three distinct notes'),
  },
  'LexicanumArticle.svelte': {
    i: index,
    'section.id': constant('fixed section ids, page ids unique'),
    j: index,
    'link.id': merged(
      'see-also and missions with a dedupe, requirements of distinct articles',
      'src/client/logic/lexicanum.test.ts',
    ),
    k: index,
  },
  'LexicanumPage.svelte': {
    'item.id': constant('article ids (articles.test.ts)'),
    i: index,
    'box.kind': constant('PAGE_KINDS'),
    'tile.id': constant('list-<kind> and a-z'),
    'section.id': constant('fixed section ids, page ids unique'),
    'sibling.id': constant('article ids (articles.test.ts)'),
  },
  'LexicanumSearch.svelte': {
    'group.kind': constant('Map keys by kind'),
    'hit.id': constant('one document per article'),
  },
  'LexicanumText.svelte': { i: index },
  'Market.svelte': { r: constant('the traded resources') },
  'MarketPreview.svelte': { i: index },
  'Menu.svelte': { i: index },
  'Messages.svelte': {
    'report.id': source('reports primary key'),
    i: index,
  },
  'MessagesTabs.svelte': { key: constant('object keys of MESSAGE_TABS') },
  'MoreList.svelte': { 'link.view': constant('view keys (registry.test.ts)') },
  'News.svelte': {
    v: index,
    'group.label': constant('Neu, Geändert, Behoben'),
    i: index,
  },
  'Options.svelte': {
    's.key': constant('OPTION_SECTIONS'),
    'choice.value': constant('EXPLAIN_MODES and LEVEL_MODES'),
    'option.id': source('planets primary key'),
    'kind.topic': constant('PUSH_TOPICS'),
  },
  'Overview.svelte': {
    'fleet.id': source('fleet ids, one filter'),
    'row.label': constant('three fixed activity labels'),
  },
  'OverviewCards.svelte': {
    'item.label': constant('three fixed activity labels'),
    'item.key': merged(
      'fleets, places and single lines; the text is no key',
      'src/client/logic/overview-cards.test.ts',
    ),
  },
  'PmCompose.svelte': { name: source('users.name unique') },
  'PmInbox.svelte': { 'row.key': source('one preview per other account') },
  'PmSent.svelte': {
    'row.id': merged(
      'the first page and older pages, held in a Set',
      'src/client/logic/private-messages.test.ts',
    ),
  },
  'PmSettings.svelte': { who: source('primary key (blocker, blocked)') },
  'PmThread.svelte': {
    'line.id': merged(
      'the first page, older and newer messages, held in a Set',
      'src/client/logic/private-messages.test.ts',
    ),
  },
  'ProducerTable.svelte': {
    column: constant('the columns m, c, d and e'),
    x: constant('the shares 100 to 0'),
    'row.key': constant('one entry folder per key'),
  },
  'Requirements.svelte': {
    '`${n.kind}:${n.key}`': merged(
      'the transitive requirements, held in a Map by the same key',
      'src/core/requirements.test.ts',
    ),
  },
  'ResourceBar.svelte': { 'cell.icon': constant('the three resources') },
  'RoundArchive.svelte': {
    name: constant('distinct fact names'),
    'place.where': source('planets unique by kind and position'),
    'category.key': constant('object keys of HIGHSCORE_CATEGORIES'),
    'row.place': index,
    'guild.name': source('guild tag and name unique'),
    rule: constant('one line per setting, the labels unique'),
    'round.number': source('rounds primary key'),
    'h.number': source('rounds primary key'),
  },
  'RoundDialog.svelte': {
    'choice.value': constant('the choices of one registry setting'),
    i: index,
    'member.field.id': constant('field ids (round-registry.test.ts)'),
    'section.heading ?? i': constant(
      'one section per heading of ROUND_SECTIONS',
    ),
  },
  'RoundRewind.svelte': {
    'c.key': constant('one card per kind'),
    line: constant('distinct texts within each card'),
  },
  'SpyReport.svelte': {
    'section.title': constant('six fixed section titles'),
    i: index,
  },
  'SurveyReport.svelte': { label: constant('distinct literal labels') },
  'TabBar.svelte': { 'link.view': constant('view keys (registry.test.ts)') },
  'UnitTable.svelte': { i: index },
};

/** The keys of every `{#each}` block of a Svelte source; null for a block without a key. */
function eachKeys(source: string): (string | null)[] {
  const keys: (string | null)[] = [];
  for (let at = source.indexOf('{#each'); at !== -1;) {
    let depth = 0;
    let end = at;
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}' && --depth === 0) break;
    }
    keys.push(keyOf(source.slice(at + '{#each'.length, end)));
    at = source.indexOf('{#each', end);
  }
  return keys;
}

/** The key of the head of an `{#each}` block: its last parenthesis after ` as `. */
function keyOf(head: string): string | null {
  const text = head.replace(/\s+/g, ' ').trim();
  if (!text.endsWith(')')) return null;
  let depth = 0;
  let open = text.length - 1;
  for (; open >= 0; open--) {
    if (text[open] === ')') depth++;
    else if (text[open] === '(' && --depth === 0) break;
  }
  return text.slice(0, open).includes(' as ')
    ? text.slice(open + 1, -1).trim()
    : null;
}

const ROOT = 'src/client';

/** Every Svelte file below `dir`, relative to it. */
function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.svelte'))
    .sort();
}

/** The keyed lists of the tree: component name and key. */
function found(): { file: string; key: string | null }[] {
  return svelteFiles(ROOT).flatMap((f) =>
    eachKeys(readFileSync(path.join(ROOT, f), 'utf8')).map((key) => ({
      file: path.basename(f),
      key,
    })),
  );
}

describe('the keyed lists of the views (#369)', () => {
  it('finds the key of a block with a template, a destructured row and nested braces', () => {
    expect(
      eachKeys(
        '{#each rows as row (`${a}/${row.key}`)}x{/each}{#each needs as { n, st } (`${n.kind}:${n.key}`)}y{/each}{#each list as i}z{/each}{#each xs as x, i (i)}{/each}',
      ),
    ).toEqual(['`${a}/${row.key}`', '`${n.kind}:${n.key}`', null, 'i']);
  });

  it('are all keyed', () => {
    expect(found().filter((l) => l.key === null)).toEqual([]);
  });

  it('are all judged: a new list states why its key cannot repeat', () => {
    const unjudged = found()
      .filter((l) => l.key !== null && !LISTS[l.file]?.[l.key])
      .map((l) => `${l.file}: ${l.key}`);
    expect(unjudged).toEqual([]);
  });

  it('judge no list that is gone', () => {
    const present = new Set(found().map((l) => `${l.file}\n${l.key}`));
    const gone = Object.entries(LISTS).flatMap(([file, keys]) =>
      Object.keys(keys)
        .filter((key) => !present.has(`${file}\n${key}`))
        .map((key) => `${file}: ${key}`),
    );
    expect(gone).toEqual([]);
  });

  it('name an existing unit test for every list fed by more than one source', () => {
    const missing = Object.values(LISTS)
      .flatMap((keys) => Object.values(keys))
      .flatMap((v) =>
        v.kind === 'merged' && !existsSync(v.test) ? [v.test] : [],
      );
    expect(missing).toEqual([]);
  });
});
