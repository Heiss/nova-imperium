// The allow-list of the journal input (#235): per action, which fields are
// kept, which are reduced, and that everything else is dropped. Security
// relevant (no password, code, token, e-mail address or free text may reach
// the history of the round), so every action and field is pinned here by hand,
// independent of the table in journal-input.ts.
import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../test-helpers.ts';
import { hiddenTexts, INPUT, inputOf } from './journal-input.ts';

interface Kinds {
  keep?: string[];
  length?: string[];
  seat?: string[];
  name?: string[];
}

/** Per action: the fields by how the journal stores them (`name` = account name stored as a seat). */
const KINDS: Record<string, Kinds> = {
  build: { keep: ['planet', 'at', 'key'] },
  cancelBuild: { keep: ['planet'] },
  research: { keep: ['planet', 'key'] },
  cancelResearch: {},
  order: { keep: ['planet', 'key', 'n'] },
  cancelOrder: { keep: ['planet', 'key', 'pos'] },
  pct: { keep: ['planet', 'key', 'v'] },
  rename: { keep: ['planet'], length: ['name'] },
  options: { keep: ['explain', 'levelTable', 'probes'] },
  read: {},
  delrep: { keep: ['id'] },
  delall: {},
  demolish: { keep: ['planet', 'key'] },
  mainPlanet: { keep: ['main'] },
  send: {
    keep: [
      'planet',
      'mission',
      'to',
      'ships',
      'cargo',
      'cargoAll',
      'pct',
      'hold',
      'stay',
      'union',
      'id',
    ],
  },
  recall: { keep: ['id'] },
  missile: { keep: ['planet', 'to', 'n', 'aim'] },
  tearDownMissiles: { keep: ['planet', 'key', 'n'] },
  jump: { keep: ['planet', 'ships', 'to'] },
  scan: { keep: ['planet', 'target'] },
  trade: { keep: ['planet', 'give', 'get', 'amount', 'price'] },
  openUnion: { keep: ['id'], length: ['name'] },
  inviteUnion: { keep: ['id'], name: ['name'] },
  abandon: { keep: ['target', 'created'] },
  claimAchievement: { keep: ['id'] },
  claimDailyReward: {},
  startVacation: {},
  endVacation: {},
  pushOptions: { keep: ['off'] },
  sendAway: { keep: ['id'] },
  holdOption: { keep: ['on'] },
  requestFriend: { name: ['name'] },
  answerFriend: { seat: ['uid'], keep: ['accept'] },
  cancelFriend: { seat: ['uid'] },
  removeFriend: { seat: ['uid'] },
  createGuild: { length: ['tag', 'name', 'description'] },
  updateGuild: { length: ['tag', 'name', 'description'] },
  applyToGuild: { keep: ['id'] },
  reviewGuildApplication: { seat: ['uid'], keep: ['accept'] },
  leaveGuild: {},
  manageGuildMember: { seat: ['uid'], keep: ['transfer', 'rank'] },
  dissolveGuild: { length: ['tag'] },
  createGuildRank: { length: ['name'] },
  renameGuildRank: { keep: ['rank'], length: ['name'] },
  setGuildRankRights: { keep: ['rank', 'rights'] },
  moveGuildRank: { keep: ['rank', 'up'] },
  deleteGuildRank: { keep: ['rank'] },
  setGuildDefaultRank: { keep: ['rank'] },
  assignGuildRank: { seat: ['uid'], keep: ['rank'] },
  sendGuildChat: { length: ['text'] },
  deleteGuildChat: { keep: ['id'] },
  seeGuildChat: { keep: ['id'] },
  sendPrivateMessage: { name: ['name'], length: ['text'] },
  readPrivateMessages: { name: ['name'] },
  deletePrivateMessage: { keep: ['id'] },
  deletePrivateConversation: { name: ['name'] },
  reportPrivateMessage: { keep: ['id'] },
  blockPlayer: { name: ['name'] },
  unblockPlayer: { name: ['name'] },
  privateMessageOptions: { keep: ['friendsOnly'] },
  olderPrivateMessages: { keep: ['before'] },
  openPrivateConversation: { name: ['name'] },
  sentPrivateMessages: { keep: ['before'] },
  roundArchive: {},
  roundHistory: {},
  roundParticipant: { keep: ['round', 'seat'] },
  roundReport: { keep: ['round'] },
  roundRewind: { keep: ['round'] },
  settings: { keep: ['settings'] },
  endzeit: { keep: ['minutes'] },
  closeRound: {},
  deleteRound: { keep: ['round'] },
};

const setup = () => {
  const ctx = testCtx();
  addUser(ctx, 'Anna');
  // A fake seat of every account: 7 for any id, so no real round is needed.
  return { ctx, seat: (): number | null => 7 };
};

const ALL_FIELDS = [
  ...new Set(
    Object.values(KINDS).flatMap((k) => [
      ...(k.keep ?? []),
      ...(k.length ?? []),
      ...(k.seat ?? []),
      ...(k.name ?? []),
    ]),
  ),
];
const SECRETS = [
  'password',
  'code',
  'token',
  'email',
  'newPassword',
  'secret',
  'text2',
];

