<script lang="ts">
  // The level overview of an entry in a list (#187): the table of
  // overview() of logic/level-overview.ts with the difference to today. It
  // loads on demand from CatalogList.svelte, only when a table is shown.
  import { overview } from '../logic/level-overview.ts';
  import type { V } from './common.ts';
  import LevelTable from './LevelTable.svelte';

  let { v, key }: { v: V; key: string } = $props();

  const table = $derived(overview(v, key));
</script>

{#if table}
  <LevelTable {table} P={v.P} overview />
{/if}
