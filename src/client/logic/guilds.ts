// What the guild pages show (#118, bundle 6; okf/architecture/patterns.md,
// section 9), without the HTML of its parts: the directory, the page of a
// guild with its members, its chat and the ranks of the own guild (#163,
// #169, #277), and the three dialogs. Every decision of the view is made
// here (what the own rank may see and do); the components render the page and
// the buttons carry the `data-act` the handlers of features/guilds.ts read.
import {
  type ChatEventKind,
  chatEventText,
  MAX_CHAT_TEXT,
} from '../../core/guild-chat.ts';
import {
  type ActorRule,
  assignRankError,
  defaultRankError,
  deleteRankError,
  managedError,
  manageMemberError,
  moveRankError,
  type RankEntry as RankRule,
  rankRoomError,
} from '../../core/guild-checks.ts';
import {
  GUILD_RIGHTS,
  type GuildRight,
  isBelow,
  memberPlace,
  RIGHT_TEXT,
} from '../../core/guild-ranks.ts';
import type { V } from '../views/common.ts';
import { arrivalAt, dt, fmt } from './format.ts';
import { highscoreStand } from './highscore.ts';
import type {
  Guild,
  GuildChat,
  GuildChatMessage,
  GuildRank,
  GuildRanks,
  GuildState,
} from './types.ts';

/** The title of a guild: its tag and name. */
const headingOf = (guild: Pick<Guild, 'tag' | 'name'>): string =>
  `[${guild.tag}] ${guild.name}`;

// ----- the chat -----

type ChatLine = Pick<
  GuildChatMessage,
  'id' | 'kind' | 'name' | 'time' | 'text' | 'attacker' | 'arrival'
>;

/** One line of the log: a message with its author, or an event with its sentence (#169; owner, 2026-11-15). */
interface ChatLineModel {
  id: number;
  /** An event of the server: no author, set apart. */
  event: boolean;
  time: string;
  /** The author of a message; none for a former member or a deleted account (owner, D7). */
  name: string | null;
  /** The text of a message, or the sentence of an event. */
  text: string;
  /** „Löschen“ is offered: the own rank may delete this message. */
  deletable: boolean;
}

/** The messages, oldest first; an empty log says so. */
export interface ChatLogModel {
  lines: ChatLineModel[];
}

function chatLine(
  m: ChatLine & { delete?: boolean },
  del: boolean,
): ChatLineModel {
  const event = m.kind !== 'message';
  // The server sends `arrival` for an attack only; a row without one shows none.
  const arrival =
    m.arrival === undefined || m.arrival === null
      ? ''
      : arrivalAt(m.arrival, m.time);
  return {
    id: m.id,
    event,
    time: dt(m.time),
    name: m.name,
    text: event
      ? chatEventText({ ...m, kind: m.kind as ChatEventKind }, arrival)
      : m.text,
    // The server sets `delete` on a message only; the view followed the flag.
    deletable: del && !!m.delete,
  };
}

/** The log of messages; `del` offers „Löschen“ where a message says its rank may. */
export const chatLog = (
  messages: (ChatLine & { delete?: boolean })[],
  del = false,
): ChatLogModel => ({ lines: messages.map((m) => chatLine(m, del)) });

/**
 * The chat of the own guild (#169): the messages with „Chat lesen“, the text
 * field with „Chat schreiben“. The notice that the game master can read it
 * (owner, 2026-11-15) is always there.
 */
export interface ChatBoxModel {
  log: ChatLogModel | null;
  write: boolean;
  max: number;
}

const chatBox = (chat: GuildChat): ChatBoxModel => ({
  log: chat.read ? chatLog(chat.messages, true) : null,
  write: chat.write,
  max: MAX_CHAT_TEXT,
});

// ----- the dialogs -----

/** The chat of a guild as the admin reads it, in the dialog (#169, D8). */
export interface AdminChatPage {
  heading: string;
  log: ChatLogModel;
}

export const adminChatPage = (read: {
  guild: Pick<Guild, 'tag' | 'name'>;
  messages: ChatLine[];
}): AdminChatPage => ({
  heading: headingOf(read.guild),
  log: chatLog(read.messages),
});

