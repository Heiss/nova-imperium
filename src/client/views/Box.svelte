<script lang="ts">
  // A box with its title: the frame of most pages (`box()` of common.ts for
  // the HTML views). The body is what the page puts into it.
  import type { Snippet } from 'svelte';

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="box">
  <div class="hd">{title}</div>
  <div class="bd">{@render children()}</div>
</div>
