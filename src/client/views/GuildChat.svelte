<script lang="ts">
  // The chat of the own guild (#169): the messages with „Chat lesen“, the text
  // field with „Chat schreiben“. The form is sent by features/social.ts. The
  // field shows the draft of logic/drafts.svelte.ts, which the redraw of the
  // page does not touch, until the message went through (`chat_text` has no field draft).
  // `place` (#496): the page of the guild (the ids as before), the tab „Gilde“
  // of „Nachrichten“ or the chat window; each has its own ids, so the window
  // and a view can show the chat at once. The window keeps its own draft
  // over a change of the view, and has its own frame instead of the box.
  import { chatDraft, chatIds, type ChatPlace } from '../logic/chat-place.ts';
  import { drafts } from '../logic/drafts.svelte.ts';
  import type { ChatBoxModel } from '../logic/guilds.ts';
  import Box from './Box.svelte';
  import ChatLog from './ChatLog.svelte';

  let { chat, place = 'guild' }: { chat: ChatBoxModel; place?: ChatPlace } =
    $props();
  const ids = $derived(chatIds(place));
  const draft = $derived(chatDraft(place));
</script>

{#snippet body()}
  <p class="dim">Die Spielleitung kann diesen Chat lesen.</p>
  {#if chat.log}<ChatLog log={chat.log} />{/if}
  {#if chat.write}<form id={ids.form} class="flex">
      <label for={ids.field}>Nachricht</label>
      <input
        id={ids.field}
        class="wide"
        maxlength={chat.max}
        required
        autocomplete="off"
        value={drafts.get(draft)}
        oninput={(e) => drafts.set(draft, e.currentTarget.value)}
      />
      <button type="submit">Senden</button>
    </form>{/if}
{/snippet}

{#if place === 'window'}{@render body()}{:else}<Box title="Chat"
    >{@render body()}</Box
  >{/if}