/** The hand-over: the member and the ranks below the Leitung, the first preselected (owner, 2026-11-14). */
export interface TransferPage {
  uid: string;
  name: string;
  ranks: { id: string; name: string }[];
}

export const transferPage = (
  ranks: GuildRanks,
  uid: string,
  name: string,
): TransferPage => ({
  uid,
  name,
  ranks: ranks.list.slice(1).map((r) => ({ id: r.id, name: r.name })),
});

/** Dissolving the guild, confirmed with its tag (owner, 2026-11-14). */
export interface DissolvePage {
  tag: string;
}

export const dissolvePage = (g: Pick<Guild, 'tag'>): DissolvePage => ({
  tag: g.tag,
});

// ----- the directory -----

/** The form to found a guild or, for its Leitung, to change it. */
export interface ProfileFormModel {
  edit: boolean;
  tag: string;
  name: string;
  description: string;
}

const profileForm = (guild?: Guild, description = ''): ProfileFormModel => ({
  edit: !!guild,
  tag: guild?.tag ?? '',
  name: guild?.name ?? '',
  description,
});

interface DirectoryRow {
  id: string;
  href: string;
  heading: string;
  members: string;
  /** The sums of the points; null while the highscore shows nothing (#422, 182a). */
  score: string | null;
  average: string | null;
}

/** Points as shown, or null when the state has none (#422, 182a). */
const points = (n: number | undefined): string | null =>
  n === undefined ? null : fmt(n);

/**
 * „Stand: {Uhrzeit}“ of the pass the guild points come from, the words of the
 * highscore (#494); empty while no points are shown (182a) or the state names
 * no pass.
 */
const standOf = (shown: boolean, at: number | undefined): string =>
  shown && at !== undefined ? highscoreStand(at) : '';

/** The list of guilds, and the form to found one for a player without a guild. */
interface DirectoryPage {
  kind: 'directory';
  rows: DirectoryRow[];
  /** Whether the list has the columns of the points (182a). */
  points: boolean;
  /** „Stand: {Uhrzeit}“ of the points, or empty (#494). */
  stand: string;
  create: ProfileFormModel | null;
}

function directoryPage(state: GuildState, at?: number): DirectoryPage {
  const shown = state.directory.some((g) => g.score !== undefined);
  return {
    kind: 'directory',
    rows: state.directory.map((g) => ({
      id: g.id,
      href: `/?view=guilds&guild=${encodeURIComponent(g.id)}`,
      heading: headingOf(g),
      members: String(g.members.length),
      score: points(g.score),
      average: points(g.average),
    })),
    points: shown,
    stand: standOf(shown, at),
    create: state.own ? null : profileForm(),
  };
}

// ----- the own rank -----

/** What the own rank may do in the own guild: its rights and its place. */
interface Inside {
  ranks: GuildRanks;
  uid: string;
  lead: boolean;
  /** Place of the own rank; 0 is the Leitung. */
  at: number;
  can: (right: GuildRight) => boolean;
}

function inside(ranks: GuildRanks, uid: string): Inside {
  const at = ranks.list.findIndex((r) => r.id === ranks.rank);
  return {
    ranks,
    uid,
    lead: ranks.lead === uid,
    // The Leitung holds the first rank; no rank stands lowest.
    at: at < 0 ? Infinity : at,
    can: (right) => ranks.rights.includes(right),
  };
}

/** The place of a rank in the list; none for an unknown rank. */
function indexOf(me: Inside, rank: string | null | undefined) {
  const at = me.ranks.list.findIndex((r) => r.id === rank);
  return at < 0 ? undefined : at;
}

/** The place of a member; a member without a rank stands lowest (core rule). */
function placeOf(me: Inside, id: string): number {
  return memberPlace(id === me.ranks.lead, indexOf(me, me.ranks.members[id]));
}

/** The own rank as the core checks see it. */
const asRule = (me: Inside): ActorRule => ({
  lead: me.lead,
  position: me.at,
  rights: me.ranks.rights,
});

/** The ranks as the core checks see them: their place is their index. */
const rankRules = (me: Inside): RankRule[] =>
  me.ranks.list.map((r, at) => ({ ...r, position: at }));

