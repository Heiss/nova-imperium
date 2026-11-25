// „Optionen“, the data of the box of the vacation mode (#223).
import { vacationIntro } from '../vacation.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface VacationPart {
  /** The first paragraph of the box „Urlaubsmodus“. */
  vacation: string;
}

/** The first paragraph at the view state: the minimum duration of the round. */
export const vacationPart = ({ s }: OptionsState): VacationPart => ({
  vacation: vacationIntro(s.round.vacationHours),
});
