<script lang="ts">
  // The form of a message (#226): „Neue Nachricht“ with the recipient by name
  // and the text, or „Antworten“ in an open conversation (`to` is then the
  // recipient and the field for it is not there). The component owns the
  // fields and the busy state, so a redraw of the page (the poll of the state)
  // never touches them; `pmCall` asks features/private-messages.ts to send and
  // says whether it went through, and only then the fields go.
  import { MAX_PM_TEXT } from '../../core/private-messages.ts';
  import { PM_LABELS, pmCall } from '../logic/private-messages.ts';

  let {
    names = [],
    to,
    sent = () => {},
  }: {
    /** The names offered for the recipient. */
    names?: string[];
    /** The recipient of a reply; none for a new message. */
    to?: string;
    /** Called with the recipient once the message went through. */
    sent?: (to: string) => void;
  } = $props();

  const reply = $derived(to !== undefined);

  let recipient = $state('');
  let text = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const name = (to ?? recipient).trim();
    const ok = await pmCall(event.currentTarget as HTMLFormElement, [
      'sendPrivateMessage',
      { name, text },
    ]);
    busy = false;
    if (!ok) return;
    recipient = '';
    text = '';
    sent(name);
  }
</script>

<form id={reply ? 'pm-reply' : 'pm-compose'} class="flex" onsubmit={submit}>
  {#if !reply}
    <label for="pm-to">{PM_LABELS.recipient}</label>
    <input
      id="pm-to"
      list="pm-names"
      maxlength="20"
      required
      autocomplete="off"
      value={recipient}
      oninput={(e) => (recipient = e.currentTarget.value)}
    />
    <datalist id="pm-names">
      {#each names as name (name)}<option value={name}></option>{/each}
    </datalist>
  {/if}
  <label for={reply ? 'pm-reply-text' : 'pm-text'}>{PM_LABELS.text}</label>
  <input
    id={reply ? 'pm-reply-text' : 'pm-text'}
    class="wide"
    maxlength={MAX_PM_TEXT}
    required
    autocomplete="off"
    value={text}
    oninput={(e) => (text = e.currentTarget.value)}
  />
  <button type="submit" disabled={busy}
    >{reply ? PM_LABELS.reply : PM_LABELS.send}</button
  >
</form>
