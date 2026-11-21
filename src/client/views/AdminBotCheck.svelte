<script lang="ts">
  // „Automatisierung prüfen“ of the open player record (#181; owner,
  // 2026-11-14 and 2026-11-21): the switch per player and, while it is on,
  // the hints since the switch-on, raw facts without a verdict
  // (logic/admin-panels.ts `botCheckBlock`). Its own block below the panel
  // „Diagnose und Protokoll“, so the record keeps its frozen reference of
  // #118. Nothing of it is shown to the player.
  import { botCheckBlock } from '../logic/admin-panels.ts';
  import { panels, switchBotCheck } from '../logic/admin-panels.svelte.ts';

  const record = $derived(panels.tab === 'players' ? panels.record : null);
  const check = $derived(
    record?.detail.botCheck ? botCheckBlock(record.detail.botCheck) : null,
  );
</script>

{#if record && check}
  <section data-admin="bot-check">
    <h4>Automatisierung</h4>
    <label
      ><input
        type="checkbox"
        id="bot-check"
        checked={check.on}
        onchange={async (event) => {
          const box = event.currentTarget;
          await switchBotCheck(record.person.id, box.checked);
          // A refused switch leaves `check.on` as it was, so Svelte does not
          // redraw the box: set it back to what the server has.
          if (check) box.checked = check.on;
        }}
      /> Automatisierung prüfen</label
    >
    <p data-admin="bot-check-status">{check.status}</p>
    {#if check.on}
      <h5>Auffälligkeiten seit dem Einschalten</h5>
      <p class="dim">
        Nur Tatsachen, keine Bewertung. Ein Treffer der Aktionsgrenze wird
        höchstens einmal je Stunde vermerkt.
      </p>
      {#if check.empty}
        <p>{check.empty}</p>
      {:else}
        <ul data-admin="bot-hints">
          {#each check.lines as line (line)}
            <li>{line}</li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>
{/if}
