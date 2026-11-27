// The frame around the view renders as before #118, bundle 1 („no visible
// change“ of the issue; each migration step changes no behaviour, owner,
// 2026-11-13): the header line, the menu, the tab bar and the list of „Mehr“
// of the phone, and the resource bar. The old HTML is frozen here:
// renderPlanetHeader(), menuBadge(), menuLink(), renderPhoneMenu(),
// renderMenu() and updateBar() of src/client/main.ts. On generated states
// (fixed fast-check seed 118) both render the same markup, up to what a
// browser does not show (normalize() of markup.ts, the same as for the
// lists and the overview). One change on purpose (#241, 2026-11-16): with
// more than one own place, renderPlanetHeader() names the shown place only
// in the list „Aktiver Planet“, which comes first; marked below. Do not
// change the frozen HTML otherwise.
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../core/achievements.ts';
import { BUILD, RES } from '../core/catalog.ts';
import { caps, production } from '../core/economy.ts';
import { placeName } from '../core/moon.ts';
import { settle, settleR } from '../core/settle.ts';
import type { Levels, Planet } from '../core/types.ts';
import { coords, esc, fmt } from '../client/logic/format.ts';
import { unread } from '../client/logic/game.ts';
import { headerLine } from '../client/logic/header.ts';
import { resourceIconURL, type ResourceKey } from '../client/logic/icons.ts';
import { friendsHint } from '../client/logic/friends.ts';
import { guildHint, rewardHint } from '../client/logic/menu-hints.ts';
import { ownPlaces } from '../client/logic/moon.ts';
import { navigation } from '../client/logic/navigation.ts';
import { newsHint, type NewsData } from '../client/logic/news.ts';
import { resourceBar } from '../client/logic/resource-bar.ts';
import type { GalaxyPlanet, GameState } from '../client/logic/types.ts';
import type { Ui } from '../client/views/common.ts';
import Header from '../client/views/Header.svelte';
import {
  menu,
  type MenuEntry,
  phoneMenu,
  TAB_GLYPHS,
} from '../client/views/index.ts';
import Menu from '../client/views/Menu.svelte';
import MoreList from '../client/views/MoreList.svelte';
import ResourceBar from '../client/views/ResourceBar.svelte';
import TabBar from '../client/views/TabBar.svelte';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

/** What the frozen views read of main.ts: the open view, the news, the address. */
interface Frame {
  s: GameState;
  P: Planet;
  ui: Pick<Ui, 'view' | 'news' | 'newsSeen'>;
  completed: Map<string, string>;
  now: number;
}

/** frozen: viewUrl() of main.ts, on a page whose address has a parameter. */
const viewUrl = (view: string): string => `/?lang=de&view=${view}`;

// ----- frozen: src/client/main.ts before #118, bundle 1 -----

function renderPlanetHeader({ s, P }: Frame): string {
  // Every own planet and moon, each moon after its planet (#53).
  const owned = ownPlaces(s.galaxy, s.me.id);
  const activeId = P.id;
  // Changed on purpose (#241): the list first and without „ · “ in front of
  // it, and the name and position of the shown place only without a list.
  // Before: `<b>name</b> coords · Kommandant … · Logout` and the list after
  // „ · “ at the end.
  const shown =
    owned.length > 1
      ? `<select id="planet_select" aria-label="Aktiver Planet">${owned.map((p) => `<option value="${esc(p.id)}" ${p.id === activeId ? 'selected' : ''}>${esc(placeName(p))} ${coords(p)}</option>`).join('')}</select>`
      : `<b>${esc(placeName(P))}</b> ${coords(P)}`;
  // Changed on purpose (#189, D1): the commander is in a span, which the
  // phone hides (it stands at the top of „Mehr“ there).
  return `${shown} <span class="cmd">· Kommandant <b>${esc(s.me.name)}</b> ·</span> <span class="lnk" data-act="logout">Logout</span>`;
}

function menuBadge(hint: string | undefined): string {
  return hint
    ? `<span class="badge" role="img" aria-label="${esc(hint)}" title="${esc(hint)}">!</span>`
    : '';
}

