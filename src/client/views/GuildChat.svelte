<script lang="ts">
  // The chat of the own guild (#169): the messages with „Chat lesen“, the text
  // field with „Chat schreiben“. The form is sent by features/social.ts, which
  // keeps the draft until the message went through.
  import type { ChatBoxModel } from '../logic/guilds.ts';
  import Box from './Box.svelte';
  import ChatLog from './ChatLog.svelte';

  let { chat }: { chat: ChatBoxModel } = $props();
</script>

<Box title="Chat">
  <p class="dim">Die Spielleitung kann diesen Chat lesen.</p>
  {#if chat.log}<ChatLog log={chat.log} />{/if}
  {#if chat.write}<form id="guildchatform" class="flex">
      <label for="chat_text">Nachricht</label>
      <input
        id="chat_text"
        class="wide"
        maxlength={chat.max}
        required
        autocomplete="off"
      />
      <button type="submit">Senden</button>
    </form>{/if}
</Box>
