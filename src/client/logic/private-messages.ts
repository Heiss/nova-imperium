// The private messages in the browser (#226, okf/features/private-messages.md):
// the tabs „Posteingang“ and „Gesendet“ of „Nachrichten“, the number of
// unread messages for the mark of the menu, and the one event through which
// the components ask features/private-messages.ts to send an action. The
// server checks everything (src/server/game/private-messages.ts); the browser
// only shows what the player may do. Everything that comes from players is
// text in the components, never markup.
import type { ActionInput } from '../../core/actions.ts';
import { DELETED_PLAYER } from '../../core/round-report.ts';
import type { PmLine, PmOpen, SentLine } from '../../core/private-messages.ts';
import type { V } from '../views/common.ts';
import { dt } from './format.ts';
import type { GameState } from './types.ts';

/** The tabs of „Nachrichten“: the reports (the earlier content), the inbox, the sent messages [V]. */
export const MESSAGE_TABS = {
  reports: 'Berichte',
  inbox: 'Posteingang',
  sent: 'Gesendet',
} as const;
export type MessageTab = keyof typeof MESSAGE_TABS;

/** The texts of the interface [V]; „Neue Nachricht“, „Empfänger“ and „Antworten“ are those of the issue. */
export const PM_LABELS = {
  compose: 'Neue Nachricht',
  recipient: 'Empfänger',
  player: 'Spieler',
  text: 'Nachricht',
  send: 'Senden',
  reply: 'Antworten',
  report: 'Melden',
  remove: 'Löschen',
  removeConversation: 'Unterhaltung löschen',
  block: 'Blockieren',
  unblock: 'Freigeben',
  friendsOnly: 'Nur Freunde dürfen mir schreiben',
  blocked: 'Blockierte Spieler',
  noBlocked: 'Du hast niemanden blockiert.',
  empty: 'Keine Nachrichten.',
  noSent: 'Du hast noch nichts gesendet.',
  deleted: DELETED_PLAYER,
  older: 'Ältere Nachrichten laden',
} as const;

/** The questions before an action that cannot be taken back [V]. */
const PM_QUESTIONS = {
  deletePrivateMessage: 'Nachricht löschen?',
  deletePrivateConversation: 'Unterhaltung löschen?',
  reportPrivateMessage: 'Nachricht der Spielleitung melden?',
} as const;

/** One conversation of the inbox: the preview the state carries (Q32) and, while it is open, the messages that are new to it. */
export interface InboxRow {
  /** The name the actions address: empty for the deleted accounts. */
  key: string;
  /** The name shown. */
  name: string;
  /** Whether the other player is a deleted account: no reply is possible. */
  deleted: boolean;
  unread: number;
  /** Whether older messages exist than the preview. */
  more: boolean;
  /** The time of the newest message. */
  last: string;
  /** The newest message: the preview. */
  preview: MessageLine;
  /** The messages of this conversation newer than the browser holds, while it is the open one (Q32). */
  newer: MessageLine[];
}

export interface MessageLine {
  id: number;
  mine: boolean;
  time: string;
  text: string;
  /** A received message is new until it is read. */
  fresh: boolean;
}

/** A message the player sent, for the tab „Gesendet“. */
export interface SentRow {
  id: number;
  /** The name of the recipient. */
  to: string;
  time: string;
  text: string;
}

export interface PrivatePage {
  inbox: InboxRow[];
  /** The names a message may go to: every other player. */
  names: string[];
  friendsOnly: boolean;
  blocked: string[];
  /** Received messages not read yet, over all conversations. */
  unread: number;
}

const lineOf = (m: PmLine): MessageLine => ({
  id: m.id,
  mine: m.mine,
  time: dt(m.time),
  text: m.text,
  fresh: !m.mine && !m.read,
});

/**
 * An open conversation as the browser holds it (Q32): the newest page the
 * action loaded when the player opened it, the older pages the player asked
 * for, and the newer messages the state brought. `more` says whether older
 * messages exist than the oldest held.
 */
export interface Thread {
  lines: MessageLine[];
  more: boolean;
}

