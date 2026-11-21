import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyError,
  assignRankError,
  createGuildError,
  createRankError,
  defaultRankError,
  deleteRankError,
  dissolveError,
  findRank,
  leaveError,
  managedError,
  manageMemberError,
  MAX_GUILD_NAME,
  MAX_GUILD_TAG,
  MAX_GUILD_TEXT,
  MIN_GUILD_NAME,
  MIN_GUILD_TAG,
  moveRankError,
  profileError,
  rankRoomError,
  renameRankError,
  reviewError,
  rightsError,
  updateGuildError,
  type ActorRule,
  type GuildProfile,
  type RankEntry,
} from './guild-checks.ts';
import {
  GUILD_RIGHTS,
  MAX_GUILD_RANKS,
  type GuildRight,
} from './guild-ranks.ts';

// The check of each guild action (#214): one pure function per action that
// returns the code of its first refusal in the order of the server, or null.
// Places: 0 the Leitung, a larger number a lower rank, Infinity no rank.
const ALL: GuildRight[] = [...GUILD_RIGHTS];

const actor = (
  position: number,
  rights: GuildRight[] = ALL,
  lead = position === 0,
): ActorRule => ({ lead, position, rights });

const LEAD = actor(0);

/** A guild of four ranks: Leitung, Offizier, Mitglied, Rekrut. */
const RANKS: RankEntry[] = [
  { id: 'l', name: 'Leitung', position: 0, rights: ALL },
  { id: 'o', name: 'Offizier', position: 1, rights: ['ranks', 'assign'] },
  { id: 'm', name: 'Mitglied', position: 2, rights: ['chat-read'] },
  { id: 'r', name: 'Rekrut', position: 3, rights: [] },
];

const OFFICER = actor(1, ['ranks', 'assign', 'remove']);

const good: GuildProfile = { tag: 'NOVA', name: 'Nova', description: '' };

describe('limits of a guild profile (#68)', () => {
  it('keeps the numbers the form and the server have always used', () => {
    expect([MIN_GUILD_TAG, MAX_GUILD_TAG]).toEqual([2, 8]);
    expect([MIN_GUILD_NAME, MAX_GUILD_NAME]).toEqual([3, 32]);
    expect(MAX_GUILD_TEXT).toBe(6000);
  });
});

describe('profileError', () => {
  it('takes a tag of 2 to 8 capital letters or digits', () => {
    for (const tag of ['AB', 'A1', '12345678', 'ABCDEFGH'])
      expect(profileError({ ...good, tag }, false)).toBeNull();
    for (const tag of [
      '',
      'A',
      'ABCDEFGHI',
      'ab',
      'A-B',
      'A B',
      'ÄB',
      'xAB',
      'ABx',
    ])
      expect(profileError({ ...good, tag }, false)).toBe('tag');
  });

  it('takes a name of 3 to 32 characters', () => {
    expect(profileError({ ...good, name: 'abc' }, false)).toBeNull();
    expect(profileError({ ...good, name: 'a'.repeat(32) }, false)).toBeNull();
    expect(profileError({ ...good, name: 'ab' }, false)).toBe('name');
    expect(profileError({ ...good, name: 'a'.repeat(33) }, false)).toBe('name');
  });

  it('takes a text of at most 6,000 characters', () => {
    const at = (n: number) =>
      profileError({ ...good, description: 'x'.repeat(n) }, false);
    expect(at(6000)).toBeNull();
    expect(at(6001)).toBe('text');
  });

  it('refuses a taken tag or name last', () => {
    expect(profileError(good, true)).toBe('taken');
    expect(profileError({ ...good, tag: 'a' }, true)).toBe('tag');
    expect(profileError({ ...good, name: 'a' }, true)).toBe('name');
    expect(profileError({ ...good, description: 'x'.repeat(6001) }, true)).toBe(
      'text',
    );
  });

  it('checks the tag before the name and the name before the text', () => {
    const bad = { tag: 'a', name: 'a', description: 'x'.repeat(6001) };
    expect(profileError(bad, false)).toBe('tag');
    expect(profileError({ ...bad, tag: 'AB' }, false)).toBe('name');
  });
});

