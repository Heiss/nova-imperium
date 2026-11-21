// The pages of the Lexicanum that are written, in the order of the start
// page: the rule pages and the questions of stage 2 (#288) and the guides of
// stage 3 (#289). A guard checks that every file of this folder is listed.
import type { PageDef } from '../types.ts';
import { page as allies } from './allies.ts';
import { page as battle } from './battle.ts';
import { page as colonies } from './colonies.ts';
import { page as debris } from './debris.ts';
import { page as endzeit } from './endzeit.ts';
import { page as expeditions } from './expeditions.ts';
import { page as faqAftermath } from './faq-aftermath.ts';
import { page as faqAttack } from './faq-attack.ts';
import { page as faqColony } from './faq-colony.ts';
import { page as faqDefend } from './faq-defend.ts';
import { page as faqIntel } from './faq-intel.ts';
import { page as faqMine } from './faq-mine.ts';
import { page as faqResources } from './faq-resources.ts';
import { page as faqSlots } from './faq-slots.ts';
import { page as flight } from './flight.ts';
import { page as gates } from './gates.ts';
import { page as guilds } from './guilds.ts';
import { page as guideColony } from './guide-colony.ts';
import { page as guideDefense } from './guide-defense.ts';
import { page as guideFleet } from './guide-fleet.ts';
import { page as guideNext } from './guide-next.ts';
import { page as guideStart } from './guide-start.ts';
import { page as highscore } from './highscore.ts';
import { page as market } from './market.ts';
import { page as missiles } from './missiles.ts';
import { page as moons } from './moons.ts';
import { page as planets } from './planets.ts';
import { page as production } from './production.ts';
import { page as protection } from './protection.ts';
import { page as queues } from './queues.ts';
import { page as rewards } from './rewards.ts';
import { page as spy } from './spy.ts';
import { page as survey } from './survey.ts';
import { page as universe } from './universe.ts';
import { page as vacation } from './vacation.ts';
import { page as vision } from './vision.ts';

export const PAGES: readonly PageDef[] = [
  // The rule pages.
  battle,
  spy,
  flight,
  debris,
  moons,
  gates,
  planets,
  colonies,
  missiles,
  survey,
  expeditions,
  allies,
  production,
  queues,
  protection,
  vacation,
  vision,
  rewards,
  highscore,
  market,
  guilds,
  endzeit,
  universe,
  // The questions.
  faqIntel,
  faqAttack,
  faqSlots,
  faqAftermath,
  faqColony,
  faqMine,
  faqResources,
  faqDefend,
  // The guides (#289).
  guideStart,
  guideColony,
  guideFleet,
  guideDefense,
  guideNext,
];