/** The thread an opened conversation starts with: the page the action answered. */
export const startThread = (
  page: readonly PmLine[],
  more: boolean,
): Thread => ({
  lines: page.map(lineOf),
  more,
});

/** The id of the newest message of the thread: what the poll names as `pmAfter`; 0 for none. */
export const newestId = (t: Thread): number => t.lines.at(-1)?.id ?? 0;

/**
 * The thread with the messages of `page` (older ones, oldest first) put in
 * front. A message the thread holds is not added twice, so no duplicate opens;
 * `more` is the answer's.
 */
export function withOlder(
  t: Thread,
  page: readonly PmLine[],
  more: boolean,
): Thread {
  const held = new Set(t.lines.map((l) => l.id));
  const older = page.filter((m) => !held.has(m.id)).map(lineOf);
  return { lines: [...older, ...t.lines], more };
}

/**
 * The thread with the new messages of the state added at the end: only the
 * ones newer than the newest held (a message that came with an earlier poll is
 * not added again), in order of their ids.
 */
export function withNewer(t: Thread, add: readonly MessageLine[]): Thread {
  const after = newestId(t);
  const fresh = add.filter((l) => l.id > after).sort((a, b) => a.id - b.id);
  return fresh.length ? { ...t, lines: [...t.lines, ...fresh] } : t;
}

/** The thread without the message `id` (the player deleted it from its own view). */
export const withoutLine = (t: Thread, id: number): Thread => ({
  ...t,
  lines: t.lines.filter((l) => l.id !== id),
});

/** The thread once the player read it: no message is new any more. */
export const withRead = (t: Thread): Thread =>
  t.lines.some((l) => l.fresh)
    ? { ...t, lines: t.lines.map((l) => ({ ...l, fresh: false })) }
    : t;

/** The sent messages the tab „Gesendet“ shows, newest first, and whether older ones exist (Q33). */
export interface SentList {
  rows: SentRow[];
  more: boolean;
}

const sentRow = (m: SentLine): SentRow => ({
  id: m.id,
  to: m.to ?? PM_LABELS.deleted,
  time: dt(m.time),
  text: m.text,
});

/** The list the tab starts with: the page the action answered. */
export const startSent = (
  page: readonly SentLine[],
  more: boolean,
): SentList => ({
  rows: page.map(sentRow),
  more,
});

/** The list with an older page (newest first) added at the end; a message held is not added twice. */
export function sentWithOlder(
  list: SentList,
  page: readonly SentLine[],
  more: boolean,
): SentList {
  const held = new Set(list.rows.map((r) => r.id));
  return {
    rows: [...list.rows, ...page.filter((m) => !held.has(m.id)).map(sentRow)],
    more,
  };
}

/** The list without the message `id`. */
export const sentWithout = (list: SentList, id: number): SentList => ({
  ...list,
  rows: list.rows.filter((r) => r.id !== id),
});

/**
 * The conversation the browser has open and the newest message it holds of
 * it, set by the open thread and read when the state is asked for (Q32). It is
 * only a note for the poll: no request is made by it.
 */
let watched: PmOpen | null = null;

/** Notes the open conversation (null: none is open). */
export const watchConversation = (open: PmOpen | null): void => {
  watched = open;
};

/** What the poll and an action add to their request to name the open conversation (Q32): nothing while none is loaded. */
export const openQuery = (): { pm?: string; pmAfter?: number } =>
  watched ? { pm: watched.name, pmAfter: watched.after } : {};

/** A state without the private messages (an old answer): nothing. */
const NONE: NonNullable<GameState['privateMessages']> = {
  friendsOnly: false,
  blocked: [],
  conversations: [],
};

/** The received messages not read yet of a state: the part of the mark on „Nachrichten“. */
export const privateUnread = (
  state: Pick<GameState, 'privateMessages'>,
): number =>
  (state.privateMessages ?? NONE).conversations.reduce(
    (n, c) => n + c.unread,
    0,
  );

