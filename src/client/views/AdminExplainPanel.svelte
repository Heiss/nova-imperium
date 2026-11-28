<script lang="ts">
  // The side panel of the explanations of the admin panel (#358): built
  // like the panel of the Lexicanum (LexicanumPanel.svelte, its classes),
  // but admin-only and no part of the players' Lexicanum. One stands in the
  // view „Admin“ for the tab „Universum“ (`place` u), one inside the dialog
  // „Neue Runde“ (`place` r), so a screen reader reads it as part of the
  // modal dialog (PR #471); each shows what was opened at its place. Esc and
  // „Schließen“ close it and give the focus back to the „?“; Esc closes only
  // the panel, never the dialog under it. Leaving the view or closing the
  // dialog closes the panel.
  import { tick } from 'svelte';
  import {
    EXPLAIN_PANEL_ID,
    explainPage,
    openedAt,
  } from '../logic/admin-explain.ts';
  import { client } from '../logic/state.svelte.ts';
  import { adminExplain, forgetExplain } from './admin-explain-state.svelte.ts';

  let { place }: { place: 'u' | 'r' } = $props();

  const page = $derived(
    client.game && adminExplain.key && openedAt(adminExplain.opener, place)
      ? explainPage(adminExplain.key, client.game)
      : null,
  );
  let panel: HTMLElement | undefined = $state();

  // The focus goes to the panel when it opens from a „?“, not again on each
  // new state of the server, which makes a new page (PR #471).
  let focusedFor: string | null = null;
  $effect(() => {
    const opener = page ? adminExplain.opener : null;
    if (opener && opener !== focusedFor) void tick().then(() => panel?.focus());
    focusedFor = opener;
  });

  // The view or the dialog goes: what was opened in it closes (PR #471).
  $effect(() => () => {
    if (openedAt(adminExplain.opener, place)) forgetExplain();
  });

  function close(): void {
    const opener = adminExplain.opener;
    forgetExplain();
    if (opener) document.getElementById(opener)?.focus();
  }

  // In the capture phase, before the page closes the dialog on Esc
  // (features/frame.ts), so the dialog and what was typed in it stay.
  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && page) {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window onkeydowncapture={onkeydown} />

{#if page}
  <aside
    class="lx-drawer admin-explain"
    id={EXPLAIN_PANEL_ID}
    tabindex="-1"
    aria-labelledby="axp-title"
    bind:this={panel}
  >
    <div class="lx-dhead">
      <div class="lx-crumb">Erklärung › <b>{page.label}</b></div>
      <button type="button" class="small" onclick={close}>Schließen</button>
    </div>
    <div class="lx">
      <h3 class="lx-title" id="axp-title">{page.label}</h3>
      <p>{page.text}</p>
      {#if page.table}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="lx-scroll"
          role="region"
          aria-label={page.label}
          tabindex="0"
        >
          <table class="lx-t">
            <thead>
              <tr>
                {#each page.table.head as cell, i (i)}<th scope="col">{cell}</th
                  >{/each}
              </tr>
            </thead>
            <tbody>
              {#each page.table.rows as row, r (r)}
                <tr>
                  {#each row as cell, i (i)}
                    {#if i === 0}<th scope="row">{cell}</th>{:else}<td class="n"
                        >{cell}</td
                      >{/if}
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </aside>
{/if}