function menuLink(
  ui: Frame['ui'],
  i: MenuEntry,
  hint: string | undefined,
  inner: string,
): string {
  const current = ui.view === i.view ? ' aria-current="page"' : '';
  return `<a href="${esc(viewUrl(i.view))}" data-act="nav" data-v="${i.view}" class="${ui.view === i.view ? 'on' : ''}"${current}>${inner}${menuBadge(hint)}</a>`;
}

/** The lists the tab „Bauen“ stands for (#189). */
const BUILDING_VIEWS = ['buildings', 'research', 'shipyard', 'defense'];

/** Phone: tab bar and the list of the „Mehr“ sheet. */
function renderPhoneMenu(
  ui: Frame['ui'],
  items: (MenuEntry | '-')[],
  hints: Map<string, string>,
): { tabbar: string; more: string } {
  const { tabs, more } = phoneMenu(items);
  const moreHint = more.some((i) => hints.has(i.view));
  // Changed on purpose (#189, D2): „Bauen“ is open in the four lists, and
  // then „Mehr“ is not.
  const building = BUILDING_VIEWS.includes(ui.view);
  const moreOn = !building && more.some((i) => i.view === ui.view);
  return {
    tabbar:
      tabs
        .map((i) =>
          menuLink(
            building && i.view === 'buildings'
              ? { ...ui, view: 'buildings' }
              : ui,
            i,
            hints.get(i.view),
            `${TAB_GLYPHS[i.view]}<span>${esc(i.label)}</span>`,
          ),
        )
        .join('') +
      `<button type="button" class="${moreOn ? 'on' : ''}" data-act="moreOpen" aria-haspopup="dialog">${TAB_GLYPHS.more}<span>Mehr</span>${moreHint ? '<span class="dot" role="img" aria-label="Neues unter Mehr"></span>' : ''}</button>`,
    more: more
      .map((i) =>
        menuLink(
          ui,
          i,
          hints.get(i.view),
          `<span>${esc(i.label)}</span>${TAB_GLYPHS.chevron}`,
        ),
      )
      .join(''),
  };
}

/**
 * menuHints() as it was before the marks registered on their views (#426),
 * frozen like the HTML above, so the marks of the registry are compared with
 * the hand-kept ones.
 */
function frozenMenuHints(
  state: GameState,
  completed: ReadonlyMap<string, string>,
  unread: number,
): Map<string, string> {
  const hints = new Map(completed);
  if (unread) hints.set('messages', `${unread} ungelesene Nachrichten`);
  const reward = rewardHint(state);
  if (reward) hints.set('achievements', reward);
  if (
    state.fleets.some(
      (fleet) => fleet.owner !== state.me.id && fleet.state === 'out',
    )
  ) {
    const done = hints.get('fleet');
    hints.set(
      'fleet',
      done ? `${done} · Anfliegende Flotte` : 'Anfliegende Flotte',
    );
  }
  const guilds = guildHint(state);
  if (guilds) hints.set('guilds', guilds);
  const friends = friendsHint(state);
  if (friends) hints.set('friends', friends);
  return hints;
}

function renderMenu({ s: state, ui, completed }: Frame): {
  menu: string;
  tabbar: string;
  more: string;
} {
  const hints = frozenMenuHints(
    state,
    completed,
    unread(state.reports, state.me.readAt),
  );
  const news = newsHint(ui.news, ui.newsSeen);
  if (news) hints.set('news', news);
  const items = menu(state.me.admin, state.round);
  return {
    menu: items
      .map((i) =>
        i === '-'
          ? '<div class="sep"></div>'
          : menuLink(ui, i, hints.get(i.view), esc(i.label)),
      )
      .join(''),
    ...renderPhoneMenu(ui, items, hints),
  };
}