// ----- the members -----

/** „Rang ändern“: the ranks the own rank may give, the member's own preselected. */
interface RankChange {
  options: { id: string; name: string; selected: boolean }[];
}

/** What the own rank may do with another member. */
interface MemberControls {
  transfer: boolean;
  assign: RankChange | null;
  remove: boolean;
}

interface MemberRow {
  id: string;
  name: string;
  /** Null while the highscore shows nothing (182a). */
  points: string | null;
  /** The rank of a member of the own guild; none on the page of another. */
  rank: string | null;
  controls: MemberControls | null;
}

/** The members; their ranks only for the own guild (owner, #163 D7). */
interface Roster {
  ranked: boolean;
  /** Whether the members have points to show (182a). */
  points: boolean;
  rows: MemberRow[];
}

function rankChange(me: Inside, id: string): RankChange {
  // Only ranks the own rank may give (owner, 2026-11-14): below it and
  // without a right it lacks.
  const place = placeOf(me, id);
  const ranks = rankRules(me);
  return {
    options: me.ranks.list
      .filter((r) => assignRankError(asRule(me), place, ranks, r.id) === null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        selected: r.id === me.ranks.members[id],
      })),
  };
}

function memberControls(me: Inside, id: string): MemberControls {
  if (id === me.uid) return { transfer: false, assign: null, remove: false };
  const place = placeOf(me, id);
  return {
    transfer: me.lead,
    assign:
      isBelow(me.at, place) && me.can('assign') ? rankChange(me, id) : null,
    remove:
      manageMemberError(asRule(me), { place, self: false }, null) === null,
  };
}

function roster(g: Guild, me: Inside | null): Roster {
  if (!me)
    return {
      ranked: false,
      points: g.score !== undefined,
      rows: g.members.map((m) => ({
        id: m.id,
        name: m.name,
        points: points(m.points),
        rank: null,
        controls: null,
      })),
    };
  const rankName = (id: string): string =>
    me.ranks.list.find((r) => r.id === me.ranks.members[id])?.name ?? '–';
  return {
    ranked: true,
    points: g.score !== undefined,
    rows: g.members.map((m) => ({
      id: m.id,
      name: m.name,
      points: points(m.points),
      rank: m.id === me.ranks.lead ? me.ranks.list[0]!.name : rankName(m.id),
      controls: memberControls(me, m.id),
    })),
  };
}

// ----- the ranks -----

/** One right of a rank as a checkbox: a right the own rank lacks is disabled. */
interface RightBox {
  right: GuildRight;
  label: string;
  checked: boolean;
  disabled: boolean;
}

/** What the own rank may change in a rank below it. */
interface RankEditor {
  name: string;
  boxes: RightBox[];
  up: boolean;
  down: boolean;
  remove: boolean;
}

/** A rank: its editor, or, where the own rank may not change it, its rights. */
interface RankEntry {
  id: string;
  /** Its name, and „Standardrang“ for the rank new members get. */
  legend: string;
  editor: RankEditor | null;
  /** The rights as text: all, none or each one. */
  rights: 'all' | 'none' | string[];
  /** „Als Standardrang“ (only the Leitung). */
  makeDefault: boolean;
}

function rankEditor(me: Inside, rank: GuildRank): RankEditor {
  const ranks = rankRules(me);
  const movable = (up: boolean) =>
    moveRankError(asRule(me), ranks, rank.id, up) === null;
  const fallback = indexOf(me, me.ranks.default);
  const hasMembers = Object.values(me.ranks.members).includes(rank.id);
  return {
    name: rank.name,
    boxes: GUILD_RIGHTS.map((right) => ({
      right,
      label: RIGHT_TEXT[right],
      checked: rank.rights.includes(right),
      disabled: !me.can(right),
    })),
    up: movable(true),
    down: movable(false),
    // A guild always has its default rank; the page offers no deleting without.
    remove:
      fallback !== undefined &&
      deleteRankError(
        asRule(me),
        ranks,
        rank.id,
        me.ranks.default,
        hasMembers,
      ) === null,
  };
}

