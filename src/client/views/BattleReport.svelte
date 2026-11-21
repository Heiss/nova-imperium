<script lang="ts">
  // The body of a battle report (#330): the sides with their units, the
  // winner and what the battle left, from reportBody() of logic/report-body.ts.
  import type { BattleBody } from '../logic/report-body.ts';
  import UnitTable from './UnitTable.svelte';

  let { body }: { body: BattleBody } = $props();
</script>

<div>{body.head}</div>
<div class="cols mt">
  {#each body.sides as side, i (i)}
    <div>
      <b class={side.cls}>{side.title}</b>
      <div class="dim">{side.tech}</div>
      <UnitTable rows={side.units} />
      {#if side.rebuilt}<div class="dim">
          Wiederhergestellte Verteidigung: {side.rebuilt}
        </div>{/if}
      {#if side.share}<div class="dim">Erbeutet: {side.share}</div>{/if}
    </div>
  {/each}
</div>
<p>
  <b>{body.winner}</b>{#if body.loot}<br />Erbeutet: {body.loot}{/if}{#each body.lines as line, i (i)}<br
    />{line}{/each}
</p>
