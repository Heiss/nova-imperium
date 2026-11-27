<script lang="ts">
  // The form inside the dialog of a message (#226, #349 variant C): „Neue
  // Nachricht“ with the recipient by name, the quick choice below it and the
  // text, or „Antworten“ in an open conversation (`to` is then the recipient,
  // shown as „An {Name}“ with the last message received quoted). The text is a
  // field of eight lines with the count „n / 1000“; Enter makes a new line,
  // Ctrl+Enter or Cmd+Enter sends. The component owns the fields and the busy
  // state and starts from the draft (logic/pm-compose.ts), which it keeps on
  // every key, so closing the dialog without sending keeps what was typed;
  // `pmCall` asks features/private-messages.ts to send and says whether it
  // went through, and only then the draft goes. A refusal shows inside the
  // dialog with the server's words (`role="alert"`, coordinator, 2026-11-24),
  // not as a note below the backdrop; it goes when the player changes the
  // recipient or the text, and with the dialog (it starts without one).
  import { lockedSubmit } from '../logic/act-lock.ts';
  import { MAX_PM_TEXT } from '../../core/private-messages.ts';
  import {
    countText,
    draftOf,
    dropDraft,
    firstField,
    keepDraft,
    PM_DIALOG_LABELS,
    quoteHeading,
    sendsOnKey,
    type QuickChoice,
  } from '../logic/pm-compose.ts';
  import { PM_LABELS, pmCall } from '../logic/private-messages.ts';

  let {
    names = [],
    quick = { recent: [], friends: [] },
    to,
    quote,
    sent = () => {},
    cancel = () => {},
    busy = $bindable(false),
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
    /** „Abbrechen“: closes the dialog, the draft stays. */
    cancel?: () => void;
    /**
     * While a send is on its way: „Abbrechen“ and Escape are locked (owner,
     * 2026-11-25, 85a); the dialog reads it.
     */
    busy?: boolean;
  } = $props();

  // The draft of this dialog when it opened; the component keeps it from then on.
  // svelte-ignore state_referenced_locally
  const start = draftOf(to);
  let recipient = $state(start.to);
  let text = $state(start.text);
  let refusal = $state('');
  let toField = $state<HTMLInputElement>();
  // Whether this dialog is still open: a send that answers after the dialog
  // was closed (and maybe opened again) closes and empties nothing
  // (CodeRabbit on #395).
  let open = true;
  $effect(() => () => {
    open = false;
  });
  let textField = $state<HTMLTextAreaElement>();

  const reply = $derived(to !== undefined);
  const textId = $derived(reply ? 'pm-reply-text' : 'pm-text');

  /** Keeps the fields as the draft of this dialog; a change clears the refusal. */
  function keep(): void {
    refusal = '';
    keepDraft(to, { to: recipient, text });
  }

  function pick(name: string): void {
    recipient = name;
    keep();
  }

  // When the dialog opens, the focus goes to the first empty field.
  $effect(() => {
    const field = firstField(reply, start) === 'to' ? toField : textField;
    field?.focus();
  });

  function key(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    if (!sendsOnKey(event)) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const name = (to ?? recipient).trim();
    // What is sent, to drop exactly this draft once it went through.
    const sending = { to: recipient, text };
    refusal = '';
    const ok = await pmCall(
      event.currentTarget as HTMLFormElement,
      ['sendPrivateMessage', { name, text }],
      false,
      (message) => (refusal = message),
    );
    busy = false;
    if (!ok) return;
    dropDraft(to, sending);
    if (!open) return;
    recipient = '';
    text = '';
    sent(name);
  }
</script>

<form class="pm-form" onsubmit={lockedSubmit(submit)}>
  {#if reply}
    <p class="pm-to">{PM_DIALOG_LABELS.to} <b>{to}</b></p>
    {#if quote !== undefined}
      <blockquote class="pm-quote">
        <span class="dim">{quoteHeading(to ?? '')}</span><br /><span
          class="chat-text">{quote}</span
        >
      </blockquote>
    {/if}
  {:else}
    <div class="pm-field">
      <label for="pm-to">{PM_LABELS.recipient}</label>
      <input
        id="pm-to"
        list="pm-names"
        maxlength="20"
        required
        autocomplete="off"
        bind:this={toField}
        value={recipient}
        oninput={(e) => {
          recipient = e.currentTarget.value;
          keep();
        }}
      />
      <datalist id="pm-names">
        {#each names as name (name)}<option value={name}></option>{/each}
      </datalist>
    </div>
    {#if quick.recent.length}
      <p class="pm-quick">
        <span class="dim" id="pm-quick-recent">{PM_DIALOG_LABELS.recent}</span>
        {#each quick.recent as who (who)}
          <button
            type="button"
            class="small"
            aria-describedby="pm-quick-recent"
            aria-pressed={recipient === who}
            onclick={() => pick(who)}>{who}</button
          >
        {/each}
      </p>
    {/if}
    {#if quick.friends.length}
      <p class="pm-quick">
        <span class="dim" id="pm-quick-friends">{PM_DIALOG_LABELS.friends}</span
        >
        {#each quick.friends as friend (friend)}
          <button
            type="button"
            class="small"
            aria-describedby="pm-quick-friends"
            aria-pressed={recipient === friend}
            onclick={() => pick(friend)}>{friend}</button
          >
        {/each}
      </p>
    {/if}
  {/if}
  <div class="pm-field pm-body">
    <label for={textId}>{PM_LABELS.text}</label>
    <textarea
      id={textId}
      rows="8"
      maxlength={MAX_PM_TEXT}
      required
      autocomplete="off"
      aria-describedby="{textId}-count"
      bind:this={textField}
      value={text}
      oninput={(e) => {
        text = e.currentTarget.value;
        keep();
      }}
      onkeydown={key}></textarea>
    <span class="dim pm-count" id="{textId}-count">{countText(text)}</span>
  </div>
  {#if refusal}<p class="pm-refusal" role="alert">{refusal}</p>{/if}
  <div class="pm-buttons">
    <button type="button" disabled={busy} onclick={cancel}
      >{PM_DIALOG_LABELS.cancel}</button
    >
    <button type="submit" disabled={busy}
      >{reply ? PM_LABELS.reply : PM_LABELS.send}</button
    >
  </div>
</form>
