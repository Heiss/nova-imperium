// „Optionen“, the data of the box of the choices of the player (#118): the
// probes per scan, the (?) mark and the overview of levels.
import { type Choice, explainChoices } from '../explain.ts';
import { levelChoices } from '../level-mode.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface ChoicesPart {
  probes: number;
  explain: Choice[];
  levels: Choice[];
}

/** The choices at the view state; one probe for a player without a number of them. */
export const choicesPart = ({ s }: OptionsState): ChoicesPart => ({
  probes: s.me.probes || 1,
  explain: explainChoices(s.me.explain),
  levels: levelChoices(s.me.levelTable),
});
