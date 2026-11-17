<script lang="ts">
  // The resource bar (#118, bundle 1; okf/architecture/patterns.md,
  // section 9): from resourceBar() of logic/resource-bar.ts.
  import { resourceIconURL, type ResourceKey } from '../logic/icons.ts';
  import type { ResourceBar } from '../logic/resource-bar.ts';

  let { bar }: { bar: ResourceBar } = $props();
</script>

{#snippet icon(key: ResourceKey)}<img
    class="ri"
    src={resourceIconURL(key)}
    alt=""
    width="28"
    height="28"
  />{/snippet}

{#each bar.cells as cell (cell.icon)}<div class="res" title={cell.title}>
    {@render icon(cell.icon)}
    <div>
      <div class="l">{cell.label}</div>
      <div class="v {cell.full ? 'full' : ''}">{cell.value}</div>
    </div>
  </div>{/each}
<div class="res">
  {@render icon('energy')}
  <div>
    <div class="l">Energie</div>
    <div class="v {bar.energy.short ? 'bad' : ''}">{bar.energy.value}</div>
  </div>
</div>