describe('createGuildError and updateGuildError', () => {
  it('refuses a member or applicant before the profile', () => {
    expect(createGuildError(true, { ...good, tag: '' }, true)).toBe('member');
    expect(createGuildError(false, good, false)).toBeNull();
    expect(createGuildError(false, { ...good, tag: '' }, false)).toBe('tag');
    expect(createGuildError(false, good, true)).toBe('taken');
  });

  it('needs the right „profile“ before the profile', () => {
    expect(
      updateGuildError(actor(1, ['remove']), { ...good, tag: '' }, true),
    ).toBe('right');
    expect(updateGuildError(actor(1, ['profile']), good, false)).toBeNull();
    expect(updateGuildError(actor(1, ['profile']), good, true)).toBe('taken');
  });
});

describe('applyError, reviewError, leaveError', () => {
  it('lets a player without a guild apply to one that exists', () => {
    expect(applyError(true, false)).toBe('member');
    expect(applyError(true, true)).toBe('member');
    expect(applyError(false, false)).toBe('guild');
    expect(applyError(false, true)).toBeNull();
  });

  it('reviews an open application with the right „applications“', () => {
    expect(reviewError(actor(1, ['remove']), false)).toBe('right');
    expect(reviewError(actor(1, ['applications']), false)).toBe('application');
    expect(reviewError(actor(1, ['applications']), true)).toBeNull();
  });

  it('lets the Leitung leave only without other members', () => {
    expect(leaveError(false, true, true)).toBe('none');
    expect(leaveError(true, true, true)).toBe('handover');
    expect(leaveError(true, true, false)).toBeNull();
    expect(leaveError(true, false, true)).toBeNull();
    expect(leaveError(true, false, false)).toBeNull();
  });
});

describe('findRank', () => {
  it('finds a rank by its id', () => {
    expect(findRank(RANKS, 'm')).toBe(RANKS[2]);
    expect(findRank(RANKS, 'x')).toBeUndefined();
    expect(findRank(RANKS, undefined)).toBeUndefined();
  });
});

describe('manageMemberError', () => {
  it('refuses an unknown member and oneself first', () => {
    expect(manageMemberError(LEAD, undefined, null)).toBe('member');
    expect(manageMemberError(LEAD, { place: 2, self: true }, null)).toBe(
      'member',
    );
    expect(
      manageMemberError(actor(3, []), undefined, { ranks: RANKS, rank: 'x' }),
    ).toBe('member');
  });

  it('removes a lower member with the right „remove“', () => {
    const t = (place: number) => ({ place, self: false });
    expect(manageMemberError(OFFICER, t(2), null)).toBeNull();
    expect(manageMemberError(OFFICER, t(Infinity), null)).toBeNull();
    expect(manageMemberError(OFFICER, t(1), null)).toBe('lower');
    expect(manageMemberError(OFFICER, t(0), null)).toBe('lower');
    expect(manageMemberError(actor(1, ['assign']), t(2), null)).toBe('right');
    expect(manageMemberError(actor(1, ['assign']), t(0), null)).toBe('right');
  });

  it('hands over the Leitung with the own new rank below the Leitung', () => {
    const t = { place: 2, self: false };
    const to = (rank: unknown) => ({ ranks: RANKS, rank });
    expect(manageMemberError(LEAD, t, to('o'))).toBeNull();
    expect(manageMemberError(LEAD, t, to('l'))).toBe('leitung');
    expect(manageMemberError(LEAD, t, to('x'))).toBe('rank');
    expect(manageMemberError(OFFICER, t, to('o'))).toBe('lead');
  });
});

describe('managedError', () => {
  it('needs the right „ranks“, a rank of the guild, below the actor', () => {
    expect(managedError(actor(1, ['assign']), RANKS, 'm')).toBe('right');
    expect(managedError(OFFICER, RANKS, 'x')).toBe('rank');
    expect(managedError(OFFICER, RANKS, 'o')).toBe('lower');
    expect(managedError(OFFICER, RANKS, 'l')).toBe('lower');
    expect(managedError(OFFICER, RANKS, 'm')).toBeNull();
    expect(managedError(LEAD, RANKS, 'o')).toBeNull();
    expect(managedError(LEAD, RANKS, 'l')).toBe('lower');
  });
});

