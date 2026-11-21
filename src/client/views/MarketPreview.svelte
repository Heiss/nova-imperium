<script lang="ts">
  // The preview below the fields of the marketplace (#171; the HTML of
  // previewHTML() of logic/market-page.ts before #337): its lines, and the
  // note under them, dim while the trade goes through, red when it does not.
  import type { Preview } from '../logic/market.ts';

  let { p }: { p: Preview } = $props();
</script>

<table class="kv">
  <tbody>
    {#each p.lines as line, i (i)}<tr
        ><td>{line.label}</td><td>{line.value}</td></tr
      >{/each}
  </tbody>
</table>
{#if p.note}<p class={p.ok ? 'dim' : 'bad'}>{p.note}</p>{/if}
