import {
  ACHIEVEMENTS,
  CATEGORIES,
  type Achievement,
  type AchievementState,
} from '../../shared/achievements.ts';
import type { Cost } from '../../shared/types.ts';
import { esc, fmt } from '../logic/format.ts';
import { box, type V } from './common.ts';

const statusLabels = {
  ready: 'Einlösbar',
  open: 'Offen',
  claimed: 'Erledigt',
} as const;
type Status = keyof typeof statusLabels;

const rewardText = ([m, c, d]: Cost): string =>
  `Metall ${fmt(m)} · Kristall ${fmt(c)} · Deuterium ${fmt(d)}`;

function statusOf(
  item: Achievement,
  state: AchievementState,
  claimed: Set<string>,
): Status {
  if (claimed.has(item.id)) return 'claimed';
  return (state.progress[item.metric] ?? 0) >= item.target ? 'ready' : 'open';
}

function achievementRow(
  item: Achievement,
  state: AchievementState,
  status: Status,
): string {
  const label = CATEGORIES[item.category];
  const progress = Math.min(state.progress[item.metric] ?? 0, item.target);
  const button =
    status === 'ready'
      ? `<button data-act="achievementClaim" data-id="${esc(item.id)}">Abholen</button>`
      : '';
  return `<article data-achievement data-category="${item.category}" data-status="${status}" data-search="${esc(`${item.title} ${label}`.toLocaleLowerCase('de'))}">
  <p><b>${esc(item.title)}</b> · ${label} · ${fmt(progress)} / ${fmt(item.target)}<br>
  <span class="dim">Belohnung: ${rewardText(item.reward)}</span> ${button}</p>
  </article>`;
}

function daily(state: AchievementState['daily']): string {
  if (!state) return '';
  const { streak, reward, next, claimed } = state;
  return box(
    'Tägliche Belohnung',
    `<p>Anmeldeserie: ${fmt(streak)} Tage (Tageswechsel um 00:00 UTC)</p>
  <p>Heute: ${rewardText(reward)} ${claimed ? '<b>Abgeholt</b>' : '<button data-act="dailyClaim">Tagesbelohnung abholen</button>'}</p>
  <p>Morgen bei fortgesetzter Serie: ${rewardText(next)}</p>`,
  );
}

function filters(): string {
  const categories = Object.entries(CATEGORIES)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join('');
  const statuses = Object.entries(statusLabels)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join('');
  return `<div class="flex">
  <label for="achievement_search">Suchen</label> <input id="achievement_search" type="search">
  <label for="achievement_category">Kategorie</label> <select id="achievement_category"><option value="">Alle</option>${categories}</select>
  <label for="achievement_status">Status</label> <select id="achievement_status"><option value="">Alle</option>${statuses}</select>
  </div>`;
}

export function achievements(view: V): string {
  const state = view.s.achievements;
  if (!state) return '<h2>Achievements</h2>';
  const rewards = daily(state.daily);
  if (!view.s.round.achievements) return '<h2>Belohnungen</h2>' + rewards;
  const claimed = new Set(state.claimed);
  const rows: Record<Status, string[]> = { ready: [], open: [], claimed: [] };
  for (const item of ACHIEVEMENTS) {
    const status = statusOf(item, state, claimed);
    rows[status].push(achievementRow(item, state, status));
  }
  const groups = Object.entries(statusLabels)
    .map(([key, title]) => {
      const content = rows[key as Status].join('');
      return `<section data-achievement-group>${box(title, content || '<p>Keine Einträge.</p>')}</section>`;
    })
    .join('');
  return `<h2>Achievements</h2>${rewards}${box('Filtern', filters())}${groups}`;
}
