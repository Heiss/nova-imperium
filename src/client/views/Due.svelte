<script lang="ts">
  // A countdown (#118): the time left, which the clock of main.ts counts
  // down, or „gleich …“ when it is due. Used by the overview and the
  // Sternenkarte.
  import type { Countdown } from '../logic/overview.ts';

  let { due }: { due: Countdown } = $props();
</script>

<!-- A new countdown gets a new element (#361): the clock marks one that
  fired (`data-fired`), and a view kept over a render must not carry that mark
  into the next countdown. -->
{#key due.end}{#if due.left}<span class="cd" data-end={due.end}>{due.left}</span
    >{:else}<span class="dim">gleich …</span>{/if}{/key}
