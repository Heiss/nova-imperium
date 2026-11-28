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
  'AdminExplainPanel.svelte': {
    i: index,
    r: index,
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
  'ChoicesBox.svelte': {
    'choice.value': constant('EXPLAIN_MODES and LEVEL_MODES'),
  },
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
  'MainPlanetBox.svelte': { 'option.id': source('planets primary key') },
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
    'box.key': constant(
      'option box keys, each once (assembleBoxes, src/client/views/options/boxes.test.ts)',
    ),
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
  'PmCompose.svelte': {
    name: source('users.name unique'),
    who: source('one conversation per other account, the first five'),
    friend: source(
      'friends.list, one row per friend; users.name unique; quickChoice leaves out the recent',
    ),
  },
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
  'PushBox.svelte': { 'kind.topic': constant('PUSH_TOPICS') },
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
  // The rows and the modules of a row of the QR code of #401.
  'TotpBox.svelte': { r: index, c: index },
  'UnitTable.svelte': { i: index },
};

/**
 * Every loop by component, as its head reads (collection, item and key),
 * once per loop: a component with two equal loops names it twice. A new
 * loop fails until it is added here, also when its key is judged above, and
 * a loop that is gone fails too (CodeRabbit on #395).
 */
const LOOPS: Record<string, string[]> = {
  'Achievements.svelte': [
    'page.list.filter.categories as choice (choice.key)',
    'page.list.filter.statuses as choice (choice.key)',
    'page.list.groups as group (group.status)',
    'group.rows as row (row.id)',
  ],
  'Admin.svelte': [
    'rows as row (`${page?.settings.owner}/${row.key}`)',
    'row.choices as choice (choice.value)',
    'page.tabs as tab (tab.key)',
    'page.settings.sections as section, i (section.heading ?? i)',
  ],
  'AdminExplainPanel.svelte': [
    'page.table.head as cell, i (i)',
    'page.table.rows as row, r (r)',
    'row as cell, i (i)',
  ],
  'AdminBotCheck.svelte': ['check.lines as line (line)'],
  'AdminDiagnostics.svelte': [
    'Object.entries(players) as [id, p] (id)',
    'outcomes as [value, label] (value)',
    'limits as limit (limit)',
  ],
  'AdminErrors.svelte': [
    'kinds as [value, label] (value)',
    'limits as limit (limit)',
  ],
  'AdminTable.svelte': [
    'table.headers as header (header)',
    'table.rows as row, r (r)',
    'row as cell, c (c)',
    'e.references as id, i (i)',
  ],
  'Auth.svelte': ['page.galaxies as galaxy (galaxy)'],
  'BattleReport.svelte': [
    'body.sides as side, i (i)',
    'body.lines as line, i (i)',
  ],
  'CatalogList.svelte': [
    'SEGMENTS as seg (seg.view)',
    'page.places as place (place.id)',
    'page.queue as order, i (i)',
    'FILTERS as f (f.key)',
    'page.rows as row (row.key)',
    'row.lines as line, i (i)',
  ],
  'ChatLog.svelte': ['log.lines as line (line.id)'],
  'ChoicesBox.svelte': [
    'page.explain as choice (choice.value)',
    'page.levels as choice (choice.value)',
  ],
  'Cost.svelte': ['parts as x (x.key)'],
  'Fleet.svelte': [
    'page.unions.unions as union (union.id)',
    'page.unions.open as attack (attack.id)',
    'page.ships as ship (ship.key)',
    'form.quick as place (place.id)',
    'choice.missions as option (option.value)',
    'form.unions as union (union.value)',
    'HOLD_HOURS as hours (hours)',
    'SPEEDS as speed (speed.value)',
    'CARGO_FIELDS as field, i (field.key)',
    'page.jump.targets as place (place.value)',
  ],
  'FleetMoves.svelte': ['fleets as fleet (fleet.id)'],
  'FleetText.svelte': ['parts as part, i (i)'],
  'Friends.svelte': [
    'page.rows as friend (friend.id)',
    'page.incoming as player (player.id)',
    'page.outgoing as player (player.id)',
  ],
  'Galaxy.svelte': [
    'list as a, i (i)',
    'list as mark, i (i)',
    'page.scan.flights as flight, i (i)',
    'page.rows as row (row.position)',
    'sheet.actions as a, i (i)',
  ],
  'GuildDialogs.svelte': ['dialog.ranks as rank (rank.id)'],
  'GuildMembers.svelte': [
    'roster.rows as row (row.id)',
    'controls.assign.options as option (option.id)',
  ],
  'GuildRanks.svelte': [
    'ranks.entries as rank (rank.id)',
    'editor.boxes as box (box.right)',
    'rank.rights as text (text)',
  ],
  'Guilds.svelte': [
    'page.rows as row (row.id)',
    'management.applications as applicant (applicant.id)',
  ],
  'Header.svelte': ['line.places as place (place.id)'],
  'Highscore.svelte': [
    'page.buttons as button (button.key)',
    'page.rows as row (row.id)',
  ],
  'LevelTable.svelte': [
    'table.effects as head (head.label)',
    'table.rows as row (row.level)',
    'table.effects as head, i (head.label)',
    'table.notes as note (note)',
  ],
  'LexicanumArticle.svelte': [
    'article.intro as text, i (i)',
    'article.lines as line, i (i)',
    'article.sections as section (section.id)',
    'section.blocks as block, i (i)',
    'block.lines as line, j (j)',
    'block.items as chip, j (j)',
    'block.items as fact, j (j)',
    'block.items as link (link.id)',
    'block.head as head, j (j)',
    'block.rows as row, j (j)',
    'row.cells as c, k (k)',
  ],
  'LexicanumPage.svelte': [
    'list as item (item.id)',
    'crumbs(p) as crumb, i (i)',
    'p.boxes as box (box.kind)',
    'p.tiles as tile (tile.id)',
    'p.article.sections as section (section.id)',
    'p.article.siblings as sibling (sibling.id)',
  ],
  'LexicanumSearch.svelte': [
    'groups as group (group.kind)',
    'group.hits as hit (hit.id)',
  ],
  'LexicanumText.svelte': ['parts as part, i (i)'],
  'MainPlanetBox.svelte': ['page.main.options as option (option.id)'],
  'Market.svelte': ['TRADED as r (r)', 'targets(shown.give) as r (r)'],
  'MarketPreview.svelte': ['p.lines as line, i (i)'],
  'Menu.svelte': ['nav.menu as item, i (i)'],
  'Messages.svelte': [
    'page.rows as report (report.id)',
    'report.body.lines as line, i (i)',
  ],
  'MessagesTabs.svelte': ['tabs as key (key)'],
  'MoreList.svelte': ['nav.more as link (link.view)'],
  'News.svelte': [
    'page.versions as version, v (v)',
    'version.groups as group (group.label)',
    'group.items as item, i (i)',
  ],
  'Options.svelte': ['OPTION_SECTIONS as s (s.key)', 'BOXES as box (box.key)'],
  'Overview.svelte': [
    'page.held as fleet (fleet.id)',
    'page.activities as row (row.label)',
  ],
  'OverviewCards.svelte': [
    'cards.running as item (item.label)',
    'cards.attention as item (item.key)',
    'cards.ready as item (item.key)',
  ],
  'PmCompose.svelte': [
    'names as name (name)',
    'quick.recent as who (who)',
    'quick.friends as friend (friend)',
  ],
  'PmInbox.svelte': ['page.inbox as row (row.key)'],
  'PmSent.svelte': ['list.rows as row (row.id)'],
  'PmSettings.svelte': ['blocked as who (who)'],
  'PmThread.svelte': ['lines as line (line.id)'],
  'ProducerTable.svelte': [
    'COLUMNS as column (column)',
    'SHARES as x (x)',
    'COLUMNS as column (column)',
    'table.rows as row (row.key)',
  ],
  'PushBox.svelte': ['page.pushKinds as kind (kind.topic)'],
  'Requirements.svelte': ['needs as { n, st, energy } (`${n.kind}:${n.key}`)'],
  'ResourceBar.svelte': ['bar.cells as cell (cell.icon)'],
  'RoundArchive.svelte': [
    'list as [name, value] (name)',
    'who.places as place (place.where)',
    'report.categories as category (category.key)',
    'report.rows as row (row.place)',
    'report.guilds as guild (guild.name)',
    'report.rules as rule (rule)',
    'body.rounds as round (round.number)',
    'body.history as h (h.number)',
  ],
  'RoundDialog.svelte': [
    'f.choices as choice (choice.value)',
    'rows as row, i (i)',
    'row.members as member (member.field.id)',
    'page.sections as section, i (section.heading ?? i)',
    'page.rows as row, i (i)',
  ],
  'RoundRewind.svelte': [
    'page.cards as c, i (c.key)',
    'card.lines as line (line)',
  ],
  'SpyReport.svelte': [
    'body.sections as section (section.title)',
    'section.entries as entry, i (i)',
  ],
  'SurveyReport.svelte': ['body.rows as [label, value] (label)'],
  'TabBar.svelte': ['nav.tabs as link (link.view)'],
  'TotpBox.svelte': ['modules as row, r (r)', 'row as dark, c (c)'],
  'UnitTable.svelte': ['rows as row, i (i)'],
};

