<script lang="ts">
  // The frame of a box (`box()` of views/common.ts as a component): a heading
  // and a body. A box of „Optionen“ names its section (`data-sec`), which the
  // phone view of that page shows or hides (#189).
  import type { Snippet } from 'svelte';
  import type { OptionsSection } from '../logic/phone-options.ts';

  let {
    title,
    section,
    children,
  }: { title: string; section?: OptionsSection; children: Snippet } = $props();
</script>

<div class="box" data-sec={section}>
  <div class="hd">{title}</div>
  <div class="bd">{@render children()}</div>
</div>
