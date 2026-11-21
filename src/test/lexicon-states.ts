// States the pages of the Lexicanum are checked in (#288): the defaults, and
// a state whose universe, round settings, research and ships all differ, so
// a typed value or an unfilled placeholder shows in one of them.
import { ROUND_SETTINGS } from '../core/round.ts';
import { defaultRound, defaultState } from '../core/lexicon/state.ts';
import type { LexState } from '../core/lexicon/types.ts';
import { DEFAULT_UNIVERSE } from '../core/universe.ts';

/** The round with every setting at the other end of its range. */
const otherRound = () => {
  const round = defaultRound() as unknown as Record<string, number | boolean>;
  for (const s of ROUND_SETTINGS)
    round[s.name] =
      s.kind === 'switch' ? !s.def : s.def === s.max ? s.min : s.max;
  return round as unknown as LexState['round'];
};

/** The states every page is checked in: the defaults, and a very different one. */
export const STATES: LexState[] = [
  defaultState(),
  {
    u: { ...DEFAULT_UNIVERSE, speed: 40, galaxies: 7, systems: 120 },
    round: otherRound(),
    research: { spy: 12, computer: 6, comb: 5, impulse: 9, colonial: 3 },
    ships: { probe: 30, sc: 5, colony: 1 },
  },
];
