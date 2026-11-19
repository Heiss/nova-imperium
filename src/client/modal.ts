// The dialog of the page (#modal, #modalIn of index.html): HTML, or a Svelte
// component that mounts into it (#118, bundle 6). Showing anything takes the
// dialog before down, so a component is unmounted when the dialog closes or
// another one opens.
import { flushSync } from 'svelte';
import { $ } from './dom.ts';

/** A dialog that is a component: mounts into the target and returns how to take it down. */
export type Dialog = (target: HTMLElement) => () => void;

let unmountDialog: (() => void) | null = null;

/** Shows the content in the dialog; the empty string closes it. */
export function modal(content: string | Dialog): void {
  unmountDialog?.();
  unmountDialog = null;
  const into = $('#modalIn')!;
  if (typeof content === 'string') into.innerHTML = content;
  else {
    into.replaceChildren();
    unmountDialog = content(into);
    flushSync();
  }
  $('#modal')!.classList.toggle('show', content !== '');
}
