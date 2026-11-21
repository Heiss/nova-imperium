// What the journal of the round keeps of the input of an action (#235, owner
// 2026-11-20: central capture at the entry points). An ALLOW-LIST per action
// and field: a field that is not listed is never stored, so a secret, a free
// text or an account name of a new action cannot get into the history of the
// round by accident (the guard test `journal.test.ts` fails when an action or
// a field of its input has no entry here). Four kinds of field:
//   keep      an id, a key, a number, a switch or a place: stored as sent
//             (strings up to 64 characters, nested lists and objects of the
//             same, at most 400 characters of JSON; more is stored as its size);
//   length    a free text (a name, a description, a chat message): only the
//             number of its characters, never the text;
//   seat      an account id: the seat of that account in the round, so the
//             pseudonym of a deleted account applies;
//   seatByName  an account name: the seat of the account of that name.
// Not listed on purpose: passwords, codes, tokens, e-mail addresses (no action
// takes a token or an e-mail address; the password of the abandon action of
// #224 is the only secret), the guild tag typed to confirm a dissolution.
import type { Ctx } from './context.ts';

type Field = 'keep' | 'length' | 'seat' | 'seatByName';
/** `scalars`: every field of the input that is a number or a switch (the rules of a round, the settings). */
type Spec = Readonly<Record<string, Field>> | 'scalars';

/** The input fields of every action, by action name; `{}` is an action without input. */
export const INPUT: Readonly<Record<string, Spec>> = {
  // The core game.
  build: { planet: 'keep', at: 'keep', key: 'keep' },
  cancelBuild: { planet: 'keep' },
  research: { planet: 'keep', key: 'keep' },
  cancelResearch: {},
  order: { planet: 'keep', key: 'keep', n: 'keep' },
  cancelOrder: { planet: 'keep', key: 'keep', pos: 'keep' },
  pct: { planet: 'keep', key: 'keep', v: 'keep' },
  rename: { planet: 'keep', name: 'length' },
  options: { explain: 'keep', levelTable: 'keep', probes: 'keep' },
  read: {},
  delrep: { id: 'keep' },
  delall: {},
  demolish: { planet: 'keep', key: 'keep' },
  mainPlanet: { main: 'keep' },
  // Fleets, missions and what flies.
  send: {
    planet: 'keep',
    mission: 'keep',
    to: 'keep',
    ships: 'keep',
    cargo: 'keep',
    pct: 'keep',
    hold: 'keep',
    stay: 'keep',
    union: 'keep',
    id: 'keep',
  },
  recall: { id: 'keep' },
  missile: { planet: 'keep', to: 'keep', n: 'keep', aim: 'keep' },
  tearDownMissiles: { planet: 'keep', key: 'keep', n: 'keep' },
  jump: { planet: 'keep', ships: 'keep', to: 'keep' },
  scan: { planet: 'keep', target: 'keep' },
  trade: { planet: 'keep', give: 'keep', get: 'keep', amount: 'keep' },
  openUnion: { id: 'keep', name: 'length' },
  inviteUnion: { id: 'keep', name: 'seatByName' },
  // The account and its rewards.
  abandon: { target: 'keep', created: 'keep' },
  claimAchievement: { id: 'keep' },
  claimDailyReward: {},
  startVacation: {},
  endVacation: {},
  pushOptions: { off: 'keep' },
  // Friends.
  requestFriend: { name: 'seatByName' },
  answerFriend: { uid: 'seat', accept: 'keep' },
  cancelFriend: { uid: 'seat' },
  removeFriend: { uid: 'seat' },
  // Guilds and their chat: names, tags, descriptions and texts only as length.
  createGuild: { tag: 'length', name: 'length', description: 'length' },
  updateGuild: { tag: 'length', name: 'length', description: 'length' },
  applyToGuild: { id: 'keep' },
  reviewGuildApplication: { uid: 'seat', accept: 'keep' },
  leaveGuild: {},
  manageGuildMember: { uid: 'seat', transfer: 'keep', rank: 'keep' },
  dissolveGuild: { tag: 'length' },
  createGuildRank: { name: 'length' },
  renameGuildRank: { rank: 'keep', name: 'length' },
  setGuildRankRights: { rank: 'keep', rights: 'keep' },
  moveGuildRank: { rank: 'keep', up: 'keep' },
  deleteGuildRank: { rank: 'keep' },
  setGuildDefaultRank: { rank: 'keep' },
  assignGuildRank: { uid: 'seat', rank: 'keep' },
  sendGuildChat: { text: 'length' },
  deleteGuildChat: { id: 'keep' },
  seeGuildChat: { id: 'keep' },
  // Private messages (#226): the text only as length, the other player by seat or as the name's seat.
  sendPrivateMessage: { name: 'seatByName', text: 'length' },
  readPrivateMessages: { name: 'seatByName' },
  deletePrivateMessage: { id: 'keep' },
  deletePrivateConversation: { name: 'seatByName' },
  reportPrivateMessage: { id: 'keep' },
  blockPlayer: { name: 'seatByName' },
  unblockPlayer: { name: 'seatByName' },
  privateMessageOptions: { friendsOnly: 'keep' },
  olderPrivateMessages: { before: 'keep' },
  openPrivateConversation: { name: 'seatByName' },
  sentPrivateMessages: { before: 'keep' },
  // The round archive.
  roundArchive: {},
  roundHistory: {},
  roundParticipant: { round: 'keep', seat: 'keep' },
  roundReport: { round: 'keep' },
  roundRewind: { round: 'keep' },
  // The admin.
  settings: { settings: 'keep' },
  reset: 'scalars',
  endzeit: { minutes: 'keep' },
  closeRound: {},
  deleteRound: { round: 'keep' },
};

