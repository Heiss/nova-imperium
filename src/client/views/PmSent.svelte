<script lang="ts">
  // „Gesendet“ (#226), from privatePage() of logic/private-messages.ts: the
  // messages the player sent, newest first; „Löschen“ deletes one from the
  // own view only (the recipient keeps it). The text is shown as text.
  import {
    PM_LABELS,
    pmCall,
    type SentRow,
  } from '../logic/private-messages.ts';

  let { rows }: { rows: SentRow[] } = $props();
</script>

<div class="box">
  <div class="bd">
    {#each rows as row (row.id)}
      <p>
        <b>{row.to}</b> <span class="dim">{row.time}</span><br /><span
          class="chat-text">{row.text}</span
        >
        <button
          type="button"
          class="small red"
          onclick={(e) =>
            pmCall(e.currentTarget, ['deletePrivateMessage', { id: row.id }])}
          >{PM_LABELS.remove}</button
        >
      </p>
    {:else}
      <p class="dim">{PM_LABELS.noSent}</p>
    {/each}
  </div>
</div>
