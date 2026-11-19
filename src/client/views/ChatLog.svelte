<script lang="ts">
  // The messages of a guild chat, oldest first, in a log that keeps its place
  // (#169; `keepChatScroll` of dom.ts reads `.chat-log`): the page of a guild
  // and the admin's dialog show it. „Löschen“ is a button with data-act
  // (features/social.ts).
  import type { ChatLogModel } from '../logic/guilds.ts';

  let { log }: { log: ChatLogModel } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chat-log" role="log" aria-label="Chat" tabindex="0">
  {#if log.lines.length}
    <ol>
      {#each log.lines as line (line.id)}
        <li>
          {#if line.event}
            <span class="dim">{line.time}</span><br /><span
              class="chat-text chat-event">{line.text}</span
            >
          {:else}
            {#if line.name === null}<i>ehemaliges Mitglied</i>{:else}<b
                >{line.name}</b
              >{/if}
            <span class="dim">{line.time}</span><br /><span class="chat-text"
              >{line.text}</span
            >
          {/if}
          {#if line.deletable}
            <button
              class="small red"
              data-act="guildChatDelete"
              data-id={line.id}>Löschen</button
            >
          {/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p>Noch keine Nachrichten.</p>
  {/if}
</div>
