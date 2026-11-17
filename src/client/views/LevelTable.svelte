<script lang="ts">
  // The level table of a building or research (#187, built with #285): one
  // row per level of levelTable() of logic/level-table.ts, the own level
  // marked. The Lexicanum draws it; the lists of #187 draw the same.
  import type { Planet } from '../../core/types.ts';
  import { dur } from '../logic/format.ts';
  import { effectText, type LevelTable } from '../logic/level-table.ts';
  import { costHTML } from './common.ts';

  let { table, P }: { table: LevelTable; P: Planet } = $props();
</script>

<div class="lx-scroll">
  <table class="lx-t">
    <thead>
      <tr>
        <th scope="col">Stufe</th>
        <th scope="col">Kosten</th>
        <th scope="col" class="n">{table.timeLabel}</th>
        {#if table.effect}<th scope="col" class="n">{table.effect.label}</th
          >{/if}
      </tr>
    </thead>
    <tbody>
      {#each table.rows as row (row.level)}
        <tr class:lx-cur={row.current}>
          <th scope="row"
            >{row.level}{#if row.current}<span class="lx-me-tag">
                · deine Stufe</span
              >{/if}</th
          >
          <td>{@html costHTML(row.cost, P)}</td>
          <td class="n">{dur(row.time)}</td>
          {#if table.effect && row.effect !== undefined}<td class="n"
              >{effectText(row.effect, table.effect)}</td
            >{/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
