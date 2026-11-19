// The rule page „Kolonien und Planetengrenze“ (#288): founding a colony, the
// limit of planets (#237), giving a colony up (#224) and the main planet
// (#221). The numbers come from `src/core/colony-limit.ts`, `abandon.ts`,
// `main-planet.ts`, `survey.ts` and the round; the words are a draft of
// Claude for the owner to check ([V], #288).
import { ABANDON_LOCK_HOURS } from '../../abandon.ts';
import {
  type ColonyRules,
  colonyRules,
  limitLine,
  MOST_PLANETS,
  planetLimit,
} from '../../colony-limit.ts';
import { MAIN_LOCK_DAYS } from '../../main-planet.ts';
import { SURVEY_DAYS } from '../../survey.ts';
import {
  days,
  facts,
  formulas,
  hours,
  number,
  say,
  section,
  table,
} from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

const LEVELS = [0, 1, 2, 3, 4, 5, 8, 10];

const foundSection = (): PageSection =>
  section(
    'found',
    'Eine Kolonie gründen',
    say(
      'Eine Kolonie gründest du mit einer [[colony|Kolonistenarche]] und dem Auftrag [[mission-colonize]]. Das Ziel muss eine freie Position sein: Eine Position, an der eine Kolonie aufgegeben wurde, bleibt für jede Landnahme eine Zeit lang gesperrt, und die Expeditionsposition am Rand jedes Systems lässt sich nie besiedeln. Ist die Position bei der Ankunft nicht mehr frei, kehrt die Flotte mit ihrer Ladung um. Die Arche bleibt in der neuen Kolonie, und die Ladung der Flotte wird ihr erster Vorrat. Größe und Temperatur der Kolonie stehen unter [[rule-planets]]; eine [[mission-survey|Vermessung]] zeigt sie vorher und hält sie {survey} fest.',
      { survey: days(SURVEY_DAYS) },
    ),
  );

/** The rules of the limit as facts: what this round gives. */
const limitFacts = (rules: ColonyRules): Block =>
  facts([
    [
      'Grundgrenze in dieser Runde',
      rules.base === 0 ? 'keine Grenze' : number(rules.base),
    ],
    ['Kolonialverwaltung in dieser Runde', rules.research ? 'ja' : 'nein'],
    ...(rules.research
      ? ([
          ['Planeten je Stufe', number(rules.perLevel)],
          [
            'Höchste Stufe',
            rules.maxLevel === 0 ? 'unbegrenzt' : number(rules.maxLevel),
          ],
        ] as [string, string][])
      : []),
  ]);

/** The formula and the table of the limit by level; only where the round has the research. */
const limitByLevel = (rules: ColonyRules, level: number): Block[] =>
  rules.base > 0 && rules.research
    ? [
        formulas({
          text: 'Planetengrenze = Grundgrenze + Planeten je Stufe · Stufe der Kolonialverwaltung, höchstens {most}',
          values: { most: number(MOST_PLANETS) },
          fn: (at) =>
            Math.min(
              MOST_PLANETS,
              rules.base +
                rules.perLevel *
                  (rules.maxLevel > 0 ? Math.min(at!, rules.maxLevel) : at!),
            ),
          rule: (at) => planetLimit(rules, at!)!,
          samples: [[0], [1], [3], [10], [30]],
        }),
        table(
          'Planetengrenze nach der Kolonialverwaltung',
          ['Stufe der Kolonialverwaltung', 'Planeten'],
          LEVELS.map((l) => [l, planetLimit(rules, l)!]),
          (i) => LEVELS[i] === level,
        ),
      ]
    : [];

const limitSection = (s: LexState): PageSection => {
  const rules = colonyRules(s.u);
  const level = s.research.colonial ?? 0;
  return section(
    'limit',
    'Die Planetengrenze',
    say(
      'Der Admin kann für die Runde festlegen, wie viele Planeten ein Spieler besitzen darf, der Heimatplanet eingerechnet. Monde zählen nicht mit, und eine Landnahme, die noch unterwegs ist, belegt ihren Platz schon beim Start. Kommt eine Flotte an, wenn die Grenze erreicht ist, kehrt sie mit der Arche und ihrer Ladung zurück. Auf Wunsch des Admins gibt es die Forschung [[colonial|Kolonialverwaltung]], die die Grenze um einige Planeten je Stufe anhebt, nie über {most} Planeten insgesamt. Ohne diese Einstellung gibt es keine Grenze.',
      { most: number(MOST_PLANETS) },
    ),
    limitFacts(rules),
    ...limitByLevel(rules, level),
    ...(s.own
      ? ([
          {
            t: 'stand',
            text: `Dein Stand: ${limitLine(rules, s.own.planets, level)}`,
          },
        ] as Block[])
      : []),
  );
};

const abandonSection = (s: LexState): PageSection =>
  section(
    'abandon',
    'Eine Kolonie aufgeben',
    say(
      'Eine Kolonie kannst du aufgeben, mit deinem Passwort. Nicht aufgeben lässt sich der Hauptplanet, und es darf nichts mehr auf die Kolonie oder ihren Mond verweisen: kein Flug von dort oder dorthin, keine Forschung, die dort läuft, und kein Auftrag der Bauschleife oder der Schiffsschmiede. Alles auf der Kolonie ist dann verloren, auch ihr Mond. Die Position bleibt {lock} für eine Landnahme gesperrt; der Admin legt das für die Runde fest.',
      { lock: hours(s.round.abandonLock) },
    ),
    say('Der Admin kann sie auf {low} bis {high} Stunden einstellen.', {
      low: number(ABANDON_LOCK_HOURS.min),
      high: number(ABANDON_LOCK_HOURS.max),
    }),
  );

const mainSection = (s: LexState): PageSection =>
  section(
    'main',
    'Der Hauptplanet',
    say(
      'Der Hauptplanet ist der Planet, den du in den Optionen wählst; ohne Wahl ist es dein erster Planet. Er bestimmt nur, wohin die Navigation springt und wo geforscht wird. Wechselst du, sperrt das den nächsten Wechsel für {lock}; der Admin legt das für die Runde fest. Verlierst du den gewählten Planeten, wird der älteste Planet, den du noch hast, zum Hauptplaneten, ohne Sperre. Die Sperre kann der Admin auf {low} bis {high} Tage einstellen.',
      {
        lock: days(s.round.mainLock),
        low: number(MAIN_LOCK_DAYS.min),
        high: number(MAIN_LOCK_DAYS.max),
      },
    ),
  );

export const page: PageDef = {
  id: 'rule-colonies',
  kind: 'rule',
  title: 'Kolonien und Planetengrenze',
  line: 'Wie du eine Kolonie gründest, wie viele Planeten du haben darfst, wie du eine aufgibst und was der Hauptplanet ist.',
  keywords: ['Kolonie', 'Planetengrenze', 'gründen', 'aufgeben', 'Hauptplanet'],
  seeAlso: [
    'colony',
    'colonial',
    'mission-colonize',
    'mission-survey',
    'faq-colony',
  ],
  sections: (s) => [
    foundSection(),
    limitSection(s),
    abandonSection(s),
    mainSection(s),
  ],
};
