<script lang="ts">
  // The menu (#118, bundle 1; okf/architecture/patterns.md, section 9):
  // from navigation() of logic/navigation.ts.
  import type { Navigation } from '../logic/navigation.ts';
  import NavLink from './NavLink.svelte';

  let { nav }: { nav: Navigation } = $props();
</script>

{#each nav.menu as item, i (i)}{#if item === '-'}<div
      class="sep"
    ></div>{:else}<NavLink link={item}>{item.label}</NavLink>{/if}{/each}
