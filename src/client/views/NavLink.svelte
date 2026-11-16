<script lang="ts">
  // A link of the navigation (#118, bundle 1): menu, tab bar and „Mehr“.
  // It carries data-act="nav", which main.ts handles; the mark „!“ names
  // what is new there.
  import type { Snippet } from 'svelte';
  import type { NavLink } from '../logic/navigation.ts';

  let { link, children }: { link: NavLink; children: Snippet } = $props();
</script>

<a
  href={link.href}
  data-act="nav"
  data-v={link.view}
  class={link.on ? 'on' : ''}
  aria-current={link.on ? 'page' : undefined}
  >{@render children()}{#if link.hint}<span
      class="badge"
      role="img"
      aria-label={link.hint}
      title={link.hint}>!</span
    >{/if}</a
>
