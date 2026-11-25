// The dialog for writing a private message (#349, variant C of the design
// study; okf/features/private-messages.md): „Neue Nachricht“ and „Antworten“
// open it. What it decides without the page: the quick choice of the
// recipient, the drafts that stay when the dialog closes without sending,
// the count below the text, and which key sends. The server is unchanged:
// sending is the action `sendPrivateMessage` of #226.
import { MAX_PM_TEXT } from '../../core/private-messages.ts';
import type { MessageLine } from './private-messages.ts';
import type { GameState } from './types.ts';

/** The texts of the dialog: the three of the owner (2026-11-22), „Freunde:“ [V] and „Abbrechen“ of the game's dialogs. */
export const PM_DIALOG_LABELS = {
  recent: 'Zuletzt geschrieben:',
  friends: 'Freunde:',
  cancel: 'Abbrechen',
  /** Before the bold name of the recipient of a reply: „An {Name}“. */
  to: 'An',
} as const;

/** The heading of the quoted last message received in the dialog „Antworten“. */
export const quoteHeading = (name: string): string =>
  `Letzte Nachricht von ${name}`;

/** How many conversations the quick choice offers at most (owner, 2026-11-22). */
export const RECENT_MAX = 5;

/** The quick choice under „Empfänger“: the recent conversations, then the other friends. */
export interface QuickChoice {
  recent: string[];
  friends: string[];
}

/**
 * The quick choice of a state (owner, 2026-11-22): the players the inbox
 * has a conversation with, at most five, newest first (the order of the
 * state), and every friend not among them [V]. A deleted account and a
 * blocked player are not offered [V].
 */
export function quickChoice(
  s: Pick<GameState, 'privateMessages' | 'friends' | 'players'>,
): QuickChoice {
  const blocked = new Set(s.privateMessages?.blocked);
  const offered = (name: string | null | undefined): name is string =>
    !!name && !blocked.has(name);
  const recent = (s.privateMessages?.conversations.map((c) => c.with) ?? [])
    .filter(offered)
    .slice(0, RECENT_MAX);
  const friends = (s.friends?.list.map((f) => s.players[f.id]?.name) ?? [])
    .filter(offered)
    .filter((name) => !recent.includes(name));
  return { recent, friends };
}

/** What was typed in the dialog and not sent: the recipient (a new message only) and the text. */
export interface PmDraft {
  to: string;
  text: string;
}

/**
 * The drafts (owner, 2026-11-22): one for „Neue Nachricht“ (key null) and
 * one per conversation for a reply (key: its name). Only in the memory of
 * the page, so a reload drops them all [V]; no storage.
 */
const drafts = new Map<string | null, PmDraft>();

/** The draft of the dialog: `reply` names the conversation, none for a new message. */
export const draftOf = (reply?: string): PmDraft =>
  drafts.get(reply ?? null) ?? { to: '', text: '' };

/** Keeps what the player typed, for the next opening. */
export const keepDraft = (reply: string | undefined, draft: PmDraft): void => {
  drafts.set(reply ?? null, { ...draft });
};

/**
 * Drops the draft once its message went through, but only while it is still
 * what was sent: a dialog closed and opened again during the send, with a
 * new text typed, keeps that new draft (CodeRabbit on #395).
 */
export const dropDraft = (reply: string | undefined, sent: PmDraft): void => {
  const key = reply ?? null;
  const now = drafts.get(key);
  if (now?.to === sent.to && now.text === sent.text) drafts.delete(key);
};

/** Drops every draft: the player logged out. */
export const forgetDrafts = (): void => drafts.clear();

/** The count below the text: „n / 1000“ [V], no words. */
export const countText = (text: string): string =>
  `${text.length} / ${MAX_PM_TEXT}`;

/**
 * Whether a key in the text sends (owner, 2026-11-22): Enter makes a new
 * line, Ctrl+Enter (Cmd+Enter on a Mac) sends; never while an input method
 * composes a word.
 */
export const sendsOnKey = (
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'isComposing'>,
): boolean => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing;

/** The field that gets the focus when the dialog opens: the first empty one, the text for a reply. */
export const firstField = (reply: boolean, draft: PmDraft): 'to' | 'text' =>
  reply || draft.to ? 'text' : 'to';

/** The last message received in a thread: quoted in the dialog „Antworten“. */
export const lastReceived = (
  lines: readonly MessageLine[],
): MessageLine | undefined => lines.findLast((l) => !l.mine);
