// „Freunde“ renders as before #118, bundle 7 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: friends() of src/client/views/friends.ts with
// homeCell() and box() of views/common.ts. On generated states (fixed
// fast-check seed 118) the component renders the same markup, up to what a
// browser does not show (normalize() of markup.ts) and with the same text in
// every element (textContents()); hand-built cases reach what the sample
// reaches rarely: no friends, open requests both ways, a friend in vacation,
// the longest name (20 characters), a player the state does not know, a moon
// before the planet, guilds off. The hooks the handlers and the phone layout
// read (features/social.ts, style.css) are pinned below.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coords, esc } from '../client/logic/format.ts';
import {
  buddyList,
  type Contact,
  type Named,
} from '../client/logic/friends.ts';
import type { GalaxyPlanet, GameState } from '../client/logic/types.ts';
import type { V } from '../client/views/common.ts';
import { friendsView } from './friends-view.ts';
import { normalize, textContents } from './markup.ts';

// ----- frozen: the view before #118, bundle 7 -----

const homeCell = (pl: GalaxyPlanet | null): string =>
  pl
    ? `<span class="home">${esc(pl.name)}</span> <span class="lnk" data-act="gto" data-g="${pl.g}" data-s="${pl.s}">${coords(pl)}</span>`
    : '-';

const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

const button = (op: string, p: Named, label: string, cls = 'small'): string =>
  `<button class="${cls}" data-act="friend" data-op="${op}" data-uid="${esc(p.id)}">${label}</button>`;

const friendRow = (f: Contact): string =>
  `<tr><td>${esc(f.name)}</td><td>${f.tag === null ? '-' : `[${esc(f.tag)}]`}</td><td>${homeCell(f.home)}</td>
  <td>${f.online ? '<span class="good">online</span>' : '<span class="dim">offline</span>'}</td>
  <td>${button('remove', f, 'Freundschaft beenden', 'small red')}</td></tr>`;

function friendTable(list: Contact[]): string {
  if (!list.length) return '<p>Du hast noch keine Freunde.</p>';
  return `<table class="friends"><tr><th>Spieler</th><th>Gilde</th><th>Heimatplanet</th><th>Status</th><th></th></tr>${list.map(friendRow).join('')}</table>`;
}

function friends(v: V): string {
  const { list, incoming, outgoing } = buddyList(v.s);
  const requests = incoming
    .map(
      (p) =>
        `<p>${esc(p.name)} ${button('accept', p, 'Annehmen')} ${button('refuse', p, 'Ablehnen')}</p>`,
    )
    .join('');
  const own = outgoing
    .map(
      (p) =>
        `<p>${esc(p.name)} ${button('cancel', p, 'Anfrage zurückziehen')}</p>`,
    )
    .join('');
  return `<h2>Freunde</h2><div class="box">${friendTable(list)}</div>
  ${box('Anfragen', requests || '<p>Keine offenen Anfragen.</p>')}
  ${own ? box('Deine Anfragen', own) : ''}
  ${box(
    'Freundschaft anfragen',
    `<form id="friendform" class="flex"><label for="friend_name">Name</label> <input id="friend_name" maxlength="20" required autocomplete="off" data-nokeep> <button type="submit">Freundschaft anfragen</button></form>`,
  )}`;
}

// ----- the comparison -----

const IDS = ['u_a', 'u_b', 'u_c', 'u_d', 'u_e', 'u_f'] as const;
/** What a name may hold that is not plain text; the last one is the longest the game allows. */
const NAMES = [
  'Anna',
  'Bert <b>',
  'Cleo & Co',
  'D"ora',
  "Emil's",
  'a > b',
  'NamevonzwanzigZeiche',
];
const TAGS = ['ABC', '<A>', 'X&Y', 'Q"', 'LongTag'];

const place = fc.record({
  owner: fc.constantFrom(...IDS),
  kind: fc.constantFrom('planet' as const, 'moon' as const),
  name: fc.constantFrom('Heimat', 'Mond <1>', 'Kolonie & Co', 'Z"'),
  g: fc.integer({ min: 1, max: 4 }),
  s: fc.integer({ min: 1, max: 40 }),
  p: fc.integer({ min: 1, max: 15 }),
});

const ids = fc.uniqueArray(fc.constantFrom(...IDS), { maxLength: 6 });

const state = fc
  .record({
    players: fc.uniqueArray(
      fc.tuple(
        fc.constantFrom(...IDS),
        fc.record({
          name: fc.constantFrom(...NAMES),
          vacation: fc.boolean(),
        }),
      ),
      { maxLength: 6, selector: ([id]) => id },
    ),
    list: fc.uniqueArray(
      fc.record({ id: fc.constantFrom(...IDS), online: fc.boolean() }),
      { maxLength: 6, selector: (f) => f.id },
    ),
    incoming: ids,
    outgoing: ids,
    places: fc.array(place, { maxLength: 10 }),
    guilds: fc.option(
      fc.array(
        fc.record({
          tag: fc.constantFrom(...TAGS),
          members: fc.array(fc.record({ id: fc.constantFrom(...IDS) }), {
            maxLength: 4,
          }),
        }),
        { maxLength: 3 },
      ),
      { nil: undefined },
    ),
    asked: fc.boolean(),
  })
  .map((x) =>
    viewOf({
      players: x.players,
      friends: x.asked
        ? { list: x.list, incoming: x.incoming, outgoing: x.outgoing }
        : undefined,
      places: x.places,
      guilds: x.guilds,
    }),
  );

