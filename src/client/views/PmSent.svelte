<script lang="ts">
  // „Gesendet“ (#226): the messages the player sent, newest first; „Löschen“
  // deletes one from the own view only (the recipient keeps it). The text is
  // shown as text. The list loads when the player opens the tab (`reload`,
  // called by the tab's click or key, Q33), and „Ältere Nachrichten laden“
  // adds the next page; a redraw of the page never asks for it.
  import type { SentLine } from '../../core/private-messages.ts';
  import {
    PM_LABELS,
    pmAsk,
    pmCall,
    sentWithOlder,
    sentWithout,
    startSent,
    type SentList,
  } from '../logic/private-messages.ts';

  // `initial`: a list that is there already; none until the tab is opened.
  let { initial = null }: { initial?: SentList | null } = $props();

  // svelte-ignore state_referenced_locally
  let list = $state<SentList | null>(initial);
  let loading = $state(false);
  let root = $state<HTMLElement>();

  /** Loads the newest page of the sent messages: the player opened the tab. */
  export async function reload(): Promise<void> {
    if (loading || !root) return;
    loading = true;
    const answer = await pmAsk(root, ['sentPrivateMessages', {}]);
    loading = false;
    if (answer.ok)
      list = startSent(
        answer.data.sent as SentLine[],
        answer.data.more === true,
      );
  }

  async function loadOlder(): Promise<void> {
    const last = list?.rows.at(-1);
    if (loading || !root || !last) return;
    loading = true;
    const answer = await pmAsk(root, [
      'sentPrivateMessages',
      { before: last.id },
    ]);
    loading = false;
    if (answer.ok && list)
      list = sentWithOlder(
        list,
        answer.data.sent as SentLine[],
        answer.data.more === true,
      );
  }

  async function remove(target: Element, id: number): Promise<void> {
    if ((await pmCall(target, ['deletePrivateMessage', { id }])) && list)
      list = sentWithout(list, id);
  }
</script>

<div class="box" bind:this={root}>
  <div class="bd">
    {#if list}
      {#each list.rows as row (row.id)}
        <p>
          <b>{row.to}</b> <span class="dim">{row.time}</span><br /><span
            class="chat-text">{row.text}</span
          >
          <button
            type="button"
            class="small red"
            onclick={(e) => void remove(e.currentTarget, row.id)}
            >{PM_LABELS.remove}</button
          >
        </p>
      {:else}
        <p class="dim">{PM_LABELS.noSent}</p>
      {/each}
      {#if list.more}
        <p>
          <button
            type="button"
            class="small"
            id="pm-sent-older"
            disabled={loading}
            onclick={loadOlder}>{PM_LABELS.older}</button
          >
        </p>
      {/if}
    {/if}
  </div>
</div>
