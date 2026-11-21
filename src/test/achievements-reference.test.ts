// „Achievements“ renders as before #118, bundle 5 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: achievements() of src/client/views/achievements.ts
// with its helpers and box() and of views/common.ts, as the phone fold of
// #189 left them. On generated states (fixed fast-check seed 118: progress
// and claimed goals per series, the daily reward or none, a round with or
// without achievements, either group unfolded or not) both render the same
// markup, up to what a browser does not show (normalize() of markup.ts);
// hand-built cases reach the states without the state of the page and without
// the daily reward, and a test checks the marks features/achievements.ts and
// the phone layout of style.css select.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementState,
  CATEGORIES,
} from '../core/achievements.ts';
import { rewardMinutes } from '../core/daily-reward.ts';
import type { Cost } from '../core/types.ts';
import {
  foldLabel,
  type FoldGroup,
  laterGoals,
  unfolded,
} from '../client/logic/achievement-fold.ts';
import { esc, fmt } from '../client/logic/format.ts';
import type { V } from '../client/views/common.ts';
import { achievementsView } from './achievements-view.ts';
import { normalize } from './markup.ts';

// ----- frozen: src/client/views/achievements.ts before #118, bundle 5 -----

const box = (title: string, body: string): string =>
  `<div class="box"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

const statusLabels = {
  ready: 'Einlösbar',
  open: 'Offen',
  claimed: 'Erledigt',
} as const;
type Status = keyof typeof statusLabels;

const rewardText = ([m, c, d]: Cost): string =>
  `Adamant ${fmt(m)} · Psikristall ${fmt(c)} · Promethium ${fmt(d)}`;

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
  later: boolean,
): string {
  const label = CATEGORIES[item.category];
  const progress = Math.min(state.progress[item.metric] ?? 0, item.target);
  const button =
    status === 'ready'
      ? `<button data-act="achievementClaim" data-id="${esc(item.id)}">Abholen</button>`
      : '';
  return `<article data-achievement${later ? ' data-later' : ''} data-category="${item.category}" data-status="${status}" data-search="${esc(`${item.title} ${label}`.toLocaleLowerCase('de'))}">
  <p><b>${esc(item.title)}</b> · ${label} · ${fmt(progress)} / ${fmt(item.target)}<br>
  <span class="dim">Belohnung: ${rewardText(item.reward)}</span> ${button}</p>
  </article>`;
}

function daily(state: AchievementState['daily']): string {
  if (!state) return '';
  const { streak, day, reward, next, claimed } = state;
  return box(
    'Tägliche Belohnung',
    `<p>Anmeldeserie: ${fmt(streak)} Tage (Tageswechsel um 00:00 UTC)</p>
  <p>Tag ${fmt(day)} der Runde: ${fmt(rewardMinutes(day))} Minuten der mittleren Stundenproduktion aller Spieler</p>
  <p data-daily-reward>Heute: ${rewardText(reward)} ${claimed ? '<b>Abgeholt</b>' : '<button data-act="dailyClaim">Tagesbelohnung abholen</button>'}</p>
  <p>Morgen (${fmt(rewardMinutes(day + 1))} Minuten, bei gleicher Produktion): ${rewardText(next)}</p>`,
  );
}

const isFoldable = (key: string): key is FoldGroup =>
  key === 'open' || key === 'claimed';

function foldAttrs(key: string, count: number): string {
  if (!isFoldable(key) || !count) return '';
  return ` data-fold="${key}"${unfolded[key] ? ' data-all' : ''}`;
}

function foldButton(key: string, count: number): string {
  if (!isFoldable(key) || !count) return '';
  return `<button type="button" class="fold-all phone-only" data-act="achFold" data-g="${key}" aria-expanded="${unfolded[key]}">${foldLabel(key, count)}</button>`;
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

function achievements(view: V): string {
  const state = view.s.achievements;
  if (!state) return '<h2>Achievements</h2>';
  const rewards = daily(state.daily);
  if (!view.s.round.achievements) return '<h2>Belohnungen</h2>' + rewards;
  const claimed = new Set(state.claimed);
  const rows: Record<Status, string[]> = { ready: [], open: [], claimed: [] };
  const later = laterGoals(
    ACHIEVEMENTS,
    (item) => item.metric,
    (item) => claimed.has(item.id),
  );
  for (const item of ACHIEVEMENTS) {
    const status = statusOf(item, state, claimed);
    rows[status].push(achievementRow(item, state, status, later.has(item)));
  }
  const groups = Object.entries(statusLabels)
    .map(([key, title]) => {
      const list = rows[key as Status];
      return `<section data-achievement-group${foldAttrs(key, list.length)}>${box(title, foldButton(key, list.length) + (list.join('') || '<p>Keine Einträge.</p>'))}</section>`;
    })
    .join('');
  return `<h2>Achievements</h2>${rewards}${box('Filtern', filters())}${groups}`;
}

// ----- the comparison -----

afterEach(() => {
  unfolded.open = false;
  unfolded.claimed = false;
});

const METRICS = [...new Set(ACHIEVEMENTS.map((a) => a.metric))];
const IDS = ACHIEVEMENTS.map((a) => a.id);

const cost: fc.Arbitrary<Cost> = fc.tuple(
  fc.integer({ min: 0, max: 5_000_000 }),
  fc.integer({ min: 0, max: 5_000_000 }),
  fc.integer({ min: 0, max: 5_000_000 }),
);

const dailyState = fc.option(
  fc.record({
    streak: fc.integer({ min: 0, max: 400 }),
    claimed: fc.boolean(),
    day: fc.integer({ min: 1, max: 120 }),
    reward: cost,
    next: cost,
  }),
  { nil: null },
);

/** Progress per series: nothing, a little, far, or beyond every goal. */
const progress = fc.array(
  fc.constantFrom(0, 1, 7, 55, 1_000, 25_000, 1_000_000, 1e12),
  { minLength: METRICS.length, maxLength: METRICS.length },
);

/** Claimed goals: a prefix of each series, and now and then any goal at all. */
const claimedPrefix = fc.array(fc.constantFrom(0, 0, 0, 1, 2, 3, 99), {
  minLength: METRICS.length,
  maxLength: METRICS.length,
});

const state = fc
  .record({
    present: fc.boolean(),
    on: fc.boolean(),
    progress,
    prefix: claimedPrefix,
    extra: fc.array(fc.constantFrom(...IDS), { maxLength: 4 }),
    daily: dailyState,
    open: fc.boolean(),
    claimed: fc.boolean(),
  })
  .map((x) => ({
    view: viewOf(x.present, x.on, x.daily, {
      progress: Object.fromEntries(METRICS.map((m, i) => [m, x.progress[i]!])),
      claimed: [
        ...METRICS.flatMap((m, i) =>
          ACHIEVEMENTS.filter((a) => a.metric === m)
            .slice(0, x.prefix[i])
            .map((a) => a.id),
        ),
        ...x.extra,
      ],
    }),
    open: x.open,
    folded: x.claimed,
  }));

function viewOf(
  present: boolean,
  on: boolean,
  daily: AchievementState['daily'],
  data: Pick<AchievementState, 'progress' | 'claimed'> = {
    progress: {},
    claimed: [],
  },
): V {
  return {
    s: {
      round: { achievements: on, daily: !!daily },
      achievements: present ? { ...data, daily } : undefined,
    },
  } as unknown as V;
}

const REWARD: Cost = [12_000, 800, 30];
const DAILY = {
  streak: 3,
  claimed: false,
  day: 5,
  reward: REWARD,
  next: [13_000, 900, 40],
} as const satisfies NonNullable<AchievementState['daily']>;
const first = ACHIEVEMENTS[0]!;

/** The cases the sample reaches rarely: no state, the daily reward alone, a claimed one, a ready one. */
const HAND_BUILT: [string, V, { open?: boolean; claimed?: boolean }?][] = [
  ['no state of the page', viewOf(false, true, null)],
  ['the daily reward only, to claim', viewOf(true, false, DAILY)],
  [
    'the daily reward only, claimed',
    viewOf(true, false, { ...DAILY, claimed: true }),
  ],
  [
    'no daily reward in a round without achievements',
    viewOf(true, false, null),
  ],
  ['a fresh state, no daily reward', viewOf(true, true, null)],
  [
    'a ready goal and the daily reward',
    viewOf(true, true, DAILY, {
      progress: { [first.metric]: first.target },
      claimed: [],
    }),
  ],
  [
    'every goal claimed, both groups unfolded',
    viewOf(
      true,
      true,
      { ...DAILY, claimed: true },
      {
        progress: {},
        claimed: IDS,
      },
    ),
    { open: true, claimed: true },
  ],
  [
    'a claimed goal, both groups unfolded',
    viewOf(true, true, null, { progress: {}, claimed: [first.id] }),
    { open: true, claimed: true },
  ],
];

function compare(
  v: V,
  fold: { open?: boolean; claimed?: boolean } = {},
  name?: string,
): void {
  unfolded.open = !!fold.open;
  unfolded.claimed = !!fold.claimed;
  expect(normalize(achievementsView(v)), name).toBe(normalize(achievements(v)));
}

const RUNS = 300;
const SLICE = 50;
type Sample = { view: V; open: boolean; folded: boolean };

/**
 * The sample (seed 118, 300 runs), generated once. 300 pages of up to some
 * hundred achievements take about 2 s alone, so the comparison takes the one
 * array in slices, one test each.
 */
let sample: Sample[] | undefined;
function SAMPLE(): Sample[] {
  if (!sample) {
    const states: Sample[] = [];
    fc.assert(
      fc.property(state, (x) => {
        states.push(x);
      }),
      { seed: 118, numRuns: RUNS },
    );
    sample = states;
  }
  return sample;
}
const SLICES = Array.from({ length: RUNS / SLICE }, (_, i) => i);

describe('Achievements against the view before #118, bundle 5', () => {
  it('compares the whole sample, in slices of it', () => {
    expect(SAMPLE()).toHaveLength(SLICES.length * SLICE);
    expect(
      SLICES.flatMap((i) => SAMPLE().slice(i * SLICE, (i + 1) * SLICE)),
    ).toEqual(SAMPLE());
  });

  it.each(SLICES)('renders the page as before, slice %i', (i) => {
    SAMPLE()
      .slice(i * SLICE, (i + 1) * SLICE)
      .forEach(({ view, open, folded }, j) => {
        compare(view, { open, claimed: folded }, `run ${i * SLICE + j}`);
      });
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v, fold] of HAND_BUILT) compare(v, fold, name);
  });

  it('keeps the marks features/achievements.ts and the phone layout select', () => {
    const html = normalize(
      achievementsView(
        viewOf(true, true, DAILY, {
          progress: { [first.metric]: first.target },
          claimed: [],
        }),
      ),
    );
    expect(html).toContain('<section data-achievement-group data-fold="open">');
    expect(html).toContain('<article data-achievement data-category=');
    expect(html).toMatch(
      /<article data-achievement data-category="[a-z]+" data-later data-search=/,
    );
    expect(html).toContain('<p data-daily-reward>Heute:');
    expect(html).toContain(
      `data-act="achievementClaim" data-id="${first.id}">Abholen</button>`,
    );
    expect(html).toContain('id="achievement_search"');
  });
});
