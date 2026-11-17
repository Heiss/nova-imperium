<script lang="ts">
  // The search of the Lexicanum (#285, B6), on the page only: in the
  // browser, results grouped by kind; ↑ ↓ mark a hit, Enter opens it, Esc
  // closes the results, „/“ focuses the field from anywhere on the page.
  import {
    flatHits,
    groupTitle,
    hitsLabel,
    moveMark,
    searchHits,
  } from '../logic/lexicanum.ts';
  import { openArticle } from './lexicanum.ts';

  let query = $state('');
  let open = $state(false);
  let mark = $state(-1);
  let field: HTMLInputElement | undefined = $state();

  const groups = $derived(searchHits(query));
  const hits = $derived(flatHits(groups));
  const shown = $derived(open && query.trim() !== '');

  function choose(id: string): void {
    query = '';
    open = false;
    openArticle(id);
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open = true;
      mark = moveMark(mark, hits.length, e.key);
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
      mark = -1;
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
      mark = -1;
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
