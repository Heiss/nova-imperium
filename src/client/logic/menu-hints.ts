import { ACHIEVEMENTS } from '../../shared/achievements.ts';
import { isShip } from '../../shared/catalog.ts';
import type { Planet } from '../../shared/types.ts';
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

function rewardHint(state: GameState): string | undefined {
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
  if (state.guilds?.management?.pending.length)
    hints.set('guilds', 'Offene Gildenbewerbungen');
  return hints;
}