describe('createRankError and renameRankError', () => {
  it('creates a rank with the right, below the limit, with a free name', () => {
    expect(createRankError(actor(1, ['assign']), RANKS, '')).toBe('right');
    expect(createRankError(OFFICER, RANKS, 'Veteran')).toBeNull();
    expect(createRankError(OFFICER, RANKS, 'x')).toBe('length');
    expect(createRankError(OFFICER, RANKS, 'REKRUT')).toBe('taken');
    const ranks = (n: number): RankEntry[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `r${i}`,
        name: `Rang ${i}`,
        position: i,
        rights: [],
      }));
    expect(createRankError(LEAD, ranks(MAX_GUILD_RANKS - 1), 'Neu')).toBeNull();
    expect(createRankError(LEAD, ranks(MAX_GUILD_RANKS), 'Neu')).toBe('full');
    expect(createRankError(LEAD, ranks(MAX_GUILD_RANKS), '')).toBe('full');
    // The part of it the guild view asks: no name yet.
    expect(rankRoomError(actor(1, ['assign']), RANKS)).toBe('right');
    expect(rankRoomError(LEAD, ranks(MAX_GUILD_RANKS))).toBe('full');
    expect(rankRoomError(LEAD, ranks(MAX_GUILD_RANKS - 1))).toBeNull();
  });

  it('renames a managed rank, also to its own name in another case', () => {
    expect(renameRankError(OFFICER, RANKS, 'o', 'Neu')).toBe('lower');
    expect(renameRankError(OFFICER, RANKS, 'm', 'x')).toBe('length');
    expect(renameRankError(OFFICER, RANKS, 'm', 'rekrut')).toBe('taken');
    expect(renameRankError(OFFICER, RANKS, 'm', 'MITGLIED')).toBeNull();
    expect(renameRankError(OFFICER, RANKS, 'x', 'x')).toBe('rank');
  });
});

describe('rightsError', () => {
  it('changes known rights of a managed rank that the actor holds', () => {
    expect(rightsError(OFFICER, RANKS, 'o', ['ranks'])).toBe('lower');
    expect(rightsError(OFFICER, RANKS, 'm', 'ranks')).toBe('unknown');
    expect(rightsError(OFFICER, RANKS, 'm', null)).toBe('unknown');
    expect(rightsError(OFFICER, RANKS, 'm', ['ranks', 'nope'])).toBe('unknown');
    expect(rightsError(OFFICER, RANKS, 'm', ['profile'])).toBe('change');
    // Taking a right the actor lacks is refused too.
    expect(rightsError(OFFICER, RANKS, 'm', [])).toBe('change');
    expect(rightsError(OFFICER, RANKS, 'm', ['chat-read', 'ranks'])).toBeNull();
    expect(rightsError(LEAD, RANKS, 'm', [])).toBeNull();
    expect(rightsError(OFFICER, RANKS, 'x', 1)).toBe('rank');
  });
});

describe('moveRankError', () => {
  it('moves a managed rank past a neighbour below the actor', () => {
    expect(moveRankError(OFFICER, RANKS, 'o', true)).toBe('lower');
    expect(moveRankError(OFFICER, RANKS, 'm', true)).toBe('lower');
    expect(moveRankError(OFFICER, RANKS, 'r', true)).toBeNull();
    expect(moveRankError(OFFICER, RANKS, 'm', false)).toBeNull();
    expect(moveRankError(OFFICER, RANKS, 'r', false)).toBe('end');
    expect(moveRankError(LEAD, RANKS, 'o', true)).toBe('lower');
    expect(moveRankError(LEAD, RANKS, 'o', false)).toBeNull();
    expect(moveRankError(actor(1, []), RANKS, 'm', true)).toBe('right');
  });
});

