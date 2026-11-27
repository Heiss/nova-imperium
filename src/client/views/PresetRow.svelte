<script lang="ts">
  // The presets of the round settings (#441): the row „Regelset“ [V] with a
  // button per preset, and the question of a clicked one with „Umstellen“
  // and „Abbrechen“, in the dialog „Neue Runde“ and in the tab „Universum“.
  // The question stands in place, as the dialog is itself in the modal;
  // features/presets.ts fills the fields.
  import { PRESETS } from '../../core/round.ts';
  import {
    presetAsk,
    presetQuestion,
    type PresetPlace,
  } from '../logic/presets.svelte.ts';

  let { place }: { place: PresetPlace } = $props();
  const asked = $derived(
    presetAsk.place === place
      ? (PRESETS.find((p) => p.id === presetAsk.id) ?? null)
      : null,
  );
</script>

<div class="presets" data-presets={place}>
  <h4 id="presets-{place}">Regelset</h4>
  <p class="flex" role="group" aria-labelledby="presets-{place}">
    {#each PRESETS as preset (preset.id)}
      <button
        type="button"
        data-act="askPreset"
        data-place={place}
        data-id={preset.id}>{preset.name}</button
      >
    {/each}
  </p>
  {#if asked}
    <div class="notice" role="alertdialog" aria-labelledby="preset-q-{place}">
      <p id="preset-q-{place}">{presetQuestion(asked.name)}</p>
      <p>
        <button
          type="button"
          data-act="applyPreset"
          data-place={place}
          data-id={asked.id}>Umstellen</button
        >
        <button type="button" data-act="cancelPreset">Abbrechen</button>
      </p>
    </div>
  {/if}
</div>
