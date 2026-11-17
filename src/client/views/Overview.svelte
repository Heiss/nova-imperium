<script lang="ts">
  // The overview (#118, okf/architecture/patterns.md, section 9): the fleet
  // movements, the shown planet or moon and its activities, from
  // overviewPage() of logic/overview.ts. It shows the view state of the
  // client state module; its buttons carry data-act, which main.ts sends
  // through act(). The clock of main.ts counts its countdowns down.
  import { moonPicture } from '../logic/moon.ts';
  import { overviewPage } from '../logic/overview.ts';
  import { client } from '../logic/state.svelte.ts';
  import { planetHTML } from './common.ts';
  import Due from './Due.svelte';
  import FleetMoves from './FleetMoves.svelte';

  const v = $derived(client.shown);
  const page = $derived(v && overviewPage(v));
</script>

{#if v && page}
  <h2>{page.title}</h2>
  <div class="box">
    <div class="hd">Flottenbewegungen</div>
    <div class="bd"><FleetMoves fleets={page.fleets} /></div>
  </div>
  <div class="box">
    <div class="bd ov">
      {#if page.moon}<span class="moon-big"
          >{@html moonPicture(page.name, 120)}</span
        >{:else}{@html planetHTML(v.P)}{/if}
      <table class="kv kv-grow">
        <tbody>
          <tr>
            <td>{page.label}</td>
            <td
              >{page.name}
              <span class="lnk" data-act="rename">(umbenennen)</span></td
            >
          </tr>
          <tr><td>Position</td><td>{page.position}</td></tr>
          <tr><td>Planetentyp</td><td>{page.type}</td></tr>
          <tr><td>Temperatur</td><td>{page.temperature}</td></tr>
          <tr><td>Durchmesser</td><td>{page.diameter}</td></tr>
          <tr><td>Punkte</td><td>{page.points}</td></tr>
          <tr><td>Serverzeit</td><td>{page.time}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="box">
    <div class="hd">Aktivitäten</div>
    <div class="bd">
      {#if page.activities.length}
        <table>
          <tbody>
            {#each page.activities as row (row.label)}
              <tr>
                <td>{row.label}</td>
                <td>{row.what}</td>
                <td class="n"
                  ><Due due={row.due} />{#if row.next}{' '}(nächste){/if}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <span class="dim">Nichts in Arbeit – deine Minen langweilen sich.</span>
      {/if}
    </div>
  </div>
{/if}
