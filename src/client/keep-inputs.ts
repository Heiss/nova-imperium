// What the player typed into a field survives a redraw (formerly in main.ts):
// before the view is drawn again the fields with an id are read, afterwards
// their values are put back and the focus returns. A field that marks itself
// `data-nokeep` shows what the server says (a share, a setting, a draft that
// a component keeps). Components that own their input state (the account
// deletion, #118 package 8) need none of this.
import { keeps } from './logic/jump-gate.ts';

/** Reads the fields of the view (not after a fresh render) and returns what puts them back. */
export function keepInputs(view: HTMLElement, fresh: boolean): () => void {
  const saved: Record<string, string> = {};
  const checked: Record<string, boolean> = {};
  const focus = document.activeElement?.id;
  if (!fresh)
    view
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input[id],select[id],textarea[id]')
      .forEach((i) => {
        if (i.hasAttribute('data-rank-right'))
          checked[i.id] = (i as HTMLInputElement).checked;
        else saved[i.id] = i.value;
      });
  return () => {
    for (const [id, v] of Object.entries(saved)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.hasAttribute('data-nokeep') && keeps(el, v)) el.value = v;
    }
    // A ticked or cleared box of a guild rank survives the refresh (#163);
    // a disabled one shows the server's state, it is no draft.
    for (const [id, on] of Object.entries(checked)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.disabled) el.checked = on;
    }
    if (focus) document.getElementById(focus)?.focus();
  };
}