describe('deleteRankError', () => {
  it('never deletes the default rank', () => {
    expect(deleteRankError(LEAD, RANKS, 'm', 'm', false)).toBe('default');
    expect(deleteRankError(OFFICER, RANKS, 'o', 'o', false)).toBe('lower');
  });

  it('deletes a rank without members freely', () => {
    expect(deleteRankError(OFFICER, RANKS, 'r', 'o', false)).toBeNull();
    expect(deleteRankError(OFFICER, RANKS, 'r', 'x', false)).toBeNull();
  });

  it('moves the members only to a default rank the actor could give', () => {
    // „Mitglied“ holds „chat-read“, which the officer lacks.
    expect(deleteRankError(OFFICER, RANKS, 'r', 'm', true)).toBe('members');
    expect(deleteRankError(OFFICER, RANKS, 'r', 'o', true)).toBe('members');
    expect(deleteRankError(OFFICER, RANKS, 'r', 'x', true)).toBe('members');
    expect(deleteRankError(LEAD, RANKS, 'r', 'm', true)).toBeNull();
    const ranks = RANKS.map((r) => (r.id === 'm' ? { ...r, rights: [] } : r));
    expect(deleteRankError(OFFICER, ranks, 'r', 'm', true)).toBeNull();
  });

  it('checks the managed rank first', () => {
    expect(deleteRankError(actor(1, []), RANKS, 'r', 'r', true)).toBe('right');
    expect(deleteRankError(OFFICER, RANKS, 'x', 'x', true)).toBe('rank');
  });
});

describe('defaultRankError', () => {
  it('lets only the Leitung choose a rank below the Leitung', () => {
    expect(defaultRankError(LEAD, RANKS, 'r')).toBeNull();
    expect(defaultRankError(LEAD, RANKS, 'o')).toBeNull();
    expect(defaultRankError(LEAD, RANKS, 'l')).toBe('leitung');
    expect(defaultRankError(LEAD, RANKS, 'x')).toBe('rank');
    // The rights of a rank never make it the Leitung.
    expect(defaultRankError(actor(1, ALL, false), RANKS, 'x')).toBe('lead');
  });
});

describe('assignRankError', () => {
  it('needs the right, a member, a rank, then the rules of assignError', () => {
    expect(assignRankError(actor(1, ['ranks']), undefined, RANKS, 'x')).toBe(
      'right',
    );
    expect(assignRankError(OFFICER, undefined, RANKS, 'x')).toBe('member');
    expect(assignRankError(OFFICER, 3, RANKS, 'x')).toBe('rank');
    expect(assignRankError(OFFICER, 1, RANKS, 'r')).toBe('lower');
    expect(assignRankError(OFFICER, 3, RANKS, 'o')).toBe('lower');
    expect(assignRankError(OFFICER, 3, RANKS, 'm')).toBe('rights');
    expect(assignRankError(OFFICER, 2, RANKS, 'r')).toBeNull();
    expect(assignRankError(OFFICER, 0, RANKS, 'r')).toBe('lower');
    expect(assignRankError(LEAD, 1, RANKS, 'm')).toBeNull();
  });
});

describe('dissolveError', () => {
  it('lets only the Leitung dissolve, with the tag in any case', () => {
    expect(dissolveError(LEAD, 'nova', 'NOVA')).toBeNull();
    expect(dissolveError(LEAD, 'NOVA', 'nova')).toBeNull();
    expect(dissolveError(LEAD, 'NOV', 'NOVA')).toBe('tag');
    expect(dissolveError(LEAD, '', 'NOVA')).toBe('tag');
    expect(dissolveError(actor(1, ALL, false), 'NOVA', 'NOVA')).toBe('lead');
  });
});

describe('properties', () => {
  const place = fc.oneof(fc.nat(30), fc.constant(Infinity));
  const rights = fc.subarray(ALL);

  it('never lets a member act on a rank at or above its own', () => {
    fc.assert(
      fc.property(place, rights, fc.nat(3), (at, own, i) => {
        const a = actor(at, own, at === 0);
        const rank = RANKS[i]!;
        if (rank.position > at) return;
        expect(managedError(a, RANKS, rank.id)).not.toBeNull();
        expect(renameRankError(a, RANKS, rank.id, 'Neuer Name')).not.toBeNull();
        expect(rightsError(a, RANKS, rank.id, [])).not.toBeNull();
        expect(moveRankError(a, RANKS, rank.id, false)).not.toBeNull();
        expect(deleteRankError(a, RANKS, rank.id, 'r', false)).not.toBeNull();
      }),
    );
  });

  it('never assigns a rank holding a right the actor lacks', () => {
    fc.assert(
      fc.property(place, rights, fc.nat(3), place, (at, own, i, member) => {
        const rank = RANKS[i]!;
        const ok =
          assignRankError(actor(at, own, at === 0), member, RANKS, rank.id) ===
          null;
        if (ok) expect(rank.rights.every((r) => own.includes(r))).toBe(true);
      }),
    );
  });
});
