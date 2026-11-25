// „Optionen“, the data of the box of the main planet (#221).
import { type MainPlanetBox, mainPlanetBox } from '../main-planet.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface MainPlanetPart {
  main: MainPlanetBox;
}

/** The main planet at the view state. */
export const mainPlanetPart = ({ s, now }: OptionsState): MainPlanetPart => ({
  main: mainPlanetBox(s, now),
});
