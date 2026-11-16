// The rank and member controls of the guild view (#163) ask the checks of
// src/core/guild-checks.ts (#214): the view offers exactly what the server
// allows, and nothing it showed before changes. The expected controls are
// written out here, so a changed offer is noticed.
import { describe, expect, it } from 'vitest';
import { GUILD_RIGHTS, type GuildRight } from '../../core/guild-ranks.ts';
import type { GameState, GuildRank, GuildState } from '../logic/types.ts';
import type { V } from './common.ts';
import { guilds } from './guilds.ts';

/**
 * A guild of five ranks: Leitung (Lea), Offizier (Oli: ranks, assign,
 * remove, applications), Veteran (Vic: chat), Mitglied (Ada, Max: the
 * default) and Rekrut (Rex, none).
 */
const LIST: GuildRank[] = [
  { id: 'r0', name: 'Leitung', rights: [...GUILD_RIGHTS] },
  {
    id: 'r1',
    name: 'Offizier',
    rights: ['applications', 'remove', 'assign', 'ranks'],
  },
  { id: 'r2', name: 'Veteran', rights: ['chat-read'] },
  { id: 'r3', name: 'Mitglied', rights: [] },
  { id: 'r4', name: 'Rekrut', rights: [] },
];

const MEMBERS: Record<string, string> = {
  u_Lea: 'r0',
  u_Oli: 'r1',
  u_Vic: 'r2',
  u_Ada: 'r3',
  u_Max: 'r3',
  u_Rex: 'r4',
};

function page(
  uid: string,
  over: { list?: GuildRank[]; default?: string } = {},
): string {
  const list = over.list ?? LIST;
  const rank = MEMBERS[uid]!;
  const own = list.find((r) => r.id === rank)!;
  const state: GuildState = {
    directory: [
      {
        id: 'g1',
        tag: 'OR',
        name: 'Outer Rim',
        html: '',
        members: Object.keys(MEMBERS).map((id, i) => ({
          id,
          name: id.slice(2),
          points: 10 - i,
        })),
        score: 45,
        average: 7,
      },
    ],
    own: { id: 'g1', status: 'member' },
    management: { id: 'g1', description: '', pending: [] },
    ranks: {
      lead: 'u_Lea',
      rank,
      rights: own.rights as GuildRight[],
      default: over.default ?? 'r3',
      list,
      members: MEMBERS,
    },
    chat: null,
  };
  const s = {
    me: { id: uid },
    guilds: state,
    admin: null,
  } as unknown as GameState;
  return guilds({ s, ui: { guild: 'g1' } } as unknown as V);
}

/** A button as „action target flag“; none for navigation and the chat. */
function button(tag: string): string | null {
  const act = /data-act="([^"]+)"/.exec(tag)?.[1] ?? 'nav';
  if (act === 'nav' || act.startsWith('guildChat')) return null;
  const target = /data-(?:rank|uid)="([^"]+)"/.exec(tag)?.[1];
  const flag = /data-(up|transfer|accept)="1"/.exec(tag)?.[1];
  return [act, target, flag].filter(Boolean).join(' ');
}

/** Every rank and member control: its action, its target, and the ranks offered. */
function controls(html: string): string[] {
  const buttons = [...html.matchAll(/<button[^>]*>/g)]
    .map(([tag]) => button(tag))
    .filter((b): b is string => b !== null);
  const offers = [
    ...html.matchAll(/<select id="rank_of_([^"]+)"[^>]*>(.*?)<\/select>/g),
  ].map(
    ([, id, options]) =>
      `offers ${id}: ${[...options!.matchAll(/value="([^"]+)"/g)].map((m) => m[1]).join(',')}`,
  );
  const form = html.includes('id="rank_new"') ? ['rankCreate form'] : [];
  return [...buttons, ...offers, ...form];
}

/** A guild with `n` ranks below the five: X0, X1, … without rights. */
const longer = (n: number): GuildRank[] => [
  ...LIST,
  ...Array.from({ length: n }, (_, i) => ({
    id: `x${i}`,
    name: `X${i}`,
    rights: [],
  })),
];

const MEMBER_ROW = (uid: string, lead: boolean) => [
  ...(lead ? [`guildMember ${uid} transfer`] : []),
  `guildAssign ${uid}`,
  `guildMember ${uid}`,
];

