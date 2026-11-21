// Trümmerfelder in the interface (#45, owner, 2026-11-13): the tooltip of the
// symbol on the Sternenkarte, visible to every player (the symbol and the
// button „Bergung“ are drawn by views/Galaxy.svelte), and the sentence of the
// battle report.
import type { Debris, DebrisField } from '../../core/debris.ts';
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

/** The sentence of a battle report that left debris; none for a battle without. */
export const debrisLine = (d: Debris | undefined): string =>
  d && d.m + d.c > 0
    ? `Es entstand ein Trümmerfeld mit ${fmt(d.m)} Adamant und ${fmt(d.c)} Psikristall.`
    : '';
