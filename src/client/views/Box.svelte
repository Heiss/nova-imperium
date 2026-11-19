<script lang="ts">
  // The frame of a box (`box()` of views/common.ts as a component): a heading
  // and a body.
  import type { Snippet } from 'svelte';

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="box">
  <div class="hd">{title}</div>
  <div class="bd">{@render children()}</div>
</div>
