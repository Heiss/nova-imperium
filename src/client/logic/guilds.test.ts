// The pages of the guilds (#118, bundle 6): what each rank sees and may do on
// the guild page, the chat log and the three dialogs. The components render
// them; src/test/guilds-reference.test.ts keeps them equal to the HTML before.
import { describe, expect, it } from 'vitest';
import { GUILD_RIGHTS, MAX_GUILD_RANKS } from '../../core/guild-ranks.ts';
import type { GuildRight } from '../../core/guild-ranks.ts';
import type { V } from '../views/common.ts';
import {
  adminChatPage,
  chatLog,
  dissolvePage,
  guildsPage,
  type GuildPage,
  transferPage,
} from './guilds.ts';
import type { Guild, GuildChat, GuildState } from './types.ts';

const guild = (over: Partial<Guild> = {}): Guild => ({
  id: 'g1',
  tag: 'OR',
  name: 'Outer Rim',
  html: '',
  members: [
    { id: 'u_lea', name: 'Lea', points: 1500 },
    { id: 'u_bo', name: 'Bo', points: 20 },
    { id: 'u_ada', name: 'Ada', points: 5 },
  ],
  score: 1525,
  average: 508,
  ...over,
});

/** The ranks of a guild: Leitung, Offizier, Mitglied (the default). */
const ranks = (
  me: string,
  rights: GuildRight[],
  over: { rank?: string; list?: { id: string; rights: GuildRight[] }[] } = {},
) => {
  const list = (
    over.list ?? [
      { id: 'r0', rights: [...GUILD_RIGHTS] },
      { id: 'r1', rights: ['applications', 'chat-read'] as GuildRight[] },
      { id: 'r2', rights: ['chat-read'] as GuildRight[] },
    ]
  ).map((r) => ({ ...r, name: `Rang ${r.id}` }));
  return {
    lead: 'u_lea',
    rank: over.rank ?? { u_lea: 'r0', u_bo: 'r1', u_ada: 'r2' }[me] ?? 'r2',
    rights,
    default: 'r2',
    list,
    members: { u_lea: 'r0', u_bo: 'r1', u_ada: 'r2' },
  };
};

function page(
  me: string,
  rights: GuildRight[],
  state: Partial<GuildState> = {},
  over: { admin?: boolean; shown?: string | null } = {},
): GuildsPageResult {
  const own: GuildState = {
    directory: [guild()],
    own: { id: 'g1', status: 'member' },
    management: { id: 'g1', description: 'Text', pending: [] },
    ranks: ranks(me, rights),
    chat: null,
    ...state,
  };
  const v = {
    s: { me: { id: me }, guilds: own, admin: over.admin ? {} : null },
    ui: { params: { guild: over.shown === undefined ? 'g1' : over.shown } },
  } as unknown as V;
  return guildsPage(v);
}
type GuildsPageResult = ReturnType<typeof guildsPage>;
const onGuild = (p: GuildsPageResult): GuildPage => {
  if (p.kind !== 'guild') throw new Error('not a guild page');
  return p;
};

describe('a guild while the highscore shows nothing (#422, 182a)', () => {
  const pointless = (): Guild => ({
    ...guild(),
    members: guild().members.map(({ id, name }) => ({ id, name })),
    score: undefined,
    average: undefined,
  });

  it('lists the guilds without the columns of the points', () => {
    const p = page(
      'u_x',
      [],
      { directory: [pointless()], own: null, ranks: null, management: null },
      { shown: null },
    );
    if (p.kind !== 'directory') throw new Error('not the directory');
    expect(p.points).toBe(false);
    expect(p.rows[0]).toMatchObject({ score: null, average: null });
  });

  it('shows the members without points and no sums', () => {
    const p = onGuild(
      page('u_x', [], {
        directory: [pointless()],
        own: null,
        ranks: null,
        management: null,
      }),
    );
    expect(p.score).toBeNull();
    expect(p.average).toBeNull();
    expect(p.roster.points).toBe(false);
    expect(p.roster.rows.map((r) => r.points)).toEqual([null, null, null]);
  });
});

