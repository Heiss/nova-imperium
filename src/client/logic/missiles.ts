// The Raketenangriff on the Sternenkarte (#54, okf/features/missiles.md):
// offered at a foreign planet or moon when the shown planet has
// Orbitalraketen and the target is in their range (`inMissileRange` of the
// core, as the server checks it); the form asks for the count and the main
// target. The server checks the rest (`launchError`).
import { inMissileRange, STRIKER, TARGETS } from '../../core/missiles.ts';
import { text } from '../../core/text.ts';
import type { Planet, ResearchState } from '../../core/types.ts';
import type { GalaxyPlanet } from './types.ts';

/** The Orbitalraketen on the shown place. */
export const missilesHere = (here: Pick<Planet, 'def'>): number =>
  here.def[STRIKER] ?? 0;

/** Whether the Sternenkarte offers a Raketenangriff at `pl` from `here`. */
export const canLaunch = (
  here: Pick<Planet, 'def' | 'owner' | 'g' | 's' | 'p'>,
  r: Pick<ResearchState, 'research'>,
  pl: GalaxyPlanet,
): boolean =>
  missilesHere(here) > 0 &&
  pl.owner !== here.owner &&
  inMissileRange(here, pl, r.research.impulse ?? 0);

/** The choices of the main target: none, then every defense a missile can hit. */
export const aimChoices = (): { key: string; name: string }[] => [
  { key: '', name: 'Kein Hauptziel' },
  ...TARGETS.map((k) => ({ key: k, name: text(k)!.n })),
];

/** The launch the form asks for: the target, the count and the main target. */
export function launchOrder(
  at: { g?: string; s?: string; p?: string; k?: string },
  n: string,
  aim: string,
): {
  to: { g: number; s: number; p: number; kind: 'planet' | 'moon' };
  n: number;
  aim: string | null;
} {
  return {
    to: {
      g: Number(at.g),
      s: Number(at.s),
      p: Number(at.p),
      kind: at.k === 'moon' ? 'moon' : 'planet',
    },
    n: Number(n),
    aim: aim === '' ? null : aim,
  };
}
