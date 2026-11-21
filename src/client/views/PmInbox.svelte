<script lang="ts">
  // „Posteingang“ (#226), from privatePage() of logic/private-messages.ts: the
  // conversations as previews (the newest message each, Q32), the open one with
  // „Antworten“, and the settings. The component owns which conversation is
  // open and whether the form „Neue Nachricht“ is shown, so the poll of the
  // state never closes them. A conversation loads its newest page when the
  // player opens it: from the click on its name, or from sending to it, never
  // from a redraw. The buttons ask features/private-messages.ts through
  // `pmCall`.
  import type { PmLine } from '../../core/private-messages.ts';
  import {
    PM_LABELS,
    pmAsk,
    startThread,
    type PrivatePage,
    type Thread,
  } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';
  import PmSettings from './PmSettings.svelte';
  import PmThread from './PmThread.svelte';

  // `lock`: on the lock screen of the vacation mode (owner, 2026-11-21, Q28) a
  // player reads and replies; there is no new message, no recipient list and
  // no settings there.
  let { page, lock = false }: { page: PrivatePage; lock?: boolean } = $props();

  let composing = $state(false);
  let open = $state<string | null>(null);
  /** The open conversation once its action answered; `id` tells one opening from the next. */
  let loaded = $state<{ key: string; id: number; thread: Thread } | null>(null);
  let root = $state<HTMLElement>();
  let opening = 0;

  const current = $derived(page.inbox.find((row) => row.key === open));

  // A conversation that was shown and is gone (the player deleted it) closes,
  // so a message that starts it again loads afresh.
  $effect(() => {
    if (loaded && !current) {
      open = null;
      loaded = null;
    }
  });

  /** Opens the conversation `key` and loads its newest page: the player asked for it by a click. */
  async function openConversation(key: string): Promise<void> {
    if (!root || (open === key && loaded?.key === key)) return;
    const id = ++opening;
    open = key;
    loaded = null;
    const answer = await pmAsk(root, [
      'openPrivateConversation',
      { name: key },
    ]);
    if (id !== opening) return;
    if (!answer.ok) {
      open = null;
      return;
    }
    loaded = {
      key,
      id,
      thread: startThread(
        answer.data.messages as PmLine[],
        answer.data.more === true,
      ),
    };
  }
</script>

<div bind:this={root}>
  {#if !lock}<div class="box">
      <div class="bd">
        <button
          type="button"
          aria-expanded={composing}
          aria-controls="pm-compose"
          onclick={() => (composing = !composing)}>{PM_LABELS.compose}</button
        >
        {#if composing}
          <PmCompose
            names={page.names}
            sent={(to) => {
              composing = false;
              void openConversation(to);
            }}
          />
        {/if}
      </div>
    </div>{/if}
  <div class="box">
    <div class="bd">
      {#if page.inbox.length}
        <ul class="pm-list" aria-label="Unterhaltungen">
          {#each page.inbox as row (row.key)}
            <li>
              <button
                type="button"
                class="small"
                aria-pressed={open === row.key}
                onclick={() => void openConversation(row.key)}
                >{row.name}{#if row.unread}
                  ({row.unread}){/if}</button
              >
              <span class="dim">{row.last}</span>
              <span class="dim pm-preview">{row.preview.text}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="dim">{PM_LABELS.empty}</p>
      {/if}
    </div>
  </div>
  {#if current && loaded && loaded.key === current.key}{#key loaded.id}<PmThread
        row={current}
        initial={loaded.thread}
      />{/key}{/if}
  {#if !lock}<PmSettings
      friendsOnly={page.friendsOnly}
      blocked={page.blocked}
    />{/if}
</div>