describe('the directory', () => {
  it('lists every guild with its link, and a form for a player without one', () => {
    const p = page(
      'u_x',
      [],
      { own: null, management: null, ranks: null },
      {
        shown: null,
      },
    );
    expect(p).toEqual({
      kind: 'directory',
      points: true,
      rows: [
        {
          id: 'g1',
          href: '/?view=guilds&guild=g1',
          heading: '[OR] Outer Rim',
          members: '3',
          score: '1.525',
          average: '508',
        },
      ],
      create: { edit: false, tag: '', name: '', description: '' },
    });
  });

  it('encodes the id of the guild in its link', () => {
    const p = page(
      'u_x',
      [],
      { directory: [guild({ id: 'a&b c' })] },
      {
        shown: null,
      },
    );
    expect(p.kind === 'directory' && p.rows[0]!.href).toBe(
      '/?view=guilds&guild=a%26b%20c',
    );
  });

  it('has no form for a player who has a guild or applied', () => {
    expect(page('u_ada', [], {}, { shown: null })).toMatchObject({
      create: null,
    });
    expect(
      page(
        'u_x',
        [],
        { own: { id: 'g1', status: 'pending' } },
        { shown: null },
      ),
    ).toMatchObject({ create: null });
  });

  it('shows the directory for a guild that is not listed, and without any state', () => {
    expect(page('u_ada', [], {}, { shown: 'nowhere' }).kind).toBe('directory');
    const none = guildsPage({
      s: { me: { id: 'u_a' }, guilds: null },
      ui: { params: { guild: 'g1' } },
    } as unknown as V);
    expect(none).toEqual({
      kind: 'directory',
      rows: [],
      // No guild: no points to show.
      points: false,
      create: { edit: false, tag: '', name: '', description: '' },
    });
  });
});

describe('the button of the guild page', () => {
  const kind = (p: GuildsPageResult) => onGuild(p).membership;

  it('applies, withdraws, leaves or dissolves by what the player is', () => {
    expect(
      kind(page('u_x', [], { own: null, ranks: null, management: null })),
    ).toEqual({
      kind: 'apply',
      id: 'g1',
    });
    expect(
      kind(
        page('u_x', [], {
          own: { id: 'g2', status: 'member' },
          ranks: null,
          management: null,
        }),
      ),
    ).toEqual({ kind: 'none' });
    expect(
      kind(
        page('u_x', [], {
          own: { id: 'g1', status: 'pending' },
          ranks: null,
          management: null,
        }),
      ),
    ).toEqual({ kind: 'pending' });
    expect(kind(page('u_ada', []))).toEqual({ kind: 'leave' });
    expect(kind(page('u_lea', [...GUILD_RIGHTS]))).toEqual({
      kind: 'dissolve',
      id: 'g1',
    });
  });

  it('lets only the Leitung dissolve, not a rank with every right', () => {
    expect(kind(page('u_bo', [...GUILD_RIGHTS]))).toEqual({ kind: 'leave' });
  });

  it('offers the admin „Chat lesen“ on every guild', () => {
    expect(
      onGuild(
        page(
          'u_x',
          [],
          { own: null, ranks: null, management: null },
          { admin: true },
        ),
      ).adminChat,
    ).toBe(true);
    expect(onGuild(page('u_ada', [])).adminChat).toBe(false);
  });
});

