<script lang="ts">
  // A table of the panels of the page „Admin“ (#118, after bundle 7), from the
  // tables of logic/admin-panels.ts: the buttons of a cell (the player record,
  // the events of a reference, „Widerrufen“), the details of an event or an
  // error and the form „Mond anlegen“. The marks (`data-diagnostics`,
  // `data-act="revoke"`) are those of the panels and of features/admin.ts.
  import type { TablePage } from '../logic/admin-panels.ts';
  import {
    filterByReference,
    openAdminTab,
    panels,
    setMoon,
  } from '../logic/admin-panels.svelte.ts';

  let { table }: { table: TablePage } = $props();

  function moon(event: SubmitEvent, planet: string): void {
    event.preventDefault();
    const chance = Number(
      new FormData(event.currentTarget as HTMLFormElement).get('chance'),
    );
    void setMoon(planet, chance);
  }
</script>

{#snippet reference(id: string, label: string)}
  <button
    type="button"
    data-diagnostics="reference"
    data-reference={id}
    onclick={() => filterByReference(id)}>{label}</button
  >
{/snippet}

{#if table.rows.length}
  <div class="admin-table">
    <table class="mini">
      <thead>
        <tr>
          {#each table.headers as header (header)}<th scope="col">{header}</th
            >{/each}
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row, r (r)}
          <tr>
            {#each row as cell, c (c)}
              <td>
                {#if typeof cell === 'string'}
                  {cell}
                {:else if cell.kind === 'player'}
                  <button
                    type="button"
                    data-diagnostics="player"
                    data-player={cell.id}
                    onclick={() => openAdminTab('players', cell.id)}
                    >{cell.name}</button
                  >
                {:else if cell.kind === 'reference'}
                  {@render reference(cell.id, cell.id)}
                {:else if cell.kind === 'event'}
                  {@const e = cell.detail}
                  <details
                    open={panels.isOpen(`event:${e.id}`)}
                    ontoggle={(ev) =>
                      panels.setOpen(`event:${e.id}`, ev.currentTarget.open)}
                  >
                    <summary>{e.title} {e.id}</summary>{#if e.request}<div>
                        Vorgang <code>{e.request}</code>
                      </div>{/if}<code>{e.raw}</code>
                    <div class="flex">
                      {#each e.references as id, i (i)}{#if i}{' '}{/if}{@render reference(
                          id,
                          `Ereignisse zu ${id}`,
                        )}{/each}
                    </div>
                  </details>
                {:else if cell.kind === 'error'}
                  {@const e = cell.detail}
                  <details
                    open={panels.isOpen(`error:${e.id}`)}
                    ontoggle={(ev) =>
                      panels.setOpen(`error:${e.id}`, ev.currentTarget.open)}
                  >
                    <summary>Eintrag {e.id}</summary>
                    {#if e.request}<div>
                        Vorgang <code>{e.request}</code>
                      </div>{/if}
                    {#if e.version}<div>Version {e.version}</div>{/if}
                    {#if e.browser}<div>Browser {e.browser}</div>{/if}
                    {#if e.note}<div>Meldung {e.note}</div>{/if}
                    {#if e.detail}<pre>{e.detail}</pre>{/if}
                  </details>
                {:else if cell.kind === 'moon'}
                  <form
                    class="moon-form flex"
                    data-planet={cell.planet}
                    onsubmit={(event) => moon(event, cell.planet)}
                  >
                    <label
                      >Mondchance in %
                      <input
                        name="chance"
                        type="number"
                        min={cell.min}
                        max={cell.max}
                        required
                      /></label
                    ><button type="submit">Mond anlegen</button>
                  </form>
                {:else}
                  <button class="small red" data-act="revoke" data-id={cell.id}
                    >Widerrufen</button
                  >
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="dim">Keine Einträge.</p>
{/if}
