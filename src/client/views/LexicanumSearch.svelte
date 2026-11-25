<script lang="ts">
  // The search of the Lexicanum (#285, B6), on the page only: in the
  // browser, results grouped by kind; ↑ ↓ mark a hit, Enter opens it, Esc
  // closes the results, „/“ focuses the field from anywhere on the page.
  import {
    flatHits,
    groupTitle,
    hitsLabel,
    markOf,
    type Marked,
    moveMark,
    opens,
    searchHits,
  } from '../logic/lexicanum.ts';
  import { client } from '../logic/state.svelte.ts';
  import { openArticle } from './lexicanum-nav.ts';

  let query = $state('');
  let open = $state(false);
  // The marked hit by its id, so a state update that hides a page keeps
  // the mark on a rendered hit (#404, markOf).
  let marked = $state<Marked | null>(null);
  let field: HTMLInputElement | undefined = $state();

  // No article the player does not see (#404).
  const v = $derived(client.shown);
  const groups = $derived(searchHits(query, v ? opens(v) : undefined));
  const hits = $derived(flatHits(groups));
  const shown = $derived(open && query.trim() !== '');
  const mark = $derived(markOf(hits, marked));

  function markAt(i: number): void {
    const hit = hits[i];
    marked = hit ? { id: hit.id, at: i } : null;
  }

  function choose(id: string): void {
    query = '';
    open = false;
    openArticle(id);
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open = true;
      markAt(moveMark(mark, hits.length, e.key));
    } else if (e.key === 'Enter') {
      const hit = hits[Math.max(mark, 0)];
      if (hit) {
        e.preventDefault();
        choose(hit.id);
      }
    } else if (e.key === 'Escape') {
      // Esc closes the results only, not a dialog of the page.
      e.stopPropagation();
      open = false;
      marked = null;
    }
  }

  /** „/“ focuses the search, unless the player types into a field. */
  function onWindowKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (e.key !== '/' || target.closest('input, textarea, select')) return;
    e.preventDefault();
    field?.focus();
  }

  /** The id of a hit in the list, for aria-activedescendant. */
  const hitId = (i: number): string => `lx-hit-${i}`;
  const indexOf = (id: string): number => hits.findIndex((h) => h.id === id);
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="lx-search">
  <span class="lx-mag" aria-hidden="true">⌕</span>
  <input
    bind:this={field}
    bind:value={query}
    type="search"
    role="combobox"
    placeholder="Suche im Lexicanum …"
    aria-label="Suche im Lexicanum"
    aria-autocomplete="list"
    aria-expanded={shown}
    aria-controls="lx-results"
    aria-activedescendant={shown && mark >= 0 ? hitId(mark) : undefined}
    autocomplete="off"
    oninput={() => {
      open = true;
      marked = null;
    }}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    {onkeydown}
  />
  <kbd aria-hidden="true">/</kbd>
  <div class="lx-results" hidden={!shown}>
    <div id="lx-results" role="listbox" aria-label="Treffer">
      {#each groups as group (group.kind)}
        <div role="group" aria-label={groupTitle(group)}>
          <div class="lx-rg" aria-hidden="true">{groupTitle(group)}</div>
          {#each group.hits as hit (hit.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="lx-r"
              class:on={indexOf(hit.id) === mark}
              id={hitId(indexOf(hit.id))}
              role="option"
              tabindex="-1"
              aria-selected={indexOf(hit.id) === mark}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => choose(hit.id)}
            >
              <b>{hit.title}</b>{#if hit.ab}
                <span class="lx-ab">{hit.ab}</span>{/if}
              {#if hit.line}<span>{hit.line}</span>{/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    {#if shown}
      <div class="lx-rf" role="status">
        <span>{hitsLabel(hits.length)}</span>
        <span aria-hidden="true"
          ><kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> öffnen ·
          <kbd>Esc</kbd> schließen</span
        >
      </div>
    {/if}
  </div>
</div>
