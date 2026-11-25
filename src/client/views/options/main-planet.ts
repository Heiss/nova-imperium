// „Optionen“: the main planet (#221); its data is in logic/options/main-
// planet.ts.
import { mainPlanetPart } from '../../logic/options/main-planet.ts';
import MainPlanet from './MainPlanetBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'mainPlanet',
    order: 20,
    section: 'game',
    component: MainPlanet,
    data: mainPlanetPart,
  }),
];