describe('the input allow-list, action by action', () => {
  it('pins an entry for exactly the actions of the table', () => {
    expect(Object.keys(KINDS).sort()).toEqual(
      Object.keys(INPUT)
        .filter((a) => a !== 'reset')
        .sort(),
    );
  });

  it.each(Object.entries(KINDS))(
    '%s keeps, reduces or drops each field as pinned',
    (type, kinds) => {
      const { ctx, seat } = setup();
      // Every known field of every action with a string; the secrets too.
      const d: Record<string, unknown> = { type };
      for (const f of [...ALL_FIELDS, ...SECRETS]) d[f] = 'Anna';
      const expected: Record<string, unknown> = {};
      for (const f of kinds.keep ?? []) expected[f] = 'Anna';
      for (const f of kinds.length ?? []) expected[f] = 4;
      for (const f of kinds.seat ?? []) expected[f] = 7;
      for (const f of kinds.name ?? []) expected[f] = 7;
      expect(inputOf(ctx, seat, type, d)).toStrictEqual(expected);
    },
  );

  it.each(Object.entries(KINDS))(
    '%s drops a text sent in place of a number or a seat, and a seat for an unknown name',
    (type, kinds) => {
      const { ctx, seat } = setup();
      const d: Record<string, unknown> = { type };
      // A number where a text is reduced or a name is looked up: nothing is stored.
      for (const f of [
        ...(kinds.length ?? []),
        ...(kinds.seat ?? []),
        ...(kinds.name ?? []),
      ])
        d[f] = 12;
      expect(inputOf(ctx, seat, type, d)).toStrictEqual({});
      const unknown: Record<string, unknown> = { type };
      for (const f of kinds.name ?? []) unknown[f] = 'Nobody';
      expect(inputOf(ctx, seat, type, unknown)).toStrictEqual({});
    },
  );

  it('keeps a seat that is null out of the row', () => {
    const { ctx } = setup();
    expect(
      inputOf(ctx, () => null, 'answerFriend', {
        type: 'answerFriend',
        uid: 'u_X',
        accept: true,
      }),
    ).toStrictEqual({ accept: true });
  });

  it('stores the seat of the account of a name, and the seat of an id as the callback gives it', () => {
    const { ctx } = setup();
    const ids: string[] = [];
    const seat = (id: string): number | null => (ids.push(id), 3);
    expect(
      inputOf(ctx, seat, 'requestFriend', {
        type: 'requestFriend',
        name: 'Anna',
      }),
    ).toStrictEqual({ name: 3 });
    expect(ids).toEqual(['u_Anna']);
    expect(
      inputOf(ctx, seat, 'removeFriend', { type: 'removeFriend', uid: 'u_Z' }),
    ).toStrictEqual({ uid: 3 });
    expect(ids).toEqual(['u_Anna', 'u_Z']);
  });

  it('never stores a name that is not an account of the round, nor the type of the action', () => {
    const { ctx, seat } = setup();
    expect(
      inputOf(ctx, seat, 'build', { type: 'build', key: 'metal', extra: 1 }),
    ).toStrictEqual({ key: 'metal' });
    expect(inputOf(ctx, seat, 'reset', { type: 5, a: 1 })).toStrictEqual({
      a: 1,
    });
  });

  it('treats a name of the object prototype as no action and no field', () => {
    const { ctx, seat } = setup();
    for (const type of [
      'toString',
      'constructor',
      '__proto__',
      'hasOwnProperty',
    ])
      expect(inputOf(ctx, seat, type, { type, a: 1 })).toStrictEqual({});
    expect(
      inputOf(ctx, seat, 'build', {
        type: 'build',
        toString: 'x',
        constructor: 'y',
        key: 'metal',
      }),
    ).toStrictEqual({ key: 'metal' });
  });

  it('keeps of the rules of a round only the numbers and switches', () => {
    const { ctx, seat } = setup();
    expect(
      inputOf(ctx, seat, 'reset', {
        type: 'reset',
        speed: 2,
        open: false,
        zero: 0,
        none: null,
        text: 'x',
        list: [1],
        deep: { a: 1 },
      }),
    ).toStrictEqual({ speed: 2, open: false, zero: 0 });
  });

  it('never stores the open conversation the browser names in every request (#226)', () => {
    const { ctx, seat } = setup();
    expect(
      inputOf(ctx, seat, 'reset', { type: 'reset', speed: 2, pmAfter: 41 }),
    ).toStrictEqual({ speed: 2 });
    expect(
      inputOf(ctx, seat, 'build', {
        type: 'build',
        key: 'metal',
        pm: 'Anna',
        pmAfter: 41,
      }),
    ).toStrictEqual({ key: 'metal' });
  });
});