interface Shape {
  players: [string, Record<string, unknown>][];
  friends?: { list: unknown[]; incoming: string[]; outgoing: string[] };
  places?: Record<string, unknown>[];
  guilds?: { tag: string; members: { id: string }[] }[];
}

function viewOf(x: Shape): V {
  return {
    s: {
      me: { id: 'u_me' },
      players: Object.fromEntries(x.players),
      galaxy: (x.places ?? []).map((p, i) => ({ ...p, id: `x${i}`, temp: 0 })),
      guilds: x.guilds && {
        directory: x.guilds.map((g, i) => ({ id: `g${i}`, ...g })),
      },
      friends: x.friends,
    } as unknown as GameState,
  } as unknown as V;
}

const at = { g: 1, s: 2, p: 5 };
const PLAYERS: Shape['players'] = [
  ['u_a', { name: 'Anna' }],
  ['u_b', { name: 'Bert <b>' }],
  ['u_c', { name: 'NamevonzwanzigZeiche' }],
  ['u_d', { name: 'Dora', vacation: true }],
];

/** The cases the sample reaches rarely. */
const HAND_BUILT: [string, V][] = [
  ['the state without a buddy list', viewOf({ players: PLAYERS })],
  [
    'no friends and no requests',
    viewOf({
      players: PLAYERS,
      friends: { list: [], incoming: [], outgoing: [] },
    }),
  ],
  [
    'open requests both ways',
    viewOf({
      players: PLAYERS,
      friends: { list: [], incoming: ['u_a', 'u_b'], outgoing: ['u_c', 'u_d'] },
    }),
  ],
  [
    'a friend in vacation, online, with a guild and a planet',
    viewOf({
      players: PLAYERS,
      friends: {
        list: [{ id: 'u_d', online: true }],
        incoming: [],
        outgoing: [],
      },
      places: [{ ...at, owner: 'u_d', kind: 'planet', name: 'Urlaub' }],
      guilds: [{ tag: 'URL', members: [{ id: 'u_d' }] }],
    }),
  ],
  [
    'the friend with the longest name, offline, a moon before the planet',
    viewOf({
      players: PLAYERS,
      friends: {
        list: [
          { id: 'u_c', online: false },
          { id: 'u_a', online: true },
        ],
        incoming: [],
        outgoing: [],
      },
      places: [
        { ...at, owner: 'u_c', kind: 'moon', name: 'Mond' },
        { ...at, owner: 'u_c', kind: 'planet', name: 'Heimat der Langnamigen' },
      ],
      guilds: [{ tag: 'LongTag', members: [{ id: 'u_c' }] }],
    }),
  ],
  [
    'a friend with a moon only has no planet link',
    viewOf({
      players: PLAYERS,
      friends: {
        list: [{ id: 'u_a', online: false }],
        incoming: [],
        outgoing: [],
      },
      places: [{ ...at, owner: 'u_a', kind: 'moon', name: 'Mond' }],
    }),
  ],
  [
    'a player the state does not know',
    viewOf({
      players: [],
      friends: {
        list: [{ id: 'u_x', online: true }],
        incoming: ['u_y'],
        outgoing: ['u_z'],
      },
    }),
  ],
  [
    'guilds off and a tag with markup',
    viewOf({
      players: PLAYERS,
      friends: {
        list: [
          { id: 'u_a', online: true },
          { id: 'u_b', online: false },
        ],
        incoming: ['u_c'],
        outgoing: [],
      },
      guilds: [{ tag: '<A>', members: [{ id: 'u_b' }] }],
    }),
  ],
];

describe('Freunde against the view before #118, bundle 7', () => {
  it('renders the page as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(friendsView(v))).toBe(normalize(friends(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(friendsView(v)), name).toBe(normalize(friends(v)));
  });

  it('keeps the text of every element as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(textContents(friendsView(v))).toEqual(textContents(friends(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
    for (const [name, v] of HAND_BUILT)
      expect(textContents(friendsView(v)), name).toEqual(
        textContents(friends(v)),
      );
  });

  it('reaches the pages the sample is meant to compare', () => {
    const all = HAND_BUILT.map(([, v]) => normalize(friendsView(v))).join('\n');
    for (const mark of [
      'Du hast noch keine Freunde.',
      'Keine offenen Anfragen.',
      'Deine Anfragen',
      'data-op="accept"',
      'data-op="refuse"',
      'data-op="cancel"',
      'data-op="remove"',
      'class="good"',
      'class="dim"',
      'data-act="gto"',
      '[URL]',
      '[&lt;A>]',
      'NamevonzwanzigZeiche',
      '<td>-</td><td>-</td>',
    ])
      expect(all.includes(mark), mark).toBe(true);
  });

  it('keeps every hook the handlers and the phone layout read', () => {
    const [, v] = HAND_BUILT[4]!;
    const html = friendsView(v);
    expect(html).toContain('<table class="friends">');
    expect(html).toContain('id="friendform"');
    expect(html).toContain('id="friend_name"');
    expect(html).toContain('for="friend_name"');
    expect(html).toMatch(
      /<button class="small red" data-act="friend" data-op="remove" data-uid="u_c">/,
    );
    // The fifth cell of a row (style.css `.friends td:nth-child(5)`) is the button.
    expect(html).toMatch(/<td><button[^>]*data-op="remove"/);
  });
});
