import { describe, expect, it } from 'vitest';
import {
  assignError,
  belowLeitung,
  canChangeRights,
  changedRights,
  deleteError,
  GUILD_RIGHTS,
  isBelow,
  isGuildRight,
  MEMBER_RIGHTS,
  memberPlace,
  missingRights,
  rankNameError,
  type GuildRight,
} from './guild-ranks.ts';

// The pure rules of the guild ranks (#163), with plain values: places (0 is
// the Leitung, a larger number a lower rank, Infinity no rank) and lists of
// rights. The server and the guild view both use them.
const ALL: GuildRight[] = [...GUILD_RIGHTS];

describe('rights', () => {
  it('knows the eight rights and nothing else', () => {
    expect(GUILD_RIGHTS).toEqual([
      'applications',
      'remove',
      'assign',
      'profile',
      'ranks',
      // The guild chat (#169, D2).
      'chat-read',
      'chat-write',
      'chat-delete',
    ]);
    for (const r of GUILD_RIGHTS) expect(isGuildRight(r)).toBe(true);
    for (const v of [
      'dissolve',
      'transfer',
      'chat',
      'report',
      '',
      null,
      undefined,
      1,
    ])
      expect(isGuildRight(v)).toBe(false);
  });

  it('gives the first default rank reading and writing in the chat (#169, D2)', () => {
    expect(MEMBER_RIGHTS).toEqual(['chat-read', 'chat-write']);
    expect(MEMBER_RIGHTS.every(isGuildRight)).toBe(true);
  });

  it('finds the rights a holder lacks', () => {
    expect(missingRights(['remove'], ['remove', 'profile'])).toEqual([
      'profile',
    ]);
    expect(missingRights(ALL, ALL)).toEqual([]);
    expect(missingRights([], [])).toEqual([]);
    expect(missingRights([], ['ranks', 'assign'])).toEqual(['ranks', 'assign']);
  });

  it('finds the rights that change, in their order', () => {
    expect(changedRights(['remove', 'profile'], ['profile', 'ranks'])).toEqual([
      'remove',
      'ranks',
    ]);
    expect(changedRights(['ranks', 'assign'], ['assign', 'ranks'])).toEqual([]);
    expect(changedRights([], ALL)).toEqual(ALL);
  });

  it('changes only rights the holder holds itself, giving or taking', () => {
    const holder: GuildRight[] = ['ranks', 'applications'];
    expect(canChangeRights(holder, [], ['applications'])).toBe(true);
    expect(canChangeRights(holder, [], ['remove'])).toBe(false);
    // A right the holder lacks stays as it is, set or not.
    expect(canChangeRights(holder, ['profile'], ['profile'])).toBe(true);
    expect(canChangeRights(holder, ['profile'], [])).toBe(false);
    expect(
      canChangeRights(holder, ['profile', 'applications'], ['profile']),
    ).toBe(true);
    expect(canChangeRights(ALL, ['profile'], ['remove'])).toBe(true);
  });
});

describe('the order of the ranks', () => {
  it('places the Leitung at 0 and a member without a rank lowest', () => {
    expect(memberPlace(true, 3)).toBe(0);
    expect(memberPlace(true, undefined)).toBe(0);
    expect(memberPlace(false, 3)).toBe(3);
    expect(memberPlace(false, 0)).toBe(0);
    expect(memberPlace(false, undefined)).toBe(Infinity);
  });

  it('is below only when strictly lower', () => {
    expect(isBelow(0, 1)).toBe(true);
    expect(isBelow(1, 2)).toBe(true);
    expect(isBelow(1, Infinity)).toBe(true);
    expect(isBelow(2, 2)).toBe(false);
    expect(isBelow(2, 1)).toBe(false);
    expect(isBelow(1, 0)).toBe(false);
    expect(isBelow(Infinity, Infinity)).toBe(false);
  });

  it('only a rank below the Leitung is a default or a rank for the old Leitung', () => {
    expect(belowLeitung(0)).toBe(false);
    expect(belowLeitung(1)).toBe(true);
    expect(belowLeitung(7)).toBe(true);
  });
});

describe('rank names', () => {
  const others = [
    { id: 'r0', name: 'Leitung' },
    { id: 'r1', name: 'Mitglied' },
    { id: 'r2', name: 'Älteste' },
  ];

  it('takes 2 to 24 characters (#277)', () => {
    for (const name of ['', 'a', 'x'.repeat(25), 'x'.repeat(67)])
      expect(rankNameError(name, others)).toBe('length');
    for (const name of ['ab', 'x'.repeat(24)])
      expect(rankNameError(name, others)).toBeNull();
  });

  it('refuses a name of the guild in any case, except the rank itself', () => {
    for (const name of ['mitglied', 'LEITUNG', 'ÄLTESTE', 'älteste'])
      expect(rankNameError(name, others)).toBe('taken');
    expect(rankNameError('MITGLIED', others, 'r1')).toBeNull();
    expect(rankNameError('Mitglied', others, 'r2')).toBe('taken');
    expect(rankNameError('Offizier', others)).toBeNull();
    expect(rankNameError('Mitglied', [])).toBeNull();
  });
});

describe('giving a rank to a member (owner, 2026-11-14)', () => {
  const officer = { position: 1, rights: ['assign', 'remove'] as GuildRight[] };

  it('needs the member and the rank below, and every right of the rank', () => {
    expect(assignError(officer, 2, { position: 3, rights: [] })).toBeNull();
    expect(
      assignError(officer, 2, { position: 3, rights: ['remove', 'assign'] }),
    ).toBeNull();
    expect(
      assignError(officer, 2, { position: 3, rights: ['remove', 'profile'] }),
    ).toBe('rights');
    expect(assignError(officer, 1, { position: 3, rights: [] })).toBe('lower');
    expect(assignError(officer, 0, { position: 3, rights: [] })).toBe('lower');
    expect(assignError(officer, 2, { position: 1, rights: [] })).toBe('lower');
    expect(assignError(officer, 2, { position: 0, rights: ALL })).toBe('lower');
    expect(
      assignError(officer, Infinity, { position: 5, rights: ['assign'] }),
    ).toBeNull();
  });

  it('the Leitung holds every right and gives every rank below it', () => {
    const lead = { position: 0, rights: ALL };
    expect(assignError(lead, 1, { position: 2, rights: ALL })).toBeNull();
    expect(assignError(lead, 1, { position: 0, rights: ALL })).toBe('lower');
  });
});

describe('deleting a rank with members (owner, 2026-11-14)', () => {
  const officer = { position: 1, rights: ['ranks', 'remove'] as GuildRight[] };

  it('a rank without members goes whatever the default rank is', () => {
    expect(
      deleteError(officer, false, { position: 1, rights: ALL }),
    ).toBeNull();
  });

  it('its members move only to a default rank below, with no right the actor lacks', () => {
    expect(deleteError(officer, true, { position: 2, rights: [] })).toBeNull();
    expect(
      deleteError(officer, true, { position: 2, rights: ['remove', 'ranks'] }),
    ).toBeNull();
    expect(
      deleteError(officer, true, { position: 2, rights: ['profile'] }),
    ).toBe('default');
    expect(deleteError(officer, true, { position: 1, rights: [] })).toBe(
      'default',
    );
    expect(deleteError(officer, true, { position: 0, rights: [] })).toBe(
      'default',
    );
  });

  it('the Leitung may always delete', () => {
    const lead = { position: 0, rights: ALL };
    expect(deleteError(lead, true, { position: 1, rights: ALL })).toBeNull();
    expect(deleteError(lead, true, { position: 9, rights: [] })).toBeNull();
  });
});
