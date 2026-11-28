// The rights of the guild ranks register themselves (#426 part 5).
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assembleRights,
  GUILD_RIGHTS,
  type GuildRight,
  MEMBER_RIGHTS,
  RIGHT_TEXT,
} from './guild-ranks.ts';
import { GUILD_RIGHT_LISTS } from './guild-rights/rights.gen.ts';

const entry = (key: string, order: number, member?: boolean) => ({
  key,
  order,
  label: key,
  ...(member === undefined ? {} : { member }),
});

describe('the guild rights register themselves (#426)', () => {
  it('is a type of exactly the eight rights, not any string', () => {
    expectTypeOf<GuildRight>().toEqualTypeOf<
      | 'applications'
      | 'remove'
      | 'assign'
      | 'profile'
      | 'ranks'
      | 'chat-read'
      | 'chat-write'
      | 'chat-delete'
    >();
  });

  it('sorts the rights of all files by their order, not by the files', () => {
    expect(
      assembleRights([
        ['b', [entry('x', 30), entry('y', 10)]],
        ['a', [entry('z', 20, true)]],
      ]).map((r) => r.key),
    ).toEqual(['y', 'z', 'x']);
    expect(assembleRights([])).toEqual([]);
  });

  it('stops at a key or an order defined twice and names both files', () => {
    expect(() =>
      assembleRights([
        ['a', [entry('x', 10)]],
        ['b', [entry('x', 20)]],
      ]),
    ).toThrow(
      'Guild right key x is defined twice: in src/core/guild-rights/a.ts and in src/core/guild-rights/b.ts.',
    );
    expect(() =>
      assembleRights([
        ['a', [entry('x', 10)]],
        ['b', [entry('y', 10)]],
      ]),
    ).toThrow(
      'Guild right order 10 is defined twice: in src/core/guild-rights/a.ts and in src/core/guild-rights/b.ts.',
    );
  });

  it('stops at a right without an order', () => {
    for (const order of [Number.NaN, Infinity, undefined])
      expect(() =>
        assembleRights([['a', [entry('x', order as number)]]]),
      ).toThrow('Guild right x in src/core/guild-rights/a.ts has no order.');
  });

  it('takes the names and the rights of „Mitglied“ from the entries', () => {
    type Entry = { key: GuildRight; label: string; member?: boolean };
    const entries = GUILD_RIGHT_LISTS.flatMap(
      ([, rights]): readonly Entry[] => rights,
    );
    expect(entries.map((r) => r.key).sort()).toEqual([...GUILD_RIGHTS].sort());
    for (const r of entries) expect(RIGHT_TEXT[r.key]).toBe(r.label);
    expect(Object.keys(RIGHT_TEXT)).toEqual([...GUILD_RIGHTS]);
    expect(entries.filter((r) => r.member === true).map((r) => r.key)).toEqual([
      ...MEMBER_RIGHTS,
    ]);
  });
});
