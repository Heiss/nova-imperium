<script lang="ts">
  // The side panel of the explanations of the admin panel (#358): built
  // like the panel of the Lexicanum (LexicanumPanel.svelte, its classes),
  // but admin-only and no part of the players' Lexicanum. It opens beside
  // the tab „Universum“ and over the dialog „Neue Runde“; Esc and
  // „Schließen“ close it and give the focus back to the „?“.
  import { tick } from 'svelte';
  import { EXPLAIN_PANEL_ID, explainPage } from '../logic/admin-explain.ts';
  import { client } from '../logic/state.svelte.ts';
  import { adminExplain } from './admin-explain-state.svelte.ts';

  const page = $derived(
    client.game && adminExplain.key
      ? explainPage(adminExplain.key, client.game)
      : null,
  );
  let panel: HTMLElement | undefined = $state();

  $effect(() => {
    if (page?.key) void tick().then(() => panel?.focus());
  });

  function close(): void {
    const opener = adminExplain.opener;
    adminExplain.key = null;
    adminExplain.opener = null;
    if (opener) document.getElementById(opener)?.focus();
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && adminExplain.key) {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window {onkeydown} />

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
        <div class="lx-scroll" role="region" aria-label={page.label}>
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