const MAX_TEXT = 64;
const MAX_JSON = 400;

const isScalar = (v: unknown): v is number | boolean | null =>
  v === null || typeof v === 'number' || typeof v === 'boolean';

/** A value as the journal keeps it: scalars, short strings, nested lists and objects of them. */
function kept(v: unknown, depth = 0): unknown {
  if (isScalar(v)) return v;
  if (typeof v === 'string')
    return v.length <= MAX_TEXT ? v : { len: v.length };
  if (depth >= 3 || typeof v !== 'object') return undefined;
  if (Array.isArray(v)) return v.map((x) => kept(x, depth + 1) ?? null);
  const entries = Object.entries(v).map(([k, x]) => [k, kept(x, depth + 1)]);
  return Object.fromEntries(entries.filter(([, x]) => x !== undefined));
}

/** `kept`, and its size when the JSON is longer than the bound. */
function bounded(v: unknown): unknown {
  const k = kept(v);
  if (k === undefined) return undefined;
  const size = JSON.stringify(k).length;
  return size <= MAX_JSON ? k : { size };
}

/** How one field of the input is stored, or undefined when it is not. */
function storedField(
  ctx: Ctx,
  seatOf: (id: string) => number | null,
  how: Field | undefined,
  value: unknown,
): unknown {
  if (how === 'keep') return bounded(value);
  if (typeof value !== 'string') return undefined;
  if (how === 'length') return value.length;
  if (how === 'seat') return seatOf(value);
  if (how === 'seatByName') {
    const other = ctx.players.byName(value);
    return other ? seatOf(other.id) : null;
  }
  return undefined;
}

const specOf = (type: string): Spec =>
  Object.hasOwn(INPUT, type) ? INPUT[type]! : {};

/** The input of an action as the journal keeps it; the field `type` is the cause and not part of it. */
export function inputOf(
  ctx: Ctx,
  seatOfAccount: (id: string) => number | null,
  type: string,
  d: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const spec = specOf(type);
  const one = (field: string, value: unknown): unknown => {
    if (spec === 'scalars') return isScalar(value) ? value : undefined;
    const how = Object.hasOwn(spec, field) ? spec[field] : undefined;
    return storedField(ctx, seatOfAccount, how, value);
  };
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(d)) {
    const stored = field === 'type' ? undefined : one(field, value);
    if (stored !== undefined && stored !== null) out[field] = stored;
  }
  return out;
}

/** The string values of the fields that are not stored as they were sent: a refusal must not quote them. */
export function hiddenTexts(
  type: string,
  d: Readonly<Record<string, unknown>>,
): string[] {
  const spec = specOf(type);
  // The rules of a round (`'scalars'`) list no field: the entries of that
  // string are its characters, none of which is `'keep'`.
  const kept = new Set(
    Object.entries(spec)
      .filter(([, how]) => how === 'keep')
      .map(([field]) => field),
  );
  return Object.entries(d)
    .filter(
      ([field, value]) =>
        field !== 'type' &&
        typeof value === 'string' &&
        value.length >= 2 &&
        !kept.has(field),
    )
    .map(([, value]) => value as string);
}