describe('how a kept value is stored', () => {
  const keep = (value: unknown): unknown => {
    const { ctx, seat } = setup();
    const out = inputOf(ctx, seat, 'delrep', { type: 'delrep', id: value });
    return Object.hasOwn(out, 'id') ? out.id : 'ABSENT';
  };

  it('keeps numbers, switches and null-free scalars as sent', () => {
    expect(keep(0)).toBe(0);
    expect(keep(-3.5)).toBe(-3.5);
    expect(keep(true)).toBe(true);
    expect(keep(false)).toBe(false);
    expect(keep(null)).toBe('ABSENT');
    expect(keep(undefined)).toBe('ABSENT');
  });

  it('keeps a string up to 64 characters and stores a longer one as its length', () => {
    expect(keep('x'.repeat(64))).toBe('x'.repeat(64));
    expect(keep('x'.repeat(65))).toStrictEqual({ len: 65 });
    expect(keep('')).toBe('');
  });

  it('drops what is no JSON value: a function, a symbol, a big integer', () => {
    expect(keep(() => 1)).toBe('ABSENT');
    expect(keep(Symbol('s'))).toBe('ABSENT');
    expect(keep(10n)).toBe('ABSENT');
  });

  it('keeps lists and objects, with null for what inside a list is not a value', () => {
    expect(keep([1, 'a', true, null])).toStrictEqual([1, 'a', true, null]);
    expect(keep([1, () => 1, undefined, 2])).toStrictEqual([1, null, null, 2]);
    expect(keep({ a: 1, b: { c: [2] } })).toStrictEqual({
      a: 1,
      b: { c: [2] },
    });
    expect(keep({ a: 1, f: () => 1, u: undefined })).toStrictEqual({ a: 1 });
    expect(keep({ s: 'x'.repeat(65), n: null })).toStrictEqual({
      s: { len: 65 },
      n: null,
    });
    expect(keep([])).toStrictEqual([]);
    expect(keep({})).toStrictEqual({});
  });

  it('goes three levels deep and drops what is nested deeper', () => {
    expect(keep({ a: { b: { c: 1 } } })).toStrictEqual({ a: { b: { c: 1 } } });
    expect(keep({ a: { b: { c: { d: 1 } } } })).toStrictEqual({ a: { b: {} } });
    expect(keep([[[1]]])).toStrictEqual([[[1]]]);
    expect(keep([[[[1]]]])).toStrictEqual([[[null]]]);
    expect(keep({ a: [{ b: 1 }] })).toStrictEqual({ a: [{ b: 1 }] });
    expect(keep({ a: [{ b: [1] }] })).toStrictEqual({ a: [{}] });
  });

  it('keeps at most 400 characters of JSON and stores a longer value as its size', () => {
    const list = (last: number): string[] => [
      ...Array.from({ length: 30 }, () => 'a'.repeat(10)),
      'b'.repeat(last),
    ];
    expect(JSON.stringify(list(6)).length).toBe(400);
    expect(keep(list(6))).toStrictEqual(list(6));
    expect(JSON.stringify(list(7)).length).toBe(401);
    expect(keep(list(7))).toStrictEqual({ size: 401 });
  });
});

describe('the texts a refusal must not quote', () => {
  it('lists the strings of the fields that are not kept as sent, at least 2 characters', () => {
    expect(
      hiddenTexts('rename', {
        type: 'rename',
        planet: 'p1_1_5',
        name: 'Zorbalon',
        other: 'ab',
        short: 'a',
        number: 12345,
        empty: '',
      }),
    ).toEqual(['Zorbalon', 'ab']);
  });

  it('leaves out the type and the fields that are kept as sent', () => {
    expect(
      hiddenTexts('build', { type: 'build', planet: 'p1_1_5', key: 'metal' }),
    ).toEqual([]);
    expect(
      hiddenTexts('createGuild', {
        type: 'createGuild',
        tag: 'ZZZ',
        name: 'Geheimbund',
      }),
    ).toEqual(['ZZZ', 'Geheimbund']);
    // The password is no field of any action: it is hidden as every unlisted text.
    expect(
      hiddenTexts('abandon', {
        type: 'abandon',
        target: 'p1_2_6',
        password: 'hunter2',
      }),
    ).toEqual(['hunter2']);
  });

  it('hides every text of the rules of a round, and the fields of an unknown action', () => {
    expect(
      hiddenTexts('reset', { type: 'reset', name: 'Runde', n: 3 }),
    ).toEqual(['Runde']);
    expect(hiddenTexts('reset', { type: 'reset', length: 'xy' })).toEqual([
      'xy',
    ]);
    expect(hiddenTexts('nope', { type: 'nope', a: 'abc' })).toEqual(['abc']);
    expect(hiddenTexts('toString', { type: 'toString', a: 'abc' })).toEqual([
      'abc',
    ]);
  });

  it('leaves out a value that is no text although it has a length', () => {
    expect(
      hiddenTexts('rename', {
        type: 'rename',
        list: [1, 2, 3],
        object: { length: 5 },
        text: 'abc',
      }),
    ).toEqual(['abc']);
  });

  it('hides a text under a field name that only another action keeps', () => {
    expect(hiddenTexts('rename', { type: 'rename', key: 'secret' })).toEqual([
      'secret',
    ]);
    expect(hiddenTexts('rename', { type: 'rename', planet: 'p1' })).toEqual([]);
  });
});
