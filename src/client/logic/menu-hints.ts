import { ACHIEVEMENTS } from '../../core/achievements.ts';
import { isShip } from '../../core/catalog.ts';
import type { Planet } from '../../core/types.ts';
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

/** A mark of a menu entry with its view (views/index.ts, MENU_HINTS, #426). */
export interface ViewHint {
  view: string;
  hint: {
    mark: (source: { state: GameState; unread: number }) => string | undefined;
    join?: boolean;
  };
}

/**
 * The marks of the menu (#426): the completed upgrades, orders and flights,
 * and the mark of every view that has one. A mark replaces a completed text
 * of its view, or, with `join`, follows it after „ · “ („Flotte“).
 */
export function menuHints(
  hints: readonly ViewHint[],
  state: GameState,
  completed: ReadonlyMap<string, string>,
  unread: number,
): Map<string, string> {
  const marks = new Map(completed);
  for (const { view, hint } of hints) {
    const mark = hint.mark({ state, unread });
    if (!mark) continue;
    const done = hint.join ? marks.get(view) : undefined;
    marks.set(view, done ? `${done} · ${mark}` : mark);
  }
  return marks;
}

/** The mark of „Nachrichten“: the unread reports and private messages (#226). */
export const messagesHint = (unread: number): string | undefined =>
  unread ? `${unread} ungelesene Nachrichten` : undefined;

/** The mark of „Flotte“: a fleet of another player on its way here. */
export const incomingHint = (state: GameState): string | undefined =>
  state.fleets.some(
    (fleet) => fleet.owner !== state.me.id && fleet.state === 'out',
  )
    ? 'Anfliegende Flotte'
    : undefined;

/**
 * Open applications and, since the last visit to the own guild, news in its
 * chat (#169; owner, 2026-11-15).
 */
export function guildHint(state: GameState): string {
  return [
    state.guilds?.management?.pending.length && 'Offene Gildenbewerbungen',
    state.guilds?.chat?.unread && 'Neue Nachrichten im Gilden-Chat',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The newest message of the chat when the member has the page of its own
 * guild open, or the chat in sight elsewhere (`shown`: the tab „Gilde“ or the
 * chat window, #496), and something is new: the visit that clears the mark on
 * „Gilden“ (#169; owner, 2026-11-15). Null otherwise.
 */
export function chatToSee(
  state: GameState,
  view: string,
  guild: string | null,
  shown = false,
): number | null {
  const g = state.guilds;
  if (g?.own?.status !== 'member' || !g.chat?.unread) return null;
  if (!shown && (view !== 'guilds' || g.own.id !== guild)) return null;
  return g.chat.messages.at(-1)?.id ?? null;
}
