<script lang="ts">
  // The fleet movements (#118): the overview shows all, the fleet view the
  // player's own, from fleetRows() of logic/overview.ts. „Rückruf“ carries
  // data-act, which main.ts handles; the clock counts the countdowns down. A
  // planned start of an attack union has „Abbrechen“ instead (#478).
  import type { FleetRow } from '../logic/overview.ts';
  import Due from './Due.svelte';
  import FleetText from './FleetText.svelte';

  let { fleets }: { fleets: FleetRow[] } = $props();
</script>

{#if fleets.length}
  <table>
    <tbody>
      {#each fleets as fleet (fleet.id)}
        <tr>
          <td class="n w110"><Due due={fleet.due} /></td>
          <td class={fleet.cls}><FleetText parts={fleet.parts} /></td>
          <td class="w80"
            >{#if fleet.recall}<button
                class="small"
                data-act="recall"
                data-id={fleet.id}>Rückruf</button
              >{:else if fleet.cancel}<button
                class="small"
                data-act="cancelPlan"
                data-id={fleet.cancel}>Abbrechen</button
              >{/if}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <span class="dim">Keine Flottenbewegungen.</span>
{/if}