function updateBar({ s, P, now }: Frame): string {
  const p = settle(P, now, s.cfg, s.me);
  const pr = production(p, s.cfg, settleR(s.me, now).research);
  const cp = caps(p, s.cfg);
  const icon = (key: ResourceKey): string =>
    `<img class="ri" src="${resourceIconURL(key)}" alt="" width="28" height="28">`;
  const r = (
    label: string,
    key: ResourceKey,
    v: number,
    cap: number,
    per: number,
  ): string =>
    `<div class="res" title="${per < 0 ? '' : '+'}${fmt(per)}/h · Lager ${fmt(cap)}">${icon(key)}<div><div class="l">${label}</div><div class="v ${v >= cap ? 'full' : ''}">${fmt(v)}</div></div></div>`;
  return (
    r('Adamant', 'metal', p.res.m, cp.m, pr.m) +
    r('Psikristall', 'crystal', p.res.c, cp.c, pr.c) +
    r('Promethium', 'deuterium', p.res.d, cp.d, pr.d) +
    `<div class="res">${icon('energy')}<div><div class="l">Energie</div><div class="v ${pr.eProd - pr.eUse < 0 ? 'bad' : ''}">${fmt(pr.eProd - pr.eUse)}/${fmt(pr.eProd)}</div></div></div>`
  );
}

// ----- the new components -----

function renderNew(f: Frame): {
  header: string;
  menu: string;
  tabbar: string;
  more: string;
  bar: string;
} {
  const nav = navigation(f.s, f.ui, f.completed, viewUrl);
  return {
    header: render(Header, { props: { line: headerLine(f.s, f.P) } }).body,
    menu: render(Menu, { props: { nav } }).body,
    tabbar: render(TabBar, { props: { nav } }).body,
    more: render(MoreList, { props: { nav } }).body,
    bar: render(ResourceBar, {
      props: { bar: resourceBar(f.s, f.P, f.now) },
    }).body,
  };
}

// ----- generated states -----

const levels = (keys: string[], max: number): fc.Arbitrary<Levels> =>
  fc.record(
    Object.fromEntries(keys.map((k) => [k, fc.integer({ min: 0, max })])),
    { requiredKeys: [] },
  ) as fc.Arbitrary<Levels>;

/** The last name becomes an attribute boundary when its quotes are not escaped. */
const NAMES = [
  'Heimat',
  'Kolonie',
  'Mond <b>&"\'</b>',
  'Ödland',
  'Nord" b="Süd',
] as const;

const VIEWS_OPEN = [
  'overview',
  'buildings',
  'resources',
  'research',
  'shipyard',
  'defense',
  'fleet',
  'galaxy',
  'messages',
  'highscore',
  'guilds',
  'achievements',
  'news',
  'help',
  'admin',
] as const;

const time = fc.integer({ min: 0, max: 20_000_000 });

const own = fc.record({
  id: fc.constantFrom('p1', 'p2', 'p3', 'm1', 'm2', 'x"&<'),
  kind: fc.constantFrom('planet' as const, 'moon' as const),
  name: fc.constantFrom(...NAMES),
  g: fc.integer({ min: 1, max: 3 }),
  s: fc.integer({ min: 1, max: 3 }),
  p: fc.integer({ min: 1, max: 3 }),
  temp: fc.constant(20),
  owner: fc.constantFrom('u1', 'u1', 'u2'),
});

const news: fc.Arbitrary<NewsData | null> = fc.option(
  fc.record({
    version: fc.constant('1.2.0'),
    versions: fc.array(
      fc.record({
        version: fc.constantFrom('1.2.0', '1.1.0', '<1>'),
        date: fc.constant('2026-11-16'),
        entries: fc.constant([]),
      }),
      { maxLength: 2 },
    ),
  }),
);

