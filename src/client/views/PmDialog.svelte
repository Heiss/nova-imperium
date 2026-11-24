<script lang="ts">
  // The dialog of a message (#349, variant C of the design study): the button
  // „Neue Nachricht“ of the inbox, or „Antworten“ below an open conversation,
  // opens a native modal <dialog> (focus trap, Escape and the backdrop come
  // with it) titled like the button. „Abbrechen“ and Escape close it and the
  // focus goes back to the button; what was typed stays as the draft
  // (logic/pm-compose.ts). The form is there only while the dialog is open,
  // so it starts from the draft each time. On a phone the dialog fills the
  // screen (style.css).
  import type { QuickChoice } from '../logic/pm-compose.ts';
  import { PM_LABELS } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';

  let {
    names = [],
    quick,
    to,
    quote,
    sent = () => {},
  }: {
    /** The names offered for the recipient. */
    names?: string[];
    /** The quick choice under „Empfänger“. */
    quick?: QuickChoice;
    /** The recipient of a reply; none for a new message. */
    to?: string;
    /** The text of the last message received, quoted in a reply. */
    quote?: string;
    /** Called with the recipient once the message went through. */
    sent?: (to: string) => void;
  } = $props();

  let open = $state(false);
  let dialog = $state<HTMLDialogElement>();
  let opener = $state<HTMLButtonElement>();

  const id = $derived(to === undefined ? 'pm-compose' : 'pm-reply');
  const title = $derived(
    to === undefined ? PM_LABELS.compose : PM_LABELS.reply,
  );

  function show(): void {
    open = true;
    dialog?.showModal();
  }

  /** The dialog closed („Abbrechen“, Escape or sent): the form goes, the focus returns. */
  function closed(): void {
    open = false;
    opener?.focus();
  }
</script>

<button type="button" aria-haspopup="dialog" bind:this={opener} onclick={show}
  >{title}</button
>
<dialog
  {id}
  class="pm-dialog"
  aria-labelledby="{id}-title"
  bind:this={dialog}
  onclose={closed}
>
  {#if open}
    <h3 id="{id}-title">{title}</h3>
    <PmCompose
      {names}
      {quick}
      {to}
      {quote}
      cancel={() => dialog?.close()}
      sent={(name) => {
        dialog?.close();
        sent(name);
      }}
    />
  {/if}
</dialog>
