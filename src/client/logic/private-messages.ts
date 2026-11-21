// The private messages in the browser (#226, okf/features/private-messages.md):
// the tabs „Posteingang“ and „Gesendet“ of „Nachrichten“, the number of
// unread messages for the mark of the menu, and the one event through which
// the components ask features/private-messages.ts to send an action. The
// server checks everything (src/server/game/private-messages.ts); the browser
// only shows what the player may do. Everything that comes from players is
// text in the components, never markup.
import type { ActionInput } from '../../core/actions.ts';
import { DELETED_PLAYER } from '../../core/round-report.ts';
import type { PmLine } from '../../core/private-messages.ts';
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
} as const;

/** The questions before an action that cannot be taken back [V]. */
const PM_QUESTIONS = {
  deletePrivateMessage: 'Nachricht löschen?',
  deletePrivateConversation: 'Unterhaltung löschen?',
  reportPrivateMessage: 'Nachricht der Spielleitung melden?',
} as const;

/** One conversation of the inbox. */
export interface InboxRow {
  /** The name the actions address: empty for the deleted accounts. */
  key: string;
  /** The name shown. */
  name: string;
  /** Whether the other player is a deleted account: no reply is possible. */
  deleted: boolean;
  unread: number;
  /** The time of the newest message. */
  last: string;
  lines: MessageLine[];
}

interface MessageLine {
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
  sent: SentRow[];
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

/** What the tabs „Posteingang“ and „Gesendet“ show at the view state `v`. */
export function privatePage(v: V): PrivatePage {
  const own = v.s.privateMessages ?? NONE;
  const inbox = own.conversations.map((c): InboxRow => ({
    key: c.with ?? '',
    name: c.with ?? PM_LABELS.deleted,
    deleted: c.with === null,
    unread: c.unread,
    last: dt(c.messages.at(-1)!.time),
    lines: c.messages.map(lineOf),
  }));
  const sent = own.conversations
    .flatMap((c) =>
      c.messages
        .filter((m) => m.mine)
        .map((m): SentRow => ({
          id: m.id,
          to: c.with ?? PM_LABELS.deleted,
          time: dt(m.time),
          text: m.text,
        })),
    )
    .sort((a, b) => b.id - a.id);
  const names = Object.entries(v.s.players)
    .filter(([id]) => id !== v.s.me.id)
    .map(([, p]) => p.name)
    .sort((a, b) => a.localeCompare(b, 'de'));
  return {
    inbox,
    sent,
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
  | ['privateMessageOptions', ActionInput<'privateMessageOptions'>];

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
  /** Called once with whether the action went through. */
  done: (ok: boolean) => void;
}

/** Asks for `call` from inside a component; resolves with whether it went through. */
export const pmCall = (
  from: Element,
  call: PmCall,
  quiet = false,
): Promise<boolean> =>
  new Promise((done) =>
    from.dispatchEvent(
      new CustomEvent<PmRequest>(PM_EVENT, {
        bubbles: true,
        detail: { call, quiet, done },
      }),
    ),
  );
