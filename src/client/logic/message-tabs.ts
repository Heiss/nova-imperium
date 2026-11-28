// Which tabs „Nachrichten“ shows, with their labels (#226, #496): „Berichte“
// (not on the lock screen of the vacation mode), „Posteingang“ with its unread
// messages, „Gesendet“, and „Gilde“ with the new entries of the guild chat,
// only while the state has a chat: a member with a chat right, in a round
// with guilds (owner, 2026-11-28, 4).
import {
  MESSAGE_TABS,
  privateUnread,
  type MessageTab,
} from './private-messages.ts';
import type { GameState } from './types.ts';

export interface MessageTabModel {
  key: MessageTab;
  label: string;
}

/** `label (n)` while `n` is not 0, as „Posteingang (2)“. */
export const counted = (label: string, n: number): string =>
  n ? `${label} (${n})` : label;

/** The count of the tab „Gilde“: the new entries of the guild chat, 0 without a chat. */
export const guildUnread = (s: Pick<GameState, 'guilds'>): number =>
  s.guilds?.chat?.unreadCount ?? 0;

export function messageTabs(
  s: Pick<GameState, 'guilds' | 'privateMessages'>,
  lock: boolean,
): MessageTabModel[] {
  const counts: Partial<Record<MessageTab, number>> = {
    inbox: privateUnread(s),
    guild: guildUnread(s),
  };
  return (Object.keys(MESSAGE_TABS) as MessageTab[])
    .filter((key) => !(lock && key === 'reports'))
    .filter((key) => key !== 'guild' || !!s.guilds?.chat)
    .map((key) => ({
      key,
      label: counted(MESSAGE_TABS[key], counts[key] ?? 0),
    }));
}
