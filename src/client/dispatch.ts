// The clicks and forms of the page (formerly in main.ts): a click on an
// element with `data-act` runs the handler of that name, a submit runs the
// handler of the form by its id. The handlers are the ones of the features
// (features/); each name once.
import { api } from './api.ts';
import {
  assembleActs,
  assembleForms,
  startListeners,
} from './features/assemble.ts';
import type { ClientCtx } from './features/contract.ts';
import { CLIENT_FEATURES } from './features/index.gen.ts';
import { $ } from './dom.ts';
import { trackFields, writeField } from './field-drafts.ts';
import { modal } from './modal.ts';
import { render } from './render.ts';
import { go } from './routing.ts';
import { signedOut } from './session.ts';
import { act, actHere, apply, quiet } from './sync.ts';
import { toast } from './toast.ts';

const setInput = (sel: string, v: string | number): void => {
  const el = $<HTMLInputElement>(sel);
  if (el) writeField(el, String(v));
};

/** What the features need (features/contract.ts). */
const ctx: ClientCtx = {
  act,
  actHere,
  quiet,
  modal,
  go,
  render,
  api,
  toast,
  setInput,
  apply,
  signedOut,
};

/** Puts the features on the page and listens to the clicks and forms. */
export function startDispatch(): void {
  trackFields();
  startListeners(CLIENT_FEATURES, ctx);
  const acts = assembleActs({}, CLIENT_FEATURES, ctx);
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    const fn = el ? acts[el.dataset.act!] : undefined;
    if (!el || !fn) return;
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (el instanceof HTMLAnchorElement && (modified || e.button !== 0)) return;
    e.preventDefault();
    void fn({ ...el.dataset });
  });
  const forms = assembleForms({}, CLIENT_FEATURES, ctx);
  document.addEventListener('submit', (e) => {
    const id = (e.target as HTMLElement).id;
    const handle = Object.hasOwn(forms, id) ? forms[id] : undefined;
    if (!handle) return;
    e.preventDefault();
    void handle();
  });
}
