<script lang="ts">
  // The Sternenkarte (#118, bundle 2; okf/architecture/patterns.md,
  // section 9): from galaxyPage() of logic/galaxy.ts. Its buttons and links
  // carry data-act, which main.ts handles; the clock of main.ts counts the
  // countdowns of the scan down. A place shows the words of its activity
  // after its name, its owner those of the inactivity (#229), before the
  // noob protection. The symbols of a moon and a Trümmerfeld,
  // the button „Bergung“ and the pictures keep their HTML.
  import type {
    GalaxyAction,
    GalaxyPage,
    GalaxyPlace,
  } from '../logic/galaxy.ts';
  import { moonPicture } from '../logic/moon.ts';
  import { planetHTML } from './common.ts';
  import Due from './Due.svelte';

  let { page }: { page: GalaxyPage } = $props();
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
      data-nokeep
      value={page.gal}
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
      data-nokeep
      value={page.sys}
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
            <td>{@render actions(row.planet.actions)}</td>
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
              <td>{@render actions(row.moon.actions)}</td>
            </tr>
          {/if}
        {:else}
          <tr>
            <td class="n">{row.position}</td>
            <td colspan="2"
              ><span class="dim">{row.note}</span>{@render marks(row.marks)}</td
            >
            <td>{@render actions(row.actions)}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
  <div class="bd dim">
    {`Auspex-Erkundung schickt ${page.probes} Spähschädel – einstellbar unter „Hilfe & Optionen“.`}
  </div>
</div>
