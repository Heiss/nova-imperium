<script lang="ts">
  // Phone: the bell of the header with the unread messages (#189, D1; the
  // tab bar no longer has „Nachrichten“), from navigation() of
  // logic/navigation.ts. It carries data-act="nav", which main.ts handles.
  import type { Navigation } from '../logic/navigation.ts';
  import { TAB_GLYPHS } from './index.ts';

  let { nav }: { nav: Navigation } = $props();
  const bell = $derived(nav.bell);
  const label = $derived(
    bell.unread ? `Nachrichten, ${bell.unread} ungelesen` : 'Nachrichten',
  );
</script>

<a
  href={bell.href}
  data-act="nav"
  data-v="messages"
  class={bell.on ? 'on' : ''}
  aria-current={bell.on ? 'page' : undefined}
  aria-label={label}
  >{@html TAB_GLYPHS.bell}{#if bell.unread}<span class="badge"
      >{bell.unread > 99 ? '99+' : bell.unread}</span
    >{/if}</a
>
