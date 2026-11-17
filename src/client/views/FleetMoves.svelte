<script lang="ts">
  // The fleet movements (#118): the overview shows all, the fleet view the
  // player's own, from fleetRows() of logic/overview.ts. „Rückruf“ carries
  // data-act, which main.ts handles; the clock counts the countdowns down.
  import type { FleetRow } from '../logic/overview.ts';
  import Due from './Due.svelte';

  let { fleets }: { fleets: FleetRow[] } = $props();
</script>

{#if fleets.length}
  <table>
    <tbody>
      {#each fleets as fleet (fleet.id)}
        <tr>
          <td class="n w110"><Due due={fleet.due} /></td>
          <td class={fleet.cls}
            >{#each fleet.parts as part, i (i)}{#if part.bold}<b>{part.text}</b
                >{:else}{part.text}{/if}{/each}</td
          >
          <td class="w80"
            >{#if fleet.recall}<button
                class="small"
                data-act="recall"
                data-id={fleet.id}>Rückruf</button
              >{/if}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <span class="dim">Keine Flottenbewegungen.</span>
{/if}