describe('the members', () => {
  it('shows another guild’s members without ranks and without controls', () => {
    const p = onGuild(
      page('u_x', [], { own: null, ranks: null, management: null }),
    );
    expect(p.roster).toEqual({
      ranked: false,
      points: true,
      rows: [
        {
          id: 'u_lea',
          name: 'Lea',
          points: '1.500',
          rank: null,
          controls: null,
        },
        { id: 'u_bo', name: 'Bo', points: '20', rank: null, controls: null },
        { id: 'u_ada', name: 'Ada', points: '5', rank: null, controls: null },
      ],
    });
  });

  it('gives the Leitung the hand-over, the rank list and „Entfernen“ for every other member', () => {
    const rows = onGuild(page('u_lea', [...GUILD_RIGHTS])).roster.rows;
    expect(rows[0]).toMatchObject({
      rank: 'Rang r0',
      controls: { transfer: false, assign: null, remove: false },
    });
    expect(rows[1]!.controls).toMatchObject({ transfer: true, remove: true });
    expect(rows[1]!.controls!.assign!.options).toEqual([
      { id: 'r1', name: 'Rang r1', selected: true },
      { id: 'r2', name: 'Rang r2', selected: false },
    ]);
  });

  it('offers a rank only below the own one and without a right it lacks', () => {
    // The officer has „assign“ but not „remove“; it may only give ranks it
    // could hold itself (below it, with rights it has).
    const p = onGuild(page('u_bo', ['assign', 'applications', 'chat-read']));
    const ada = p.roster.rows.find((r) => r.id === 'u_ada')!;
    expect(ada.controls).toEqual({
      transfer: false,
      assign: { options: [{ id: 'r2', name: 'Rang r2', selected: true }] },
      remove: false,
    });
    // Not the Leitung, not itself.
    expect(p.roster.rows.find((r) => r.id === 'u_lea')!.controls).toEqual({
      transfer: false,
      assign: null,
      remove: false,
    });
    expect(p.roster.rows.find((r) => r.id === 'u_bo')!.controls).toEqual({
      transfer: false,
      assign: null,
      remove: false,
    });
  });

  it('shows a rank without rights nothing to do', () => {
    const rows = onGuild(page('u_ada', ['chat-read'])).roster.rows;
    for (const row of rows)
      expect(row.controls).toEqual({
        transfer: false,
        assign: null,
        remove: false,
      });
  });

  it('shows „–“ for a member without a known rank and treats it as the lowest', () => {
    const state = {
      ranks: {
        ...ranks('u_lea', [...GUILD_RIGHTS]),
        members: { u_lea: 'r0', u_bo: null },
      },
    };
    const rows = onGuild(page('u_lea', [...GUILD_RIGHTS], state)).roster.rows;
    expect(rows.find((r) => r.id === 'u_ada')!.rank).toBe('–');
    expect(rows.find((r) => r.id === 'u_bo')!.controls!.remove).toBe(true);
  });
});

