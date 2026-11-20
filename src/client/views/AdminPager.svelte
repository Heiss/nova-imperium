<script lang="ts">
  // First, previous, next and last page of a list of the admin (#118, after
  // bundle 7), from pagerPage() of logic/admin-panels.ts. The page buttons
  // carry `data-diagnostics="page"` or `data-errors="page"` and the page they
  // lead to; `onpage` shows it.
  import type { PagerPage } from '../logic/admin-panels.ts';

  let { pager, onpage }: { pager: PagerPage; onpage: (page: number) => void } =
    $props();
  const [first, previous, next, last] = $derived(pager.buttons);
  const marks = (to: number) => ({
    [`data-${pager.attribute}`]: 'page',
    'data-page': to,
  });
</script>

{#snippet button(b: PagerPage['buttons'][number])}
  <button
    type="button"
    {...marks(b.to)}
    aria-label={b.label}
    title={b.label}
    disabled={b.disabled}
    onclick={() => onpage(b.to)}>{b.icon}</button
  >
{/snippet}

<div class="flex mt" aria-label={pager.group} role="group">
  {@render button(first!)}
  {@render button(previous!)}
  <span role="status">{pager.status}</span>
  {@render button(next!)}
  {@render button(last!)}
</div>
<p class="dim">{pager.note}</p>
