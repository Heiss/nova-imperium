<script lang="ts">
  // The Sternenkarte (#118, bundle 2; okf/architecture/patterns.md,
  // section 9): from galaxyPage() of logic/galaxy.ts. Its buttons and links
  // carry data-act, which main.ts handles; the clock of main.ts counts the
  // countdowns of the scan down. A place shows the words of its activity
  // after its name, its owner those of the inactivity (#229), before the
  // noob protection. The symbols of a moon and a Trümmerfeld,
  // the button „Bergung“ and the pictures keep their HTML. On a phone (#189)
  // the actions of a position are behind a „⋯“, which opens them in a bottom
  // sheet (a modal <dialog>, like „Mehr“); the actions stay in the row, which
  // the CSS hides there, so the desktop is as before.
  import type {
    GalaxyAction,
    GalaxyPage,
    GalaxyPlace,
    GalaxySheet,
  } from '../logic/galaxy.ts';
  import { galaxyPosition, shown } from '../logic/galaxy-position.svelte.ts';
  import { moonPicture } from '../logic/moon.ts';
  import { client } from '../logic/state.svelte.ts';
  import { planetHTML } from './common.ts';
  import Due from './Due.svelte';

  let { page }: { page: GalaxyPage } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  // The sheet is for a phone: where the page is wide, it stays closed.
  $effect(() => {
    if (dialog && !dialog.open && matchMedia('(max-width: 760px)').matches)
      dialog.showModal();
  });

  const opener = (id: string): HTMLElement | null =>
    document.getElementById(`gsheet-${id}`);

  // Whether the sheet was closed by a tap on one of its actions: that action
  // goes on (a form, a toast), so the focus is not taken back to the „⋯“.
  let acted = false;

  /** A tap on an action closes the sheet and leaves the click to main.ts; the backdrop and „Schließen“ close it, and the focus goes back to the „⋯“. */
  function tap(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    const act = !!el.closest('[data-act]');
    if (!act && el !== dialog && !el.closest('.sheet-close')) return;
    acted = act;
    client.ui.gsheet = null;
    dialog?.close();
  }
</script>

