// A view of a planet and research for the tests of the level table (#187):
// what V holds that the level overview and the Lexicanum read.
import type { Ui, V } from '../client/views/common.ts';
import type { GameState } from '../client/logic/types.ts';
import type { Levels, Planet } from '../core/types.ts';
import { planet, U } from './fixtures.ts';

export function levelView(
  P: Partial<Planet> = {},
  research: Levels = {},
  labs = [],
  me: object = {},
): V {
  return {
    s: {
      cfg: U,
      me: { id: 'u1', explain: 'icon', ...me },
      labs,
      galaxy: [],
      mainPlanet: 'p',
    } as unknown as GameState,
    P: planet({ res: { m: 0, c: 0, d: 0 }, ...P }),
    R: { research, rq: null },
    now: 0,
    ui: { openEx: {} } as unknown as Ui,
  };
}
