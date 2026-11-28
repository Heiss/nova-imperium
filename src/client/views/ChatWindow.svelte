<script lang="ts">
  // The chat window at the bottom right (#496, owner, 2026-11-28), from
  // chatWindowPage() of logic/chat-window.ts: closed, a button „Chat“ with the
  // unread entries; open, the tabs „Gilde“ (GuildChat.svelte at the place
  // `window`) and „Persönlich“ (PmInbox.svelte as on the lock screen: the
  // conversations and the open one with „Antworten“). Mounted once
  // (views/chat-window.ts), so the open conversation and what is typed stay
  // over the poll. Open or closed and the tab are kept per player in this
  // browser. On a phone nothing at all (3): no window, no button.
  import { onMount } from 'svelte';
  import type { Readable } from 'svelte/store';
  import { showGuildChat } from '../logic/chat-shown.ts';
  import {
    CHAT_WINDOW_LABELS,
    readPrefs,
    shownTab,
    writePrefs,
    type ChatWindowPage,
    type ChatWindowTab,
  } from '../logic/chat-window.ts';
  import GuildChat from './GuildChat.svelte';
  import PmInbox from './PmInbox.svelte';

  let {
    viewState,
  }: { viewState: Readable<{ page: ChatWindowPage; uid: string }> } = $props();

  const PHONE = '(max-width: 760px)';
  const store = (): Storage => window.localStorage;

  // The window is mounted anew for another player (views/chat-window.ts).
  // svelte-ignore state_referenced_locally
  let prefs = $state(readPrefs($viewState.uid, store));
  let phone = $state(window.matchMedia(PHONE).matches);
  const page = $derived($viewState.page);
  const tab = $derived(shownTab(page, prefs.tab));

  onMount(() => {
    const media = window.matchMedia(PHONE);
    const follow = (): void => void (phone = media.matches);
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  });

  // The chat in sight is a visit of it (#496).
  $effect(() => {
    showGuildChat('window', !phone && prefs.open && tab === 'guild');
    return () => showGuildChat('window', false);
  });

  function keep(next: Partial<typeof prefs>): void {
    prefs = { ...prefs, ...next };
    writePrefs($viewState.uid, prefs, store);
  }

  /** The arrow keys, Home and End move between the tabs (the pattern of a tab list). */
  function move(event: KeyboardEvent): void {
    const keys = page.tabs.map((t) => t.key);
    const at = keys.indexOf(tab);
    const moves: Record<string, number> = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: keys.length - 1,
    };
    if (!Object.hasOwn(moves, event.key)) return;
    event.preventDefault();
    const next: ChatWindowTab =
      keys[(moves[event.key]! + keys.length) % keys.length]!;
    keep({ tab: next });
    document.getElementById(`chatwin-tab-${next}`)?.focus();
  }
</script>

{#if !phone}
  {#if prefs.open}
    <section class="chatwin" aria-labelledby="chatwin-title">
      <div class="chatwin-hd">
        <h2 id="chatwin-title">{CHAT_WINDOW_LABELS.title}</h2>
        <button
          type="button"
          class="small"
          aria-expanded="true"
          onclick={() => keep({ open: false })}
          >{CHAT_WINDOW_LABELS.close}</button
        >
      </div>
      <div
        role="tablist"
        aria-label={CHAT_WINDOW_LABELS.title}
        class="flex pm-tabs"
      >
        {#each page.tabs as t (t.key)}
          <button
            id="chatwin-tab-{t.key}"
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls="chatwin-panel-{t.key}"
            tabindex={tab === t.key ? 0 : -1}
            onclick={() => keep({ tab: t.key })}
            onkeydown={move}>{t.label}</button
          >
        {/each}
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      {#if page.guild}<section
          id="chatwin-panel-guild"
          class="chatwin-bd"
          role="tabpanel"
          aria-labelledby="chatwin-tab-guild"
          hidden={tab !== 'guild'}
        >
          <GuildChat chat={page.guild} place="window" />
        </section>{/if}
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <section
        id="chatwin-panel-private"
        class="chatwin-bd"
        role="tabpanel"
        aria-labelledby="chatwin-tab-private"
        hidden={tab !== 'private'}
      >
        <PmInbox page={page.mail} lock />
      </section>
    </section>
  {:else}
    <button
      type="button"
      class="chatwin-open"
      aria-expanded="false"
      onclick={() => keep({ open: true })}>{page.button}</button
    >
  {/if}
{/if}
