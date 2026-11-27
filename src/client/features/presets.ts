// The presets of the round settings (#441, owner, 2026-11-27): „Umstellen“
// puts the values of a preset into the fields and saves nothing. In the
// dialog „Neue Runde“ every field; in the tab „Universum“ only the rows of
// the `live` settings (237a). Each field reports its change like a typed
// one, so the dialog writes its lines again and the universe settings keep
// the draft over a redraw (logic/settings-draft.ts).
import {
  presetValues,
  ROUND_SETTINGS,
  roundFieldId,
} from '../../core/round.ts';
import {
  askPreset,
  closePreset,
  type PresetPlace,
  presetOf,
} from '../logic/presets.svelte.ts';
import { setField } from '../dom.ts';
import type { ClientFeature } from './contract.ts';

type Field = HTMLInputElement | HTMLSelectElement;

/** Puts a value into a field and tells the page, as a typed one does. */
function fill(field: Field | null, value: number | boolean): void {
  if (!field) return;
  setField(field, String(value));
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

const byId = (id: string): Field | null =>
  document.getElementById(id) as Field | null;

/** The fields of a preset in its place (#441, 237a). */
export function fillPreset(place: PresetPlace, id: string | undefined): void {
  const preset = presetOf(id);
  if (!preset) return;
  if (place === 'round') {
    const values = presetValues(preset, false);
    for (const s of ROUND_SETTINGS)
      if (s.name in values) fill(byId(roundFieldId(s)), values[s.name]!);
  } else {
    const values = presetValues(preset, true);
    for (const [key, value] of Object.entries(values))
      fill(byId(`set_${key}`), value);
  }
}

const placeOf = (place: string | undefined): PresetPlace | null =>
  place === 'round' || place === 'universe' ? place : null;

export const clientFeature = {
  acts: () => ({
    askPreset: (d) => {
      const place = placeOf(d.place);
      const preset = presetOf(d.id);
      if (place && preset) askPreset(place, preset);
    },
    applyPreset: (d) => {
      const place = placeOf(d.place);
      if (place) fillPreset(place, d.id);
      closePreset();
    },
    cancelPreset: () => closePreset(),
  }),
} satisfies ClientFeature;
