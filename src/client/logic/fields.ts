// The fields of a planet as the interface shows them (#51): the overview
// next to the diameter, the buildings page above the list.
import { maxFields, usedFields } from '../../shared/fields.ts';
import type { Planet, Universe } from '../../shared/types.ts';
import { fmt } from './format.ts';

type FieldPlanet = Pick<Planet, 'b' | 'diameter' | 'unlimited'>;
type FieldUniverse = Pick<Universe, 'extraFields'>;

/** „Felder: 54 / 163“; a planet from before the fields „Felder: 54 / unbegrenzt“. */
export function fieldsLine(p: FieldPlanet, u: FieldUniverse): string {
  const max = maxFields(p, u);
  return `Felder: ${fmt(usedFields(p))} / ${max === null ? 'unbegrenzt' : fmt(max)}`;
}

/** „12.800 km (54/163 Felder)“; without a limit „12.800 km (54 Felder, unbegrenzt)“. */
export function diameterLine(p: FieldPlanet, u: FieldUniverse): string {
  const max = maxFields(p, u);
  const used = fmt(usedFields(p));
  const fields =
    max === null ? `${used} Felder, unbegrenzt` : `${used}/${fmt(max)} Felder`;
  return `${fmt(p.diameter)} km (${fields})`;
}
