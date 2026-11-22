<script lang="ts">
  // The mounted „Optionen“ (#355): the page of the view state, which a
  // render that is not fresh sets anew (views/options.ts), for Options.svelte.
  import type { Readable } from 'svelte/store';
  import type { OptionsPage } from '../logic/options.ts';
  import Options from './Options.svelte';

  let { page }: { page: Readable<OptionsPage> } = $props();
</script>

<Options page={$page} />
