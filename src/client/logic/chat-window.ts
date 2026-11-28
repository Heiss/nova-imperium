// The chat window at the bottom right (#496, owner, 2026-11-28): the tabs
// „Gilde“ (the guild chat, as on the page of the guild) and „Persönlich“ (the
// conversations, and the open one with „Antworten“, as on the lock screen of
// the vacation mode, Q1 [V]), each with its unread count. What the window
// shows is decided here; ChatWindow.svelte renders it, and leaves it out on a
// phone (3).
import { chatWindowOpen } from '../../core/chat-window.ts';
import type { V } from '../views/common.ts';
import { chatBox, type ChatBoxModel } from './guilds.ts';
import { counted, guildUnread } from './message-tabs.ts';
import { privatePage, type PrivatePage } from './private-messages.ts';

export type ChatWindowTab = 'guild' | 'private';

/** The words of the window [V]. */
export const CHAT_WINDOW_LABELS = {
  title: 'Chat',
  close: 'Chat schließen',
  guild: 'Gilde',
  private: 'Persönlich',
} as const;

export interface ChatWindowTabModel {
  key: ChatWindowTab;
  label: string;
}

export interface ChatWindowPage {
  /** „Gilde“ only with a chat in the state (no guild, guilds off: none, Q3 [V]), then „Persönlich“. */
  tabs: ChatWindowTabModel[];
  /** The button of the closed window: „Chat“ with every unread entry. */
  button: string;
  guild: ChatBoxModel | null;
  mail: PrivatePage;
}

/**
 * The window of the state, or null: while its switch is off (Q2 [V]: the
 * window follows its own switch only), and while „Nachrichten“ is the view,
 * which shows the same conversations; one open conversation at a time is
 * what the poll follows (Q32 of #226) [V].
 */
export function chatWindowPage(
  v: Pick<V, 's'>,
  view: string,
): ChatWindowPage | null {
  if (!chatWindowOpen(v.s.round) || view === 'messages') return null;
  const chat = v.s.guilds?.chat ?? null;
  const mail = privatePage(v);
  const guildCount = guildUnread(v.s);
  const tabs: ChatWindowTabModel[] = [
    ...(chat
      ? [
          {
            key: 'guild' as const,
            label: counted(CHAT_WINDOW_LABELS.guild, guildCount),
          },
        ]
      : []),
    { key: 'private', label: counted(CHAT_WINDOW_LABELS.private, mail.unread) },
  ];
  return {
    tabs,
    button: counted(CHAT_WINDOW_LABELS.title, guildCount + mail.unread),
    guild: chat && chatBox(chat),
    mail,
  };
}

/** The tab shown: the one chosen while the window has it, else the first. */
export const shownTab = (
  page: ChatWindowPage,
  chosen: ChatWindowTab,
): ChatWindowTab =>
  page.tabs.some((t) => t.key === chosen) ? chosen : page.tabs[0]!.key;

// ----- what the browser keeps per player (#496 [V]) -----

/** Open or closed and the chosen tab, per player in this browser. */
export interface ChatWindowPrefs {
  open: boolean;
  tab: ChatWindowTab;
}

/** Closed on „Gilde“ until the player opens it [V]. */
export const NO_PREFS: ChatWindowPrefs = { open: false, tab: 'guild' };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const keyOf = (uid: string): string => `nova.chatwin.${uid}`;

/** The prefs of the player; none stored, unreadable or no storage: closed. */
export function readPrefs(uid: string, store: () => Store): ChatWindowPrefs {
  try {
    const raw: unknown = JSON.parse(store().getItem(keyOf(uid)) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return NO_PREFS;
    const { open, tab } = raw as Record<string, unknown>;
    return {
      open: open === true,
      tab: tab === 'private' ? 'private' : 'guild',
    };
  } catch {
    return NO_PREFS;
  }
}

/** Keeps the prefs; without storage they last until the page is reloaded. */
export function writePrefs(
  uid: string,
  prefs: ChatWindowPrefs,
  store: () => Store,
): void {
  try {
    store().setItem(keyOf(uid), JSON.stringify(prefs));
  } catch {
    // No storage (a private window, blocked site data): nothing kept.
  }
}