describe('the ranks', () => {
  const ranksOf = (p: GuildsPageResult) => onGuild(p).management!.ranks;

  it('opens the editor of a rank below the own one only with the right „Ranks“', () => {
    const lead = ranksOf(page('u_lea', [...GUILD_RIGHTS])).entries;
    expect(lead[0]!.editor).toBeNull();
    expect(lead[0]!.rights).toBe('all');
    expect(lead[1]!.editor).not.toBeNull();
    const officer = ranksOf(page('u_bo', ['ranks', 'chat-read'])).entries;
    expect(officer.map((e) => e.editor !== null)).toEqual([false, false, true]);
    const none = ranksOf(page('u_ada', ['chat-read'])).entries;
    expect(none.every((e) => e.editor === null)).toBe(true);
  });

  it('lists the rights of a rank without an editor, or says it has none', () => {
    const entries = ranksOf(page('u_ada', ['chat-read'], {}, {})).entries;
    expect(entries[1]!.rights).toEqual([
      'Bewerbungen annehmen und ablehnen',
      'Chat lesen',
    ]);
    const bare = ranks('u_ada', ['chat-read'], {
      list: [
        { id: 'r0', rights: [...GUILD_RIGHTS] },
        { id: 'r2', rights: [] },
      ],
    });
    expect(
      ranksOf(page('u_ada', ['chat-read'], { ranks: bare })).entries[1]!.rights,
    ).toBe('none');
  });

  it('disables a right the own rank lacks and checks what the rank holds', () => {
    const editor = ranksOf(page('u_bo', ['ranks', 'chat-read'])).entries[2]!
      .editor!;
    const box = (r: GuildRight) => editor.boxes.find((b) => b.right === r)!;
    expect(box('chat-read')).toMatchObject({ checked: true, disabled: false });
    expect(box('chat-write')).toMatchObject({ checked: false, disabled: true });
    expect(editor.boxes).toHaveLength(GUILD_RIGHTS.length);
  });

  it('moves a rank up unless it stands right below the own one, and down unless it is last', () => {
    const entries = ranksOf(page('u_lea', [...GUILD_RIGHTS])).entries;
    expect(entries[1]!.editor).toMatchObject({ up: false, down: true });
    expect(entries[2]!.editor).toMatchObject({ up: true, down: false });
  });

  it('deletes any rank but the default one, where its members can move to the default', () => {
    const entries = ranksOf(page('u_lea', [...GUILD_RIGHTS])).entries;
    expect(entries[1]!.editor!.remove).toBe(true);
    expect(entries[2]!.editor!.remove).toBe(false);
    expect(entries[2]!.legend).toBe('Rang r2 · Standardrang');
    // The officer may not delete a rank whose members would get a default
    // rank with a right it lacks.
    const rich = ranks('u_bo', ['ranks', 'chat-read'], {
      list: [
        { id: 'r0', rights: [...GUILD_RIGHTS] },
        { id: 'r1', rights: ['ranks'] },
        { id: 'r2', rights: ['chat-write'] },
        { id: 'r3', rights: [] },
      ],
    });
    const state = {
      ranks: {
        ...rich,
        rank: 'r1',
        members: { u_lea: 'r0', u_bo: 'r1', u_ada: 'r3' },
      },
    };
    const editor = ranksOf(page('u_bo', ['ranks', 'chat-read'], state))
      .entries[3]!.editor!;
    expect(editor.remove).toBe(false);
  });

  it('lets only the Leitung choose the default rank', () => {
    expect(
      ranksOf(page('u_lea', [...GUILD_RIGHTS])).entries.map(
        (e) => e.makeDefault,
      ),
    ).toEqual([false, true, false]);
    expect(
      ranksOf(page('u_bo', ['ranks'])).entries.some((e) => e.makeDefault),
    ).toBe(false);
  });

  it('offers a new rank with the right, until the guild has the most ranks', () => {
    expect(ranksOf(page('u_lea', [...GUILD_RIGHTS])).create).toBe(true);
    expect(ranksOf(page('u_ada', ['chat-read'])).create).toBe(false);
    const full = ranks('u_lea', [...GUILD_RIGHTS], {
      list: Array.from({ length: MAX_GUILD_RANKS }, (_, i) => ({
        id: `r${i}`,
        rights: [],
      })),
    });
    expect(
      ranksOf(page('u_lea', [...GUILD_RIGHTS], { ranks: full })).create,
    ).toBe(false);
  });
});

describe('the management of the own guild', () => {
  it('shows applications and the profile form only with their rights', () => {
    const lead = onGuild(
      page('u_lea', [...GUILD_RIGHTS], {
        management: {
          id: 'g1',
          description: 'Text <b>',
          pending: [{ id: 'u_x', name: 'Xaver' }],
        },
      }),
    ).management!;
    expect(lead.applications).toEqual([{ id: 'u_x', name: 'Xaver' }]);
    expect(lead.profile).toEqual({
      edit: true,
      tag: 'OR',
      name: 'Outer Rim',
      description: 'Text <b>',
    });
    const member = onGuild(page('u_ada', ['chat-read'])).management!;
    expect(member.applications).toBeNull();
    expect(member.profile).toBeNull();
  });

  it('has none outside the own guild or without the ranks', () => {
    expect(
      onGuild(page('u_x', [], { own: null, ranks: null, management: null }))
        .management,
    ).toBeNull();
    expect(onGuild(page('u_ada', [], { ranks: null })).management).toBeNull();
    expect(
      onGuild(
        page('u_ada', [], {
          management: { id: 'g2', description: '', pending: [] },
        }),
      ).management,
    ).toBeNull();
  });
});

