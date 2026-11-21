<script lang="ts">
  // One open conversation of „Posteingang“ (#226): its messages oldest first,
  // „Melden“ on each received message, „Löschen“ on each message (from the own
  // view only), „Antworten“ unless the other account is deleted, and
  // „Unterhaltung löschen“ and „Blockieren“. Every text from a player is shown
  // as text. The buttons ask features/private-messages.ts through `pmCall`.
  import type { PmLine } from '../../core/private-messages.ts';
  import {
    lineOf,
    PM_LABELS,
    pmAsk,
    pmCall,
    type InboxRow,
    type MessageLine,
  } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';

  let { row }: { row: InboxRow } = $props();

  // Older messages (Q27): the state carries the newest page only; a page the
  // player asked for is kept here, next to the state's lines, for as long as
  // the state's window starts where it did then (else a gap could open, and
  // the page is dropped: the next click loads the messages before the window).
  let older = $state<MessageLine[]>([]);
  let anchor = $state(0);
  let olderMore = $state(false);
  let loading = $state(false);

  const windowStart = $derived(row.lines[0]?.id ?? 0);
  const kept = $derived(older.length > 0 && anchor === windowStart);
  const lines = $derived(kept ? [...older, ...row.lines] : row.lines);
  const more = $derived(kept ? olderMore : row.more);

  async function loadOlder(event: MouseEvent): Promise<void> {
    const first = lines[0];
    if (loading || !first) return;
    loading = true;
    const answer = await pmAsk(event.currentTarget as Element, [
      'olderPrivateMessages',
      { before: first.id },
    ]);
    loading = false;
    if (!answer.ok) return;
    const page = (answer.data.older as PmLine[]).map(lineOf);
    older = [...page, ...(kept ? older : [])];
    anchor = windowStart;
    olderMore = answer.data.more === true;
  }
</script>

<div class="box" id="pm-thread">
  <div class="bd">
    <h3>{row.name}</h3>
    {#if more}
      <p>
        <button
          type="button"
          class="small"
          id="pm-older"
          disabled={loading}
          onclick={loadOlder}>{PM_LABELS.older}</button
        >
      </p>
    {/if}
    <div class="chat-log" role="log" aria-label={row.name}>
      <ol>
        {#each lines as line (line.id)}
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
