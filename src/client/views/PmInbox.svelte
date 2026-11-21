<script lang="ts">
  // „Posteingang“ (#226), from privatePage() of logic/private-messages.ts: the
  // conversations, the open one with „Antworten“, and the settings. The
  // component owns which conversation is open and whether the form „Neue
  // Nachricht“ is shown, so the poll of the state never closes them. The
  // buttons ask features/private-messages.ts through `pmCall`; opening a
  // conversation with new messages marks them read after a moment, as
  // „Nachrichten“ marks the reports (a refusal of that is no message).
  import {
    PM_LABELS,
    pmCall,
    type InboxRow,
    type PrivatePage,
  } from '../logic/private-messages.ts';
  import PmCompose from './PmCompose.svelte';
  import PmSettings from './PmSettings.svelte';
  import PmThread from './PmThread.svelte';

  // `lock`: on the lock screen of the vacation mode (owner, 2026-11-21, Q28) a
  // player reads and replies; there is no new message, no recipient list and
  // no settings there.
  let { page, lock = false }: { page: PrivatePage; lock?: boolean } = $props();

  const READ_DELAY_MS = 600;

  let composing = $state(false);
  let open = $state<string | null>(null);
  let root = $state<HTMLElement>();

  const current = $derived<InboxRow | undefined>(
    page.inbox.find((row) => row.key === open),
  );
  const unread = $derived(current?.unread ?? 0);

  $effect(() => {
    if (!unread || !root || open === null) return;
    const key = open;
    const timer = setTimeout(
      () => void pmCall(root!, ['readPrivateMessages', { name: key }], true),
      READ_DELAY_MS,
    );
    return () => clearTimeout(timer);
  });
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
              open = to;
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
                onclick={() => (open = row.key)}
                >{row.name}{#if row.unread}
                  ({row.unread}){/if}</button
              >
              <span class="dim">{row.last}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="dim">{PM_LABELS.empty}</p>
      {/if}
    </div>
  </div>
  {#if current}{#key current.key}<PmThread row={current} />{/key}{/if}
  {#if !lock}<PmSettings
      friendsOnly={page.friendsOnly}
      blocked={page.blocked}
    />{/if}
</div>
