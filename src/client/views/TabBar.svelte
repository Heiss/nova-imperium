<script lang="ts">
  // Phone: the tab bar (#61, #118 bundle 1; okf/architecture/patterns.md,
  // section 9), from navigation() of logic/navigation.ts. „Mehr“ carries
  // data-act="moreOpen", which main.ts handles.
  import type { Navigation } from '../logic/navigation.ts';
  import { TAB_GLYPHS } from './index.ts';
  import NavLink from './NavLink.svelte';

  let { nav }: { nav: Navigation } = $props();
</script>

{#each nav.tabs as link (link.view)}<NavLink {link}
    >{@html TAB_GLYPHS[link.view]}<span>{link.label}</span></NavLink
  >{/each}<button
  type="button"
  class={nav.moreOn ? 'on' : ''}
  data-act="moreOpen"
  aria-haspopup="dialog"
  >{@html TAB_GLYPHS.more}<span>Mehr</span>{#if nav.moreHint}<span
      class="dot"
      role="img"
      aria-label="Neues unter Mehr"
    ></span>{/if}</button
>
