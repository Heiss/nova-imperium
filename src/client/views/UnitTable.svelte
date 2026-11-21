<script lang="ts">
  // The units of a side of a battle, before and after, with the loss of each
  // (#330); no row: „keine Einheiten“.
  import type { UnitRow } from '../logic/report-body.ts';

  let { rows }: { rows: UnitRow[] } = $props();
</script>

{#if rows.length}
  <table class="mini">
    <tbody>
      <tr
        ><th>Einheit</th><th class="n">vorher</th><th class="n">nachher</th><th
          class="n">Verlust</th
        ></tr
      >
      {#each rows as row, i (i)}
        <tr
          ><td>{row.name}</td><td class="n">{row.before}</td><td class="n"
            >{row.after}</td
          ><td class="n {row.bad ? 'bad' : ''}">{row.lost}</td></tr
        >
      {/each}
    </tbody>
  </table>
{:else}
  <span class="dim">keine Einheiten</span>
{/if}