function rankEntry(me: Inside, rank: GuildRank, at: number): RankEntry {
  const isDefault = rank.id === me.ranks.default;
  const ranks = rankRules(me);
  const edit = managedError(asRule(me), ranks, rank.id) === null;
  return {
    id: rank.id,
    legend: `${rank.name}${isDefault ? ' · Standardrang' : ''}`,
    editor: edit ? rankEditor(me, rank) : null,
    rights:
      at === 0
        ? 'all'
        : rank.rights.length
          ? rank.rights.map((r) => RIGHT_TEXT[r])
          : 'none',
    makeDefault:
      !isDefault && defaultRankError(asRule(me), ranks, rank.id) === null,
  };
}

/** The box „Ränge“: every rank and, with the right, the form for a new one. */
interface RanksModel {
  entries: RankEntry[];
  create: boolean;
}

const ranksModel = (me: Inside): RanksModel => ({
  entries: me.ranks.list.map((r, at) => rankEntry(me, r, at)),
  create: rankRoomError(asRule(me), rankRules(me)) === null,
});

// ----- the page of a guild -----

/** What a member sees of the own guild's management, by right. */
interface ManagementModel {
  /** The open applications; none without the right. */
  applications: { id: string; name: string }[] | null;
  ranks: RanksModel;
  /** The form to change the profile; none without the right. */
  profile: ProfileFormModel | null;
}

function management(
  g: Guild,
  own: NonNullable<GuildState['management']>,
  me: Inside,
): ManagementModel {
  return {
    applications: me.can('applications')
      ? own.pending.map((m) => ({ id: m.id, name: m.name }))
      : null,
    ranks: ranksModel(me),
    // Only the Leitung, also while members remain (owner, 2026-11-14).
    profile: me.can('profile') ? profileForm(g, own.description) : null,
  };
}

/** The button of the guild page for the player: apply, withdraw, leave or dissolve. */
type Membership =
  | { kind: 'none' }
  | { kind: 'apply'; id: string }
  | { kind: 'pending' }
  | { kind: 'leave' }
  | { kind: 'dissolve'; id: string };

function membership(
  state: GuildState,
  g: Guild,
  me: Inside | null,
): Membership {
  if (!state.own) return { kind: 'apply', id: g.id };
  if (state.own.id !== g.id) return { kind: 'none' };
  if (state.own.status === 'pending') return { kind: 'pending' };
  if (!me?.lead) return { kind: 'leave' };
  return { kind: 'dissolve', id: g.id };
}

/** The page of one guild. */
export interface GuildPage {
  kind: 'guild';
  id: string;
  heading: string;
  /** The profile text as the server rendered it; empty until the guild has one. */
  profileHtml: string;
  /** Null while the highscore shows nothing (182a). */
  score: string | null;
  average: string | null;
  /** „Stand: {Uhrzeit}“ of the points, or empty (#494). */
  stand: string;
  roster: Roster;
  chat: ChatBoxModel | null;
  membership: Membership;
  /** The admin reads the chat of every guild (#169, D8). */
  adminChat: boolean;
  management: ManagementModel | null;
}

export type GuildsPage = DirectoryPage | GuildPage;

/** The page of the guild `g`: what the player may see and do in it. */
function guildPage(v: V, state: GuildState, g: Guild): GuildPage {
  const own = state.management?.id === g.id ? state.management : null;
  const me = own && state.ranks ? inside(state.ranks, v.s.me.id) : null;
  return {
    kind: 'guild',
    id: g.id,
    heading: headingOf(g),
    profileHtml: g.html,
    score: points(g.score),
    average: points(g.average),
    stand: standOf(g.score !== undefined, v.s.scoresAt),
    roster: roster(g, me),
    chat: own && state.chat ? chatBox(state.chat) : null,
    membership: membership(state, g, me),
    adminChat: !!v.s.admin,
    management: own && me ? management(g, own, me) : null,
  };
}

/** The directory, or the page of the guild the player opened. */
export function guildsPage(v: V): GuildsPage {
  const state = v.s.guilds ?? { directory: [], own: null, management: null };
  const g = state.directory.find((guild) => guild.id === v.ui.params.guild);
  return g ? guildPage(v, state, g) : directoryPage(state, v.s.scoresAt);
}