const frame = fc
  .record({
    P: fc.record({
      id: fc.constantFrom('p1', 'p2', 'm1', 'x"&<'),
      kind: fc.constantFrom('planet' as const, 'moon' as const),
      name: fc.constantFrom(...NAMES),
      res: fc.record({
        m: fc.integer({ min: 0, max: 2_000_000 }),
        c: fc.integer({ min: 0, max: 2_000_000 }),
        d: fc.integer({ min: 0, max: 2_000_000 }),
      }),
      b: levels(Object.keys(BUILD), 18),
      pct: fc.dictionary(
        fc.constantFrom('metal', 'crystal', 'deut', 'solar', 'fusion'),
        fc.constantFrom(0, 50, 100),
      ),
      t: time,
    }),
    // The ids of the places are unique, as the server gives them.
    galaxy: fc.uniqueArray(own, { maxLength: 5, selector: (p) => p.id }),
    me: fc.record({
      name: fc.constantFrom('Ich', 'Kain <i>&"\'</i>'),
      admin: fc.boolean(),
      readAt: time,
      research: levels(Object.keys(RES), 12),
    }),
    round: fc.record({
      achievements: fc.boolean(),
      daily: fc.boolean(),
      guilds: fc.boolean(),
    }),
    reports: fc.array(fc.record({ time }), { maxLength: 3 }),
    rewards: fc.option(
      fc.record({
        claimed: fc.boolean(),
        daily: fc.option(fc.record({ claimed: fc.boolean() }), { nil: null }),
      }),
      { nil: undefined },
    ),
    foreignFleet: fc.boolean(),
    pending: fc.boolean(),
    chatUnread: fc.boolean(),
    completed: fc.dictionary(
      fc.constantFrom(...VIEWS_OPEN),
      fc.constantFrom('Fertig', 'Bau <b>"fertig"</b> & mehr'),
    ),
    view: fc.constantFrom(...VIEWS_OPEN, 'unknown'),
    news,
    newsSeen: fc.option(fc.constantFrom('1.2.0', '1.1.0')),
    now: time,
  })
  .map((x): Frame => {
    const first = ACHIEVEMENTS[0]!;
    const P = planet({ ...x.P, owner: 'u1' });
    const s = {
      cfg: U,
      round: x.round,
      me: {
        id: 'u1',
        ...x.me,
        rq: null,
        probes: 0,
        explain: 'open',
        pushOff: [],
      },
      planet: P,
      galaxy: x.galaxy as GalaxyPlanet[],
      reports: x.reports,
      fleets: x.foreignFleet ? [{ owner: 'u2', state: 'out' }] : [],
      achievements: x.rewards && {
        progress: { [first.metric]: first.target },
        claimed: x.rewards.claimed ? [first.id] : [],
        daily: x.rewards.daily,
      },
      guilds: {
        management: x.pending ? { pending: [{ id: 'u3', name: 'B' }] } : null,
        chat: { unread: x.chatUnread, messages: [] },
      },
    } as unknown as GameState;
    return {
      s,
      P,
      ui: { view: x.view, news: x.news, newsSeen: x.newsSeen },
      completed: new Map(Object.entries(x.completed)),
      now: x.now,
    };
  });

/** Normalized markup of every branch of the frame, for the check that the cases reach them. */
const MARKS = [
  'id="planet_select"',
  // #241: the name as text with one own place, the list first with several.
  '</b> [',
  '</select> <span class="cmd">· Kommandant',
  'selected',
  '(Mond)',
  'Kommandant <b>Kain &lt;i>&amp;"\'&lt;/i></b>',
  'aria-current="page"',
  'class="on"',
  'class="badge"',
  'Neu in Version 1.2.0',
  'class="dot"',
  'data-v="admin"',
  'data-v="guilds"',
  'Tagesbelohnung',
  'aria-label="Bau &lt;b>&quot;fertig&quot;&lt;/b> &amp; mehr"',
  'class="v full"',
  'class="v bad"',
  'title="-',
  'title="+',
];

const SAMPLE = { seed: 118, numRuns: 300 };

describe('the frame against the HTML before #118, bundle 1', () => {
  it('renders the header line as before', () => {
    fc.assert(
      fc.property(frame, (f) => {
        expect(normalize(renderNew(f).header)).toBe(
          normalize(renderPlanetHeader(f)),
        );
      }),
      SAMPLE,
    );
  });

  it('renders the menu, the tab bar and the list of „Mehr“ as before', () => {
    fc.assert(
      fc.property(frame, (f) => {
        const now = renderNew(f);
        const old = renderMenu(f);
        expect(normalize(now.menu)).toBe(normalize(old.menu));
        expect(normalize(now.tabbar)).toBe(normalize(old.tabbar));
        expect(normalize(now.more)).toBe(normalize(old.more));
      }),
      SAMPLE,
    );
  });

  it('renders the resource bar as before', () => {
    fc.assert(
      fc.property(frame, (f) => {
        expect(normalize(renderNew(f).bar)).toBe(normalize(updateBar(f)));
      }),
      SAMPLE,
    );
  });

  it('reaches every branch', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(frame, (f) => {
        const html = Object.values(renderNew(f)).map(normalize).join('');
        for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
      }),
      SAMPLE,
    );
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
