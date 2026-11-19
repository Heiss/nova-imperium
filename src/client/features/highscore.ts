// The categories of the Bestenliste: the buttons choose which one is shown.
import { highscoreCategory } from '../logic/highscore.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ render }) => ({
    highscore: (d) => {
      client.ui.highscore = highscoreCategory(d.cat);
      render();
    },
  }),
} satisfies ClientFeature;
