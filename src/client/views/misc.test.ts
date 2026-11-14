// The highscore names a planet of each player, never a moon (#53).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { highscore } from './misc.ts';

describe('highscore', () => {
  it('shows the planet of a player, also when its moon comes first (#53)', () => {
    const at = { g: 1, s: 2, p: 5, temp: 20, owner: 'u_Anna' };
    const s = {
      me: { id: 'u_Anna' },
      players: { u_Anna: { name: 'Anna', points: 7 } },
      galaxy: [
        { ...at, id: 'm1_2_5', kind: 'moon', name: 'Mond' },
        { ...at, id: 'p1_2_5', kind: 'planet', name: 'Heimat' },
      ],
    } as unknown as GameState;
    const html = highscore({ s } as V);
    expect(html).toContain('<td>Heimat <span class="lnk" data-act="gto"');
    expect(html).not.toContain('Mond');
  });
});
