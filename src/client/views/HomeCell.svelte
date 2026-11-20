<script lang="ts">
  // A planet with the link to its system on the Sternenkarte, or „-“ (the
  // Highscore, the buddy list of #227); `homeCell()` of views/common.ts as a
  // component, from homeLink() of logic/friends.ts.
  import type { HomeLink } from '../logic/friends.ts';

  let { home }: { home: HomeLink | null } = $props();
</script>

{#if home}<span class="home">{home.name}</span>
  <span class="lnk" data-act="gto" data-g={home.g} data-s={home.s}
    >{home.at}</span
  >{:else}-{/if}
