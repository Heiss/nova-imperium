<script lang="ts">
  // The level table of a building or research (#187, built with #285): one
  // row per level of levelTable() of logic/level-table.ts. The Lexicanum
  // draws it with the own level marked; the level overview of the lists
  // (`overview`) adds the difference to today, the separator „große
  // Schritte“ and what a level opens.
  import type { Planet } from '../../core/types.ts';
  import { dur } from '../logic/format.ts';
  import {
    deltaText,
    effectText,
    type LevelTable,
  } from '../logic/level-table.ts';
  import { costHTML } from './common.ts';

  let {
    table,
    P,
    overview = false,
  }: { table: LevelTable; P: Planet; overview?: boolean } = $props();

  const opens = $derived(table.rows.some((row) => row.unlocks));
  const columns = $derived(3 + table.effects.length + (opens ? 1 : 0));

  /** Whether a change is for the better: more of an effect, less of a cost. */
  const better = (delta: number, cost?: true): boolean =>
    cost ? delta < 0 : delta > 0;
</script>

<!-- A table that scrolls sideways on a phone is reached by the keyboard
     (axe: scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="lx-scroll" role="region" aria-label="Stufen" tabindex="0">
  <table class="lx-t lx-levels">
    <thead>
      <tr>
        <th scope="col">Stufe</th>
        <th scope="col">Kosten</th>
        <th scope="col" class="n">{table.timeLabel}</th>
        {#each table.effects as head (head.label)}
          <th scope="col" class="n"
            >{head.label}{#if overview}{' '}(Δ zu heute){/if}</th
          >
        {/each}
        {#if opens}<th scope="col">Schaltet frei</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each table.rows as row (row.level)}
        {#if overview && row.big}
          <tr class="lx-sep">
            <td colspan={columns}>große Schritte</td>
          </tr>
        {/if}
        <tr class:lx-cur={row.current} class:lx-big={overview && row.big}>
          <th scope="row"
            >{row.level}{#if row.current}<span class="lx-me-tag">
                · deine Stufe</span
              >{/if}</th
          >
          <td>{@html costHTML(row.cost, P)}</td>
          <td class="n">{dur(row.time)}</td>
          {#each table.effects as head, i (head.label)}
            {@const delta = overview
              ? deltaText(row.deltas[i]!, head)
              : undefined}
            <td class="n"
              >{effectText(row.values[i]!, head)}{#if delta}{' '}<span
                  class={better(row.deltas[i]!, head.cost) ? 'good' : 'bad'}
                  >({delta})</span
                >{/if}</td
            >
          {/each}
          {#if opens}<td>{row.unlocks?.join(', ') || '–'}</td>{/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if overview && table.notes}
  {#each table.notes as note (note)}
    <div class="lx-note dim">{note}</div>
  {/each}
{/if}