/** The heads of every `{#each}` block of a Svelte source (collection, item, key), in order. */
function eachHeads(source: string): string[] {
  const heads: string[] = [];
  for (let at = source.indexOf('{#each'); at !== -1;) {
    let depth = 0;
    let end = at;
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}' && --depth === 0) break;
    }
    heads.push(
      source
        .slice(at + '{#each'.length, end)
        .replace(/\s+/g, ' ')
        .trim(),
    );
    at = source.indexOf('{#each', end);
  }
  return heads;
}

/** The keys of every `{#each}` block of a Svelte source; null for a block without a key. */
const eachKeys = (source: string): (string | null)[] =>
  eachHeads(source).map(keyOf);

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

/** The loops of the tree: component name, head and key. */
function found(): { file: string; head: string; key: string | null }[] {
  return svelteFiles(ROOT).flatMap((f) =>
    eachHeads(readFileSync(path.join(ROOT, f), 'utf8')).map((head) => ({
      file: path.basename(f),
      head,
      key: keyOf(head),
    })),
  );
}

/**
 * The loops of <now> that <census> does not name, and those it names that
 * <now> lacks, each as „component: head“; a head counts as often as it
 * stands.
 */
function censusDiff(
  now: readonly { file: string; head: string }[],
  census: Readonly<Record<string, readonly string[]>>,
): { added: string[]; gone: string[] } {
  const left = new Map<string, number>();
  for (const [file, heads] of Object.entries(census))
    for (const head of heads) {
      const id = `${file}: ${head}`;
      left.set(id, (left.get(id) ?? 0) + 1);
    }
  const added: string[] = [];
  for (const { file, head } of now) {
    const id = `${file}: ${head}`;
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    else added.push(id);
  }
  const gone = [...left].flatMap(([id, n]) => Array<string>(n).fill(id));
  return { added, gone };
}

