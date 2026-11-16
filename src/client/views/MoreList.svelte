<script lang="ts">
  // Phone: the list of the sheet „Mehr“ (#61, #118 bundle 1;
  // okf/architecture/patterns.md, section 9), from navigation() of
  // logic/navigation.ts.
  import type { Navigation } from '../logic/navigation.ts';
  import { TAB_GLYPHS } from './index.ts';
  import NavLink from './NavLink.svelte';

  let { nav }: { nav: Navigation } = $props();
</script>

{#each nav.more as link (link.view)}<NavLink {link}
    ><span>{link.label}</span>{@html TAB_GLYPHS.chevron}</NavLink
  >{/each}