{#snippet actions(
  list: GalaxyAction[],
)}{#each list as a, i (i)}{#if i}{' · '}{/if}{#if a.kind === 'active'}<span
        class="dim">{a.label}</span
      >{:else if a.kind === 'html'}{@html a.html}{:else if a.kind === 'link'}<span
        class="lnk"
        {...a.attrs}>{a.label}</span
      >{:else}<button class="small" {...a.attrs}>{a.label}</button
      >{/if}{/each}{/snippet}

{#snippet cell(list: GalaxyAction[], sheet: GalaxySheet | null)}<td
    class={sheet ? 'has-sheet' : ''}
    >{#if list.length}<span class="gal-acts">{@render actions(list)}</span
      >{/if}{#if sheet}<button
        type="button"
        class="small more phone-only"
        id="gsheet-{sheet.id}"
        data-act="gsheet"
        data-id={sheet.id}
        aria-haspopup="dialog"
        aria-label="Aktionen für {sheet.title}">⋯</button
      >{/if}</td
  >{/snippet}

{#snippet marks(
  list: string[],
)}{#each list as mark, i (i)}{' '}{@html mark}{/each}{/snippet}

{#snippet activity(pl: GalaxyPlace)}{#if pl.activity}{' '}<span class="dim"
      >({pl.activity})</span
    >{/if}{/snippet}

{#snippet owner(pl: GalaxyPlace)}<td
    >{pl.owner}
    <span class="dim">(Platz {pl.rank})</span>{#if pl.inactivity}{' '}<span
        class="dim">({pl.inactivity})</span
      >{/if}{#if pl.protected}{' '}<span class="good" title="Noobschutz"
        >(n)</span
      >{/if}{#if pl.vacation}{' '}<span class="dim" title="Urlaubsmodus"
        >(u)</span
      >{/if}</td
  >{/snippet}

<h2>Sternenkarte</h2>
<div class="box">
  <div class="bd flex">
    Galaxie <button
      class="small"
      data-act="gnav"
      data-d="g-"
      aria-label="vorige Galaxie">◀</button
    ><input
      class="c3"
      type="number"
      id="g_g"
      bind:value={
        () => shown(galaxyPosition.gal, page.gal),
        (typed) => (galaxyPosition.gal = String(typed ?? ''))
      }
      min="1"
      max={page.galaxies}
      aria-label="Galaxie"
    /><button
      class="small"
      data-act="gnav"
      data-d="g+"
      aria-label="nächste Galaxie">▶</button
    >
    System
    <button
      class="small"
      data-act="gnav"
      data-d="s-"
      aria-label="voriges System">◀</button
    ><input
      class="c3"
      type="number"
      id="g_s"
      bind:value={
        () => shown(galaxyPosition.sys, page.sys),
        (typed) => (galaxyPosition.sys = String(typed ?? ''))
      }
      min="1"
      max={page.systems}
      aria-label="System"
    /><button
      class="small"
      data-act="gnav"
      data-d="s+"
      aria-label="nächstes System">▶</button
    >
    <button data-act="ggo">Anzeigen</button>
    <span class="lnk" data-act="ghome">zum Heimatsystem</span>
  </div>
  {#if page.scan}<section
      class="bd scan-panel"
      id="scan"
      aria-labelledby="scan-h"
    >
      <h3 id="scan-h" tabindex="-1">{page.scan.title}</h3>
      {#if page.scan.flights.length}
        <table class="scan">
          <tbody>
            <tr
              ><th>Schiffe</th><th>Herkunft</th><th>Ziel</th><th>Ankunft</th
              ></tr
            >
            {#each page.scan.flights as flight, i (i)}
              <tr>
                <td>{flight.ships}</td>
                <td>{flight.from}</td>
                <td>{flight.to}</td>
                <td><Due due={flight.due} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="dim">Keine Flüge erfasst.</p>
      {/if}<button class="small" data-act="gscanClose">Schließen</button>
    </section>{/if}
  <table class="gal">
    <tbody>
      <tr
        ><th class="n">Pos</th><th>Planet</th><th>Spieler</th><th>Aktionen</th
        ></tr
      >
      {#each page.rows as row (row.position)}
        {#if row.planet}
          <tr class={row.planet.mine ? 'me' : ''}>
            <td class="n">{row.position}</td>
            <td
              ><span class="gal-pl"
                >{@html planetHTML(row.planet, true)}{row.planet
                  .name}{@render activity(row.planet)}{@render marks(
                  row.marks,
                )}</span
              ></td
            >
            {@render owner(row.planet)}
            {@render cell(row.planet.actions, row.planet.sheet)}
          </tr>
          {#if row.moon}
            <tr class="moon-row {row.moon.mine ? 'me' : ''}">
              <td class="n"></td>
              <td
                ><span class="gal-pl"
                  >{@html moonPicture(row.moon.name, 28)}{row.moon
                    .name}{@render activity(row.moon)}</span
                ></td
              >
              {@render owner(row.moon)}
              {@render cell(row.moon.actions, row.moon.sheet)}
            </tr>
          {/if}
        {:else}
          <tr>
            <td class="n">{row.position}</td>
            <td colspan="2"
              ><span class="dim">{row.note}</span>{@render marks(row.marks)}</td
            >
            {@render cell(row.actions, row.sheet)}
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
  <div class="bd dim">
    {`Auspex-Erkundung schickt ${page.probes} Spähschädel – einstellbar unter „Optionen“.`}
  </div>
</div>

{#if page.sheet}
  {@const sheet = page.sheet}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <dialog
    bind:this={dialog}
    class="sheet gal-sheet"
    aria-labelledby="gsheet-title"
    onclick={tap}
    onclose={() => {
      client.ui.gsheet = null;
      if (!acted) opener(sheet.id)?.focus();
    }}
  >
    <div class="sheet-handle" aria-hidden="true"></div>
    <p id="gsheet-title" class="sheet-title">{sheet.title}</p>
    {#if sheet.flight}<p class="dim sheet-note">{sheet.flight}</p>{/if}
    <div class="sheet-actions">
      {#each sheet.actions as a, i (i)}
        {#if a.kind === 'html'}{@html a.html}{:else if a.kind === 'link' || a.kind === 'button'}<button
            type="button"
            {...a.attrs}>{a.label}</button
          >{/if}
      {/each}
    </div>
    <button type="button" class="sheet-close">Schließen</button>
  </dialog>
{/if}
