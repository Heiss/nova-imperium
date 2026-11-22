<script lang="ts">
  // The mounted Sternenkarte (#352): the page of the view state, which a
  // render that is not fresh sets anew (views/galaxy.ts), for Galaxy.svelte.
  import type { Readable } from 'svelte/store';
  import type { GalaxyPage } from '../logic/galaxy.ts';
  import Galaxy from './Galaxy.svelte';

  let { page }: { page: Readable<GalaxyPage> } = $props();
</script>

<Galaxy page={$page} />
