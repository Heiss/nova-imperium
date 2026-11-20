import { ACHIEVEMENTS } from '../../core/achievements.ts';
import { isShip } from '../../core/catalog.ts';
import type { Planet } from '../../core/types.ts';
import { friendsHint } from './friends.ts';
import type { GameState } from './types.ts';

export function finishedYardOrders(planet: Planet, now: number): Set<string> {
  const views = new Set<string>();
  if (planet.sqT === null) return views;
  let end = planet.sqT;
  for (const order of planet.sq) {
    end += order.unit * order.n;
    if (end > now) break;
    views.add(isShip(order.key) ? 'shipyard' : 'defense');
  }
  return views;
}

/** The mark on „Erfolge“ and the line „Bereit“ of the phone overview (#189): what can be claimed. */
export function rewardHint(state: GameState): string | undefined {
  const rewards = state.achievements;
  if (!rewards || !state.planet) return;
  const claimed = new Set(rewards.claimed);
  const achievement =
    state.round.achievements &&
    ACHIEVEMENTS.some(
      (item) =>
        !claimed.has(item.id) &&
        (rewards.progress[item.metric] ?? 0) >= item.target,
    );
  const daily = rewards.daily && !rewards.daily.claimed;
  if (achievement && daily) return 'Erfolg und Tagesbelohnung abholbar';
  if (achievement) return 'Erfolg abholbar';
  if (daily) return 'Tagesbelohnung abholbar';
}

export function menuHints(
  state: GameState,
  completed: ReadonlyMap<string, string>,
  unread: number,
): Map<string, string> {
  const hints = new Map(completed);
  if (unread) hints.set('messages', `${unread} ungelesene Nachrichten`);
  const reward = rewardHint(state);
  if (reward) hints.set('achievements', reward);
  if (
    state.fleets.some(
      (fleet) => fleet.owner !== state.me.id && fleet.state === 'out',
    )
  ) {
    const done = hints.get('fleet');
    hints.set(
      'fleet',
      done ? `${done} · Anfliegende Flotte` : 'Anfliegende Flotte',
    );
  }
  const guilds = guildHint(state);
  if (guilds) hints.set('guilds', guilds);
  const friends = friendsHint(state);
  if (friends) hints.set('friends', friends);
  return hints;
}

/**
 * Open applications and, since the last visit to the own guild, news in its
 * chat (#169; owner, 2026-11-15).
 */
function guildHint(state: GameState): string {
  return [
    state.guilds?.management?.pending.length && 'Offene Gildenbewerbungen',
    state.guilds?.chat?.unread && 'Neue Nachrichten im Gilden-Chat',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The newest message of the chat when the member has the page of its own
 * guild open and something is new: the visit that clears the mark on
 * „Gilden“ (#169; owner, 2026-11-15). Null otherwise.
 */
export function chatToSee(
  state: GameState,
  view: string,
  guild: string | null,
): number | null {
  const g = state.guilds;
  if (view !== 'guilds' || g?.own?.status !== 'member') return null;
  if (g.own.id !== guild || !g.chat?.unread) return null;
  return g.chat.messages.at(-1)?.id ?? null;
}
