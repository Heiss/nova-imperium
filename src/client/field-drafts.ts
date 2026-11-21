// The fields of the page and their drafts (logic/field-drafts.ts; formerly
// keepInputs of main.ts): every change of a field is recorded when it
// happens, and a view that is drawn anew gets the drafts back. The focus is
// kept the same way.
import { fieldDrafts, type Field } from './logic/field-drafts.ts';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const SELECTOR = 'input[id],select[id],textarea[id]';

const fieldOf = (el: Control): Field => ({
  id: el.id,
  value: el.value,
  options: el instanceof HTMLSelectElement ? el.options : null,
});

/** Records the change of a field of the view. */
function note(event: Event): void {
  const el = event.target;
  if (
    (el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.id &&
    el.closest('#view')
  )
    fieldDrafts.record(fieldOf(el));
}

/** Starts to record what the player types or chooses in the view. */
export function trackFields(): void {
  document.addEventListener('input', note, { capture: true });
  document.addEventListener('change', note, { capture: true });
}

/** Sets a field from the code (a button fills it) and records it as the player's. */
export function writeField(el: Control, value: string): void {
  el.value = value;
  if (el.id && el.closest?.('#view')) fieldDrafts.record(fieldOf(el));
}

/** Puts the drafts back into the fields of a view that was drawn anew. */
export function restoreFields(view: HTMLElement): void {
  view.querySelectorAll<Control>(SELECTOR).forEach((el) => {
    const back = fieldDrafts.restore(fieldOf(el));
    if (back.value !== undefined) el.value = back.value;
  });
}

/** Drops every draft. */
export const forgetFields = (): void => fieldDrafts.reset();
