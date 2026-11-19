// The targets of the missions as the Lexicanum names them (#285, #289): the
// facts of a mission article and the guide „Deine erste Flotte“ read the
// same words.
import type { TargetKind } from '../missions.ts';

/** The target of a mission, as the fleet view names it. */
export const TARGET_NAMES: Readonly<Record<TargetKind, string>> = {
  own: 'eigener Planet',
  foreign: 'fremder Planet',
  ally: 'Planet eines Gildenmitglieds oder Freundes',
  any: 'jeder Planet',
  free: 'Freie Position',
  debris: 'Trümmerfeld',
  foreignMoon: 'fremder Mond',
  expedition: 'Expeditionsposition',
};
