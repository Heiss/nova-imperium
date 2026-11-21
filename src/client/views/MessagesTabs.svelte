<script lang="ts">
  // „Nachrichten“ with its tabs (#226; owner, 2026-11-21): „Berichte“ (the
  // list of reports of Messages.svelte, unchanged), „Posteingang“ and
  // „Gesendet“. One menu entry and one mark for all of them. The view is
  // mounted once and follows the state (`viewState`), so the open tab, the
  // open conversation and what is typed stay over the poll of the state.
  import type { Readable } from 'svelte/store';
  import { messagesPage } from '../logic/messages.ts';
  import {
    MESSAGE_TABS,
    privatePage,
    type MessageTab,
  } from '../logic/private-messages.ts';
  import type { V } from './common.ts';
  import Messages from './Messages.svelte';
  import PmInbox from './PmInbox.svelte';
  import PmSent from './PmSent.svelte';

  // `lock`: the lock screen of the vacation mode (owner, 2026-11-21, Q28)
  // shows „Posteingang“ and „Gesendet“ only; the reports are no part of it,
  // and its state holds none.
  let {
    viewState,
    lock = false,
  }: { viewState: Readable<Pick<V, 's'>>; lock?: boolean } = $props();

  // Outside the lock screen the state is the whole view state.
  const reports = $derived(lock ? null : messagesPage($viewState as V));
  const mail = $derived(privatePage($viewState));

  // `lock` is fixed for the life of the view: it is set when the view is mounted.
  // svelte-ignore state_referenced_locally
  const tabs = (Object.keys(MESSAGE_TABS) as MessageTab[]).filter(
    (key) => !lock || key !== 'reports',
  );
  // svelte-ignore state_referenced_locally
  let tab = $state<MessageTab>(lock ? 'inbox' : 'reports');

  /** The arrow keys, Home and End move between the tabs (the pattern of a tab list). */
  function move(event: KeyboardEvent): void {
    const moves: Record<string, number> = {
      ArrowLeft: tabs.indexOf(tab) - 1,
      ArrowRight: tabs.indexOf(tab) + 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(moves, event.key)) return;
    event.preventDefault();
    tab = tabs[(moves[event.key]! + tabs.length) % tabs.length]!;
    document.getElementById(`messages-tab-${tab}`)?.focus();
  }
</script>

<h2>Nachrichten</h2>
<div role="tablist" aria-label="Nachrichten" class="flex pm-tabs">
  {#each tabs as key (key)}
    <button
      id="messages-tab-{key}"
      type="button"
      role="tab"
      aria-selected={tab === key}
      aria-controls="messages-panel-{key}"
      tabindex={tab === key ? 0 : -1}
      onclick={() => (tab = key)}
      onkeydown={move}
      >{MESSAGE_TABS[key]}{#if key === 'inbox' && mail.unread}
        ({mail.unread}){/if}</button
    >
  {/each}
</div>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
{#if reports}<section
    id="messages-panel-reports"
    role="tabpanel"
    aria-labelledby="messages-tab-reports"
    hidden={tab !== 'reports'}
  >
    <Messages page={reports} heading={false} />
  </section>{/if}
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="messages-panel-inbox"
  role="tabpanel"
  aria-labelledby="messages-tab-inbox"
  hidden={tab !== 'inbox'}
>
  <PmInbox page={mail} {lock} />
</section>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="messages-panel-sent"
  role="tabpanel"
  aria-labelledby="messages-tab-sent"
  hidden={tab !== 'sent'}
>
  <PmSent rows={mail.sent} />
</section>