describe('the keyed lists of the views (#369)', () => {
  it('finds the key of a block with a template, a destructured row and nested braces', () => {
    expect(
      eachKeys(
        '{#each rows as row (`${a}/${row.key}`)}x{/each}{#each needs as { n, st } (`${n.kind}:${n.key}`)}y{/each}{#each list as i}z{/each}{#each xs as x, i (i)}{/each}',
      ),
    ).toEqual(['`${a}/${row.key}`', '`${n.kind}:${n.key}`', null, 'i']);
  });

  it('are each in the census of the loops, as often as they stand (CodeRabbit on #395)', () => {
    expect(censusDiff(found(), LOOPS)).toEqual({ added: [], gone: [] });
  });

  it('fail for an added loop with a key already judged, and for a removed loop', () => {
    const now = found();
    const twice = [
      ...now,
      { file: 'Achievements.svelte', head: 'other.rows as row (row.id)' },
    ];
    expect(censusDiff(twice, LOOPS).added).toEqual([
      'Achievements.svelte: other.rows as row (row.id)',
    ]);
    const cards = now.filter((l) => l.file === 'OverviewCards.svelte');
    const without = now.filter(
      (l) => l !== cards.find((c) => c.key === 'item.key'),
    );
    expect(censusDiff(without, LOOPS).gone).toEqual([
      `OverviewCards.svelte: ${cards.find((c) => c.key === 'item.key')!.head}`,
    ]);
    // An equal loop a second time counts too.
    const columns = now.find(
      (l) => l.file === 'ProducerTable.svelte' && l.key === 'column',
    )!;
    expect(censusDiff([...now, columns], LOOPS).added).toEqual([
      `ProducerTable.svelte: ${columns.head}`,
    ]);
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
