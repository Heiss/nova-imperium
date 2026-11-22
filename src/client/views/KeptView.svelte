<script lang="ts" generics="P">
  // A view kept over a render that is not fresh (#352, #361): the page of the
  // view state, which views/kept.ts sets anew on every such render, for the
  // view's component. Its fields stay the same elements, so a selection and
  // the caret survive the poll, the clock and the news.
  import type { Component } from 'svelte';
  import type { Readable } from 'svelte/store';

  let {
    view: View,
    page,
  }: { view: Component<{ page: P }>; page: Readable<P> } = $props();
</script>

<View page={$page} />