describe('the chat', () => {
  const msg = (over: Partial<GuildChat['messages'][number]> = {}) => ({
    id: 1,
    time: Date.UTC(2026, 10, 15, 19, 40),
    kind: 'message' as const,
    name: 'Lea',
    text: 'Hallo',
    delete: false,
    ...over,
  });
  const chat = (over: Partial<GuildChat> = {}): GuildChat => ({
    read: true,
    write: true,
    messages: [msg()],
    unread: false,
    ...over,
  });

  it('shows the box only for the own guild, with a log for a rank that reads and a field for one that writes', () => {
    expect(onGuild(page('u_ada', [], { chat: null })).chat).toBeNull();
    expect(
      onGuild(
        page('u_x', [], {
          own: null,
          ranks: null,
          management: null,
          chat: chat(),
        }),
      ).chat,
    ).toBeNull();
    const box = onGuild(
      page('u_ada', [], { chat: chat({ read: false, write: true }) }),
    ).chat!;
    expect(box).toEqual({ log: null, write: true, max: 1000 });
    expect(
      onGuild(page('u_ada', [], { chat: chat({ write: false }) })).chat!.write,
    ).toBe(false);
  });

  it('offers „Löschen“ for the messages the rank may delete', () => {
    const log = onGuild(
      page('u_ada', [], {
        chat: chat({ messages: [msg(), msg({ id: 2, delete: true })] }),
      }),
    ).chat!.log!;
    expect(log.lines.map((l) => l.deletable)).toEqual([false, true]);
  });

  it('shows no „Löschen“ in the admin’s log', () => {
    expect(chatLog([msg({ delete: true })]).lines[0]!.deletable).toBe(false);
  });

  it('writes each event as a sentence, and a former member without a name', () => {
    const lines = chatLog([
      msg({ id: 1, kind: 'join', name: 'Anna', text: '' }),
      msg({ id: 2, kind: 'leave', name: null, text: '' }),
      msg({ id: 3, kind: 'rank', name: 'Bo', text: 'Offizier' }),
      msg({ id: 4, name: null }),
    ]).lines;
    expect(lines.map((l) => [l.event, l.name, l.text])).toEqual([
      [true, 'Anna', 'Anna ist der Gilde beigetreten.'],
      [true, null, 'Ehemaliges Mitglied hat die Gilde verlassen.'],
      [true, 'Bo', 'Bo ist jetzt Offizier.'],
      [false, null, 'Hallo'],
    ]);
  });

  it('gives an attack its target, attacker and arrival', () => {
    const time = new Date(2026, 10, 15, 19, 40).getTime();
    const [same, later] = chatLog([
      msg({
        id: 1,
        kind: 'attack',
        text: '[1:27:11]',
        attacker: 'Vex',
        time,
        arrival: new Date(2026, 10, 15, 20, 15).getTime(),
      }),
      msg({
        id: 2,
        kind: 'attack',
        text: '[1:27:11]',
        attacker: null,
        time,
        arrival: new Date(2026, 10, 16, 1, 2).getTime(),
      }),
    ]).lines;
    expect(same!.text).toBe(
      '⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15',
    );
    expect(later!.text).toBe(
      '⚔ Angriff auf [1:27:11] (Unbekannt → Lea), Ankunft 16.11., 01:02',
    );
  });

  it('treats an arrival of null like a missing one', () => {
    const time = new Date(2026, 10, 15, 19, 40).getTime();
    const attack = {
      kind: 'attack' as const,
      text: '[1:27:11]',
      attacker: 'Vex',
      time,
    };
    const [none, missing] = chatLog([
      msg({ id: 1, ...attack, arrival: null }),
      msg({ id: 2, ...attack }),
    ]).lines;
    // No time of 1970 for null: both show the line as it is without an arrival.
    expect(none!.text).toBe(missing!.text);
    expect(none!.text).not.toContain('1970');
    expect(none!.text).not.toContain('01.01.');
  });
});

describe('the dialogs', () => {
  it('hands over to a member: the ranks below the Leitung', () => {
    const r = ranks('u_lea', [...GUILD_RIGHTS]);
    expect(transferPage(r, 'u_bo', 'Bo')).toEqual({
      uid: 'u_bo',
      name: 'Bo',
      ranks: [
        { id: 'r1', name: 'Rang r1' },
        { id: 'r2', name: 'Rang r2' },
      ],
    });
  });

  it('confirms the dissolving with the tag', () => {
    expect(dissolvePage(guild({ tag: 'W' }))).toEqual({ tag: 'W' });
  });

  it('shows the chat of a guild to the admin with the title of the guild', () => {
    const p = adminChatPage({ guild: { tag: 'OR', name: 'X' }, messages: [] });
    expect(p).toEqual({ heading: '[OR] X', log: { lines: [] } });
  });
});
