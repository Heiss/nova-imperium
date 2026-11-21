<script lang="ts">
  // One open conversation of „Posteingang“ (#226): its messages oldest first,
  // „Melden“ on each received message, „Löschen“ on each message (from the own
  // view only), „Antworten“ unless the other account is deleted, and
  // „Unterhaltung löschen“ and „Blockieren“. Every text from a player is shown
  // as text. The buttons ask features/private-messages.ts through `pmCall`.
  //
  // The thread starts with the page the action loaded when the player opened
  // the conversation (`initial`, Q32). Older pages come only from the button,
  // newer messages with the state (`row.newer`): the component names its open
  // conversation and the newest message it holds to the poll
  // (`watchConversation`) and adds what comes. Nothing here sends a request
  // by itself but the mark „gelesen“ and the buttons.
  import { untrack } from 'svelte';
  import type { PmLine } from '../../core/private-messages.ts';
  import {
    newestId,
    PM_LABELS,
    pmAsk,
    pmCall,
    watchConversation,
    withNewer,
    withOlder,
    withoutLine,
    withRead,
    type InboxRow,
    type Thread,
  } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';

  const READ_DELAY_MS = 600;

  let { row, initial }: { row: InboxRow; initial: Thread } = $props();

  // The page the action loaded; the component keeps it from then on.
  // svelte-ignore state_referenced_locally
  let thread = $state<Thread>(initial);
  let loading = $state(false);
  let root = $state<HTMLElement>();

  const lines = $derived(thread.lines);
  const more = $derived(thread.more);

  // The messages the state brings for this conversation join the thread.
  $effect(() => {
    const add = row.newer;
    untrack(() => (thread = withNewer(thread, add)));
  });

  // The poll and the actions name the open conversation and its newest message.
  $effect(() => {
    watchConversation({ name: row.key, after: newestId(thread) });
    return () => watchConversation(null);
  });

  // Opening a conversation with new messages marks them read after a moment,
  // as „Nachrichten“ marks the reports (a refusal of that is no message).
  $effect(() => {
    if (!row.unread || !root) return;
    const key = row.key;
    const target = root;
    const timer = setTimeout(
      () =>
        void pmCall(target, ['readPrivateMessages', { name: key }], true).then(
          (ok) => {
            if (ok) thread = withRead(thread);
          },
        ),
      READ_DELAY_MS,
    );
    return () => clearTimeout(timer);
  });

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
    thread = withOlder(
      thread,
      answer.data.older as PmLine[],
      answer.data.more === true,
    );
  }

  async function remove(target: Element, id: number): Promise<void> {
    if (await pmCall(target, ['deletePrivateMessage', { id }]))
      thread = withoutLine(thread, id);
  }
</script>

<div class="box" id="pm-thread" bind:this={root}>
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
              onclick={(e) => void remove(e.currentTarget, line.id)}
              >{PM_LABELS.remove}</button
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