describe('the controls each rank sees (#163, #214)', () => {
  it('offers the Leitung every member and every rank below it', () => {
    expect(controls(page('u_Lea'))).toEqual([
      ...['u_Oli', 'u_Vic', 'u_Ada', 'u_Max', 'u_Rex'].flatMap((u) =>
        MEMBER_ROW(u, true),
      ),
      'guildDissolve',
      // Offizier: no rank above it below the Leitung.
      ...['rankRename r1', 'rankRights r1', 'rankMove r1'],
      ...['rankDelete r1', 'rankDefault r1'],
      ...['rankRename r2', 'rankRights r2', 'rankMove r2 up', 'rankMove r2'],
      ...['rankDelete r2', 'rankDefault r2'],
      // Mitglied, the default rank: neither deleted nor chosen again.
      ...['rankRename r3', 'rankRights r3', 'rankMove r3 up', 'rankMove r3'],
      // Rekrut, the last rank: no move down.
      ...['rankRename r4', 'rankRights r4', 'rankMove r4 up'],
      ...['rankDelete r4', 'rankDefault r4'],
      'rankCreate',
      ...['u_Oli', 'u_Vic', 'u_Ada', 'u_Max', 'u_Rex'].map(
        (u) => `offers ${u}: r1,r2,r3,r4`,
      ),
      'rankCreate form',
    ]);
  });

  it('offers a rank with rights only what is below it and what it could give', () => {
    expect(controls(page('u_Oli'))).toEqual([
      // Not the Leitung, not the own rank; no hand-over.
      ...['u_Vic', 'u_Ada', 'u_Max', 'u_Rex'].flatMap((u) =>
        MEMBER_ROW(u, false),
      ),
      'guildLeave',
      // Veteran: no move up past the own rank. Its member would move to
      // Mitglied, the default, which holds no right the Offizier lacks.
      ...['rankRename r2', 'rankRights r2', 'rankMove r2', 'rankDelete r2'],
      ...['rankRename r3', 'rankRights r3', 'rankMove r3 up', 'rankMove r3'],
      ...['rankRename r4', 'rankRights r4', 'rankMove r4 up', 'rankDelete r4'],
      'rankCreate',
      // Veteran holds „chat-read“, which the Offizier lacks.
      ...['u_Vic', 'u_Ada', 'u_Max', 'u_Rex'].map((u) => `offers ${u}: r3,r4`),
      'rankCreate form',
    ]);
  });

  it('offers deleting a rank with members only towards a default rank the actor could give', () => {
    const deletes = (d: string) =>
      controls(page('u_Oli', { default: d })).filter((c) =>
        c.startsWith('rankDelete'),
      );
    expect(deletes('r3')).toEqual(['rankDelete r2', 'rankDelete r4']);
    expect(deletes('r4')).toEqual(['rankDelete r2', 'rankDelete r3']);
    // The default Veteran holds a right the Offizier lacks.
    expect(deletes('r2')).toEqual([]);
    // No default rank known: nothing to delete.
    expect(deletes('none')).toEqual([]);
  });

  it('offers members without the rights only „Gilde verlassen“', () => {
    for (const u of ['u_Vic', 'u_Ada', 'u_Max', 'u_Rex'])
      expect(controls(page(u))).toEqual(['guildLeave']);
  });

  it('offers a new rank only below 25 ranks', () => {
    expect(controls(page('u_Lea', { list: longer(19) }))).toContain(
      'rankCreate form',
    );
    const full = controls(page('u_Lea', { list: longer(20) }));
    expect(full).not.toContain('rankCreate form');
    expect(full).not.toContain('rankCreate');
    expect(full).toContain('rankMove x18');
    expect(full).not.toContain('rankMove x19');
    expect(full).toContain('rankDelete x19');
  });
});

describe('the profile form (#68)', () => {
  it('keeps the limits of the inputs', () => {
    const html = page('u_Lea');
    expect(html).toContain(
      '<input id="guild_tag" required minlength="2" maxlength="8"',
    );
    expect(html).toContain(
      '<input id="guild_name" required minlength="3" maxlength="32"',
    );
    expect(html).toContain('rows="6" maxlength="6000"');
  });
});
