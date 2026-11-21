// What the page „Achievements“ shows (#118, bundle 5;
// okf/architecture/patterns.md, section 9), without the HTML of its parts:
// the daily reward, the filter and the entries in the groups „Einlösbar“,
// „Offen“ and „Erledigt“. The component Achievements renders it; the buttons
// and the filter carry data-act and ids that features/achievements.ts reads.
// On a phone (#189) the CSS hides what the attributes `data-later`,
// `data-fold` and `data-all` mark (logic/achievement-fold.ts).
import {
  ACHIEVEMENTS,
  type AchievementState,
  CATEGORIES,
} from '../../core/achievements.ts';
import { rewardMinutes } from '../../core/daily-reward.ts';
import {
  achievementStatus,
  type AchievementStatus,
} from '../../core/reward-checks.ts';
import type { Cost } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import {
  foldLabel,
  type FoldGroup,
  laterGoals,
  unfolded,
} from './achievement-fold.ts';
import { fmt } from './format.ts';

const STATUS_LABELS = {
  ready: 'Einlösbar',
  open: 'Offen',
  claimed: 'Erledigt',
} as const satisfies Record<AchievementStatus, string>;
type Status = AchievementStatus;

const rewardText = ([m, c, d]: Cost): string =>
  `Adamant ${fmt(m)} · Psikristall ${fmt(c)} · Promethium ${fmt(d)}`;

/** The box „Tägliche Belohnung“: today's reward, claimed or to claim, and tomorrow's. */
interface DailyBox {
  streak: string;
  day: string;
  today: string;
  claimed: boolean;
  tomorrow: string;
}

/** One entry of a group. */
interface AchievementRow {
  id: string;
  title: string;
  category: string;
  status: Status;
  /** Not the next goal of its series: a phone hides it until the group is unfolded (#189). */
  later: boolean;
  /** What the filter searches: the title and the category, in lower case. */
  search: string;
  /** The category as shown. */
  label: string;
  progress: string;
  target: string;
  reward: string;
}

/** A group of the list; a phone can unfold „Offen“ and „Erledigt“ (#189). */
interface AchievementGroup {
  status: Status;
  title: string;
  rows: AchievementRow[];
  /** The group a phone folds, with its button; none for „Einlösbar“ or an empty group. */
  fold: { group: FoldGroup; all: boolean; label: string } | null;
}

/** The filter above the groups: the choices of the lists „Kategorie“ and „Status“. */
interface AchievementFilter {
  categories: { key: string; label: string }[];
  statuses: { key: string; label: string }[];
}

export interface AchievementsPage {
  /** „Achievements“, or „Belohnungen“ in a round with the daily reward only. */
  title: string;
  /** The box of the daily reward; none while the state has none. */
  daily: DailyBox | null;
  /** The filter and the groups; none without the state or in a round without achievements. */
  list: { filter: AchievementFilter; groups: AchievementGroup[] } | null;
}

function dailyBox(state: AchievementState['daily']): DailyBox | null {
  if (!state) return null;
  const { streak, day, reward, next, claimed } = state;
  return {
    streak: `Anmeldeserie: ${fmt(streak)} Tage (Tageswechsel um 00:00 UTC)`,
    day: `Tag ${fmt(day)} der Runde: ${fmt(rewardMinutes(day))} Minuten der mittleren Stundenproduktion aller Spieler`,
    today: `Heute: ${rewardText(reward)}`,
    claimed,
    tomorrow: `Morgen (${fmt(rewardMinutes(day + 1))} Minuten, bei gleicher Produktion): ${rewardText(next)}`,
  };
}

/** The groups a phone can unfold: „Offen“ and „Erledigt“. */
const isFoldable = (status: Status): status is FoldGroup & Status =>
  status === 'open' || status === 'claimed';

function group(status: Status, rows: AchievementRow[]): AchievementGroup {
  return {
    status,
    title: STATUS_LABELS[status],
    rows,
    fold:
      isFoldable(status) && rows.length
        ? {
            group: status,
            all: unfolded[status],
            label: foldLabel(status, rows.length),
          }
        : null,
  };
}

/** The page of the state: the daily reward and, with achievements in the round, the list. */
export function achievementsPage(view: V): AchievementsPage {
  const state = view.s.achievements;
  if (!state) return { title: 'Achievements', daily: null, list: null };
  const daily = dailyBox(state.daily);
  if (!view.s.round.achievements)
    return { title: 'Belohnungen', daily, list: null };
  const claimed = new Set(state.claimed);
  const rows: Record<Status, AchievementRow[]> = {
    ready: [],
    open: [],
    claimed: [],
  };
  // Phone: only the next goal of each series is shown, until unfolded (#189).
  const later = laterGoals(
    ACHIEVEMENTS,
    (item) => item.metric,
    (item) => claimed.has(item.id),
  );
  for (const item of ACHIEVEMENTS) {
    const status = achievementStatus(item, state.progress, claimed);
    const label = CATEGORIES[item.category];
    rows[status].push({
      id: item.id,
      title: item.title,
      category: item.category,
      status,
      later: later.has(item),
      search: `${item.title} ${label}`.toLocaleLowerCase('de'),
      label,
      progress: fmt(Math.min(state.progress[item.metric] ?? 0, item.target)),
      target: fmt(item.target),
      reward: rewardText(item.reward),
    });
  }
  const choices = (labels: Record<string, string>) =>
    Object.entries(labels).map(([key, label]) => ({ key, label }));
  return {
    title: 'Achievements',
    daily,
    list: {
      filter: {
        categories: choices(CATEGORIES),
        statuses: choices(STATUS_LABELS),
      },
      groups: (Object.keys(STATUS_LABELS) as Status[]).map((status) =>
        group(status, rows[status]),
      ),
    },
  };
}
