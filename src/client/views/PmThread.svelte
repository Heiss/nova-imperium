<script lang="ts">
  // One open conversation of „Posteingang“ (#226): its messages oldest first,
  // „Melden“ on each received message, „Löschen“ on each message (from the own
  // view only), „Antworten“ unless the other account is deleted, and
  // „Unterhaltung löschen“ and „Blockieren“. Every text from a player is shown
  // as text. The buttons ask features/private-messages.ts through `pmCall`.
  import {
    PM_LABELS,
    pmCall,
    type InboxRow,
  } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';

  let { row }: { row: InboxRow } = $props();
</script>

<div class="box" id="pm-thread">
  <div class="bd">
    <h3>{row.name}</h3>
    <div class="chat-log" role="log" aria-label={row.name}>
      <ol>
        {#each row.lines as line (line.id)}
          <li>
            {#if line.mine}<b>Ich</b>{:else if row.deleted}<i>{row.name}</i
              >{:else}<b>{row.name}</b>{/if}
            <span class="dim">{line.time}</span>{#if line.fresh}
              <span class="good">neu</span>{/if}<br /><span class="chat-text"
              >{line.text}</span
            >
            {#if !line.mine}
              <button
                type="button"
                class="small"
                onclick={(e) =>
                  pmCall(e.currentTarget, [
                    'reportPrivateMessage',
                    { id: line.id },
                  ])}>{PM_LABELS.report}</button
              >
            {/if}
            <button
              type="button"
              class="small red"
              onclick={(e) =>
                pmCall(e.currentTarget, [
                  'deletePrivateMessage',
                  { id: line.id },
                ])}>{PM_LABELS.remove}</button
            >
          </li>
        {/each}
      </ol>
    </div>
    {#if !row.deleted}<PmCompose to={row.key} />{/if}
    <p>
      <button
        type="button"
        class="small red"
        onclick={(e) =>
          pmCall(e.currentTarget, [
            'deletePrivateConversation',
            { name: row.key },
          ])}>{PM_LABELS.removeConversation}</button
      >
      {#if !row.deleted}
        <button
          type="button"
          class="small"
          onclick={(e) =>
            pmCall(e.currentTarget, ['blockPlayer', { name: row.key }])}
          >{PM_LABELS.block}</button
        >
      {/if}
    </p>
  </div>
</div>
