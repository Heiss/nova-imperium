// The rule page „Tagesbelohnung und Erfolge“ (#288): how the daily reward is
// worked out and which series of achievements pay what. The numbers come from
// `src/core/daily-reward.ts` and `achievements.ts`; the words are a draft of
// Claude for the owner to check ([V], #288).
import {
  ACHIEVEMENTS,
  CATEGORIES,
  LEVEL_REWARD,
  REWARD_CAP,
  UNIT_REWARD,
} from '../../achievements.ts';
import {
  dailyReward,
  LAST_RISING_DAY,
  rewardMinutes,
} from '../../daily-reward.ts';
import {
  facts,
  formulas,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const DAYS = [1, 2, 3, 5, 10, 20, LAST_RISING_DAY, 60];

/** A typical hourly production per resource, the example of the reward. */
const OUTPUT: [number, number, number] = [6000, 3000, 1500];

/** The achievements of one metric, by their target. */
const series = (metric: string) =>
  ACHIEVEMENTS.filter((a) => a.metric === metric);

/** The distinct targets of every series of a category, as one list. */
const targets = (category: keyof typeof CATEGORIES): string => {
  const all = new Set(
    ACHIEVEMENTS.filter((a) => a.category === category).map((a) => a.target),
  );
  return [...all]
    .sort((a, b) => a - b)
    .map(number)
    .join(', ');
};

const yesNo = (on: boolean): string => (on ? 'ja' : 'nein');

const dailySection = (): PageSection =>
  section(
    'daily',
    'Tagesbelohnung',
    say(
      'Einmal je Tag kannst du dir eine Belohnung abholen. Sie besteht aus den Rohstoffen, die ein mittlerer Spieler in einer bestimmten Zahl von Minuten fördert: Für jeden Rohstoff zählt die Stundenproduktion, die in der Mitte aller Spieler liegt (der Median), umgerechnet auf die Minuten dieses Tages. Die Minuten steigen mit dem Tag der Runde, zuerst schnell, dann immer langsamer, und bleiben ab Tag {last} gleich. Der Tag wechselt um Mitternacht UTC. Die Belohnung kommt auf deinen Heimatplaneten und darf das Lager überfüllen.',
      { last: number(LAST_RISING_DAY) },
    ),
    formulas({
      text: 'Minuten = 30 + 60 · ln(Tag) ÷ ln({last}), gerundet, ab Tag {last} unverändert',
      values: { last: number(LAST_RISING_DAY) },
      fn: (day) =>
        Math.round(
          30 +
            (60 * Math.log(Math.min(day!, LAST_RISING_DAY))) /
              Math.log(LAST_RISING_DAY),
        ),
      rule: rewardMinutes,
      samples: [[1], [2], [7], [15], [30], [90]],
    }),
    formulas({
      text: 'Belohnung = ⌊Stundenproduktion des mittleren Spielers · Minuten ÷ 60⌋, je Rohstoff',
      fn: (perHour, day) => Math.floor((perHour! * rewardMinutes(day!)) / 60),
      rule: (perHour, day) => dailyReward([perHour!, 0, 0], day!)[0],
      samples: [
        [6000, 1],
        [3000, 10],
        [1500, 30],
        [0, 5],
      ],
    }),
    table(
      `Belohnung bei einer mittleren Produktion von ${number(OUTPUT[0])} Adamant, ${number(OUTPUT[1])} Psikristall und ${number(OUTPUT[2])} Promethium je Stunde`,
      ['Tag der Runde', 'Minuten', 'Adamant', 'Psikristall', 'Promethium'],
      DAYS.map((day) => {
        const reward = dailyReward(OUTPUT, day);
        return [day, rewardMinutes(day), reward[0], reward[1], reward[2]];
      }),
    ),
  );

const achievementsSection = (): PageSection =>
  section(
    'achievements',
    'Erfolge',
    say(
      'Ein Erfolg ist eine Zielmarke, die du erreichst, zum Beispiel eine Stufe eines Gebäudes oder eine Zahl von Schiffen. Hast du sie erreicht, holst du die Belohnung ab, und zwar je Erfolg nur einmal. Sie kommt auf den Heimatplaneten. Für eine Stufe zahlt ein Erfolg {level} der Kosten der erreichten Stufe, für Schiffe und Verteidigungsanlagen {unit} der Kosten eines Stücks je Stück der Zielmarke, nie mehr als {cap} je Rohstoff.',
      {
        level: percent(LEVEL_REWARD),
        unit: percent(UNIT_REWARD),
        cap: number(REWARD_CAP),
      },
    ),
    table(
      'Die Reihen der Erfolge und ihre Zielmarken',
      ['Reihe', 'Zielmarken'],
      (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((c) => [
        CATEGORIES[c],
        targets(c),
      ]),
    ),
    say(
      'Die Erfolge für gestartete Flotten und Aufträge an die Schiffsschmiede zahlen feste Beträge, die mit der Zielmarke wachsen.',
    ),
    table(
      'Belohnung für gestartete Flotten und Aufträge an die Schiffsschmiede',
      [
        'Zielmarke',
        'Flotten: Adamant, Psikristall, Promethium',
        'Aufträge: Adamant, Psikristall, Promethium',
      ],
      series('fleet:send').map((a, i) => [
        a.target,
        a.reward.map(number).join(' · '),
        series('yard:order')[i]!.reward.map(number).join(' · '),
      ]),
    ),
  );

const roundSection = (s: LexState): PageSection =>
  section(
    'round',
    'In dieser Runde',
    say(
      'Der Admin legt je Runde fest, ob es Erfolge und Tagesbelohnungen gibt.',
    ),
    facts([
      ['Erfolge', yesNo(s.round.achievements)],
      ['Tagesbelohnungen', yesNo(s.round.daily)],
    ]),
  );

export const page: PageDef = {
  id: 'rule-rewards',
  kind: 'rule',
  title: 'Tagesbelohnung und Erfolge',
  line: 'Wie die Tagesbelohnung wächst und was die Erfolge auszahlen.',
  keywords: ['Belohnung', 'täglich', 'Achievement', 'Erfolg', 'abholen'],
  seeAlso: ['rule-universe', 'faq-resources'],
  sections: (s) => [dailySection(), achievementsSection(), roundSection(s)],
};
