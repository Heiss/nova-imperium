<script lang="ts">
  // „Highscore“ (#118, bundle 5; okf/architecture/patterns.md, section 9),
  // from highscorePage() of logic/highscore.ts: one ranking per category with
  // the buttons above (features/highscore.ts) and what a point is worth
  // below. The classes of the table are those of the phone layout in
  // style.css (`.scores`).
  import type { HighscorePage } from '../logic/highscore.ts';
  import HomeCell from './HomeCell.svelte';

  let { page }: { page: HighscorePage } = $props();
</script>

<h2 id="highscore-h">Highscore</h2>
<div class="flex" role="group" aria-labelledby="highscore-h">
  {#each page.buttons as button (button.key)}
    <button
      type="button"
      data-act="highscore"
      data-cat={button.key}
      aria-pressed={button.pressed}>{button.label}</button
    >
  {/each}
</div>
<div class="box">
  <table class="scores">
    <tbody>
      <tr>
        <th class="n">Platz</th><th>Spieler</th><th>Heimatplanet</th><th
          class="n">Punkte</th
        >
      </tr>
      {#each page.rows as row (row.id)}
        <tr class={row.me ? 'me' : ''}>
          <td class="n">{row.rank}</td><td>{row.name}</td><td
            ><HomeCell home={row.home} /></td
          ><td class="n">{row.points}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if page.stand}<div class="dim">{page.stand}</div>{/if}
<div class="dim">{page.note}</div>
