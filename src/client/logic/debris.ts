// Trümmerfelder in the interface (#45, owner, 2026-11-13): the symbol on the
// Sternenkarte with its tooltip, visible to every player, the button
// „Bergung“, and the sentence of the battle report.
import type { Debris, DebrisField } from '../../core/debris.ts';
import { MISSION } from '../../core/missions.ts';
import type { Coords } from '../../core/types.ts';
import { fmt } from './format.ts';

/** The field at a position, if one lies there. */
export const debrisAt = (
  fields: readonly DebrisField[] | undefined,
  c: Coords,
): DebrisField | undefined =>
  fields?.find((d) => d.g === c.g && d.s === c.s && d.p === c.p);

/** The tooltip of the symbol. */
export const debrisTip = (d: Debris): string =>
  `Trümmerfeld: ${fmt(d.m)} Adamant, ${fmt(d.c)} Psikristall`;

/** The symbol of a field on the Sternenkarte, with its tooltip. */
export const debrisMark = (d: Debris): string => {
  const tip = debrisTip(d);
  return `<img class="debris" src="/icons/debris.svg" alt="${tip}" title="${tip}" width="20" height="20">`;
};

/** The button that opens the fleet form with the mission „Bergung“. */
export const harvestButton = (c: Coords): string =>
  `<button class="small" data-act="gfleet" data-m="harvest" data-g="${c.g}" data-s="${c.s}" data-p="${c.p}">${MISSION.harvest}</button>`;

/** The sentence of a battle report that left debris; none for a battle without. */
export const debrisLine = (d: Debris | undefined): string =>
  d && d.m + d.c > 0
    ? `Es entstand ein Trümmerfeld mit ${fmt(d.m)} Adamant und ${fmt(d.c)} Psikristall.`
    : '';