/** What the tab „Posteingang“ shows at the view state `v`; „Gesendet“ loads its own list. */
export function privatePage(v: Pick<V, 's'>): PrivatePage {
  const own = v.s.privateMessages ?? NONE;
  const inbox = own.conversations.map((c): InboxRow => ({
    key: c.with ?? '',
    name: c.with ?? PM_LABELS.deleted,
    deleted: c.with === null,
    unread: c.unread,
    more: c.more,
    last: dt(c.last.time),
    preview: lineOf(c.last),
    newer:
      own.open && own.open.with === c.with ? own.open.messages.map(lineOf) : [],
  }));
  const names = Object.entries(v.s.players)
    .filter(([id]) => id !== v.s.me.id)
    .map(([, p]) => p.name)
    .sort((a, b) => a.localeCompare(b, 'de'));
  return {
    inbox,
    names,
    friendsOnly: own.friendsOnly,
    blocked: own.blocked,
    unread: privateUnread(v.s),
  };
}

/** An action a component asks for: the name picks the type of the data. */
export type PmCall =
  | ['sendPrivateMessage', ActionInput<'sendPrivateMessage'>]
  | ['readPrivateMessages', ActionInput<'readPrivateMessages'>]
  | ['deletePrivateMessage', ActionInput<'deletePrivateMessage'>]
  | ['deletePrivateConversation', ActionInput<'deletePrivateConversation'>]
  | ['reportPrivateMessage', ActionInput<'reportPrivateMessage'>]
  | ['blockPlayer', ActionInput<'blockPlayer'>]
  | ['unblockPlayer', ActionInput<'unblockPlayer'>]
  | ['privateMessageOptions', ActionInput<'privateMessageOptions'>]
  | ['olderPrivateMessages', ActionInput<'olderPrivateMessages'>]
  | ['openPrivateConversation', ActionInput<'openPrivateConversation'>]
  | ['sentPrivateMessages', ActionInput<'sentPrivateMessages'>];

/** The calls that load messages and change nothing: they answer data, no new state (Q27, Q32, Q33). */
export type PmLoad = Extract<
  PmCall,
  readonly [
    'olderPrivateMessages' | 'openPrivateConversation' | 'sentPrivateMessages',
    unknown,
  ]
>;

/** Whether the call is a load. */
export const isLoad = (call: PmCall): call is PmLoad =>
  call[0] === 'olderPrivateMessages' ||
  call[0] === 'openPrivateConversation' ||
  call[0] === 'sentPrivateMessages';

/** The question to ask before the call, if any. */
export const questionFor = (call: PmCall): string | null =>
  call[0] === 'deletePrivateMessage' ||
  call[0] === 'deletePrivateConversation' ||
  call[0] === 'reportPrivateMessage'
    ? PM_QUESTIONS[call[0]]
    : null;

/** The event of a component that asks for an action; features/private-messages.ts answers it. */
export const PM_EVENT = 'pm:act';

export interface PmRequest {
  call: PmCall;
  /** The mark „gelesen“ is no action the player asked for: a refusal is no message. */
  quiet: boolean;
  /** Called once with whether the action went through and the data it answered. */
  done: (ok: boolean, data?: Record<string, unknown>) => void;
  /** Gets a refusal with the server's words instead of a note: the dialog of a message (#349). */
  refused?: (message: string) => void;
}

/** What an action answered: whether it went through and its data. */
export interface PmAnswer {
  ok: boolean;
  data: Record<string, unknown>;
}

/**
 * Asks for `call` from inside a component; resolves with the answer.
 * `refused` gets a refusal with the server's words instead of a note (#349).
 */
export const pmAsk = (
  from: Element,
  call: PmCall,
  quiet = false,
  refused?: (message: string) => void,
): Promise<PmAnswer> =>
  new Promise((resolve) =>
    from.dispatchEvent(
      new CustomEvent<PmRequest>(PM_EVENT, {
        bubbles: true,
        detail: {
          call,
          quiet,
          refused,
          done: (ok, data) => resolve({ ok, data: data ?? {} }),
        },
      }),
    ),
  );

/** Asks for `call` from inside a component; resolves with whether it went through. */
export const pmCall = (
  from: Element,
  call: PmCall,
  quiet = false,
  refused?: (message: string) => void,
): Promise<boolean> => pmAsk(from, call, quiet, refused).then((a) => a.ok);
