// The presets of the round settings (#441, owner, 2026-11-27): a click on a
// preset asks first, „Umstellen“ fills the fields and saves nothing,
// „Abbrechen“ changes nothing, and only the save below applies the values.
// The open question is kept here, so a redraw of the page keeps it.
import { PRESETS, type PresetId } from '../../core/round.ts';

/** Where a preset is offered: the dialog „Neue Runde“ or the tab „Universum“. */
export type PresetPlace = 'round' | 'universe';

/** The question that is open, or none. */
export const presetAsk = $state<{
  place: PresetPlace | null;
  id: PresetId | null;
}>({ place: null, id: null });

/** The id of a preset as the page gives it, or null for an unknown one. */
export const presetOf = (id: string | undefined): PresetId | null =>
  PRESETS.find((p) => p.id === id)?.id ?? null;

/** Asks before the preset `id` is put into the fields of `place`. */
export function askPreset(place: PresetPlace, id: PresetId): void {
  presetAsk.place = place;
  presetAsk.id = id;
}

/** Closes the question. */
export function closePreset(): void {
  presetAsk.place = null;
  presetAsk.id = null;
}

/** The question of a preset, in the owner's words (#441, 237). */
export const presetQuestion = (name: string): string =>
  `Sollen die Einstellungen auf das Regelset „${name}“ umgestellt werden? Achtung: Erst „Speichern“ unten übernimmt die Änderung.`;
