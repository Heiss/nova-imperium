<script lang="ts">
  // „Optionen“, the box of the choices (views/options/choices.ts).
  import { isChosen } from '../../logic/form-state.svelte.ts';
  import { optionsForm } from '../../logic/options-form.svelte.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { ChoicesPart } from '../../logic/options/choices.ts';

  let { page, section }: BoxProps<ChoicesPart> = $props();
</script>

<Box title="Optionen" {section}>
  <div class="flex">
    Spähschädel pro Auspex-Erkundung von der Sternenkarte:
    <input
      type="number"
      id="o_probes"
      min="1"
      value={optionsForm.probes ?? page.probes}
      oninput={(e) => (optionsForm.probes = e.currentTarget.value)}
      aria-label="Spähschädel pro Auspex-Erkundung"
    />
  </div>
  <div class="flex mt">
    <label for="o_explain">(?)-Symbol:</label>
    <select
      id="o_explain"
      onchange={(e) => (optionsForm.explain = e.currentTarget.value)}
    >
      {#each page.explain as choice (choice.value)}
        <option
          value={choice.value}
          selected={isChosen(optionsForm.explain, choice)}
          >{choice.label}</option
        >
      {/each}
    </select>
  </div>
  <div class="flex mt">
    <label for="o_levels">Stufenübersicht:</label>
    <select
      id="o_levels"
      onchange={(e) => (optionsForm.levels = e.currentTarget.value)}
    >
      {#each page.levels as choice (choice.value)}
        <option
          value={choice.value}
          selected={isChosen(optionsForm.levels, choice)}>{choice.label}</option
        >
      {/each}
    </select>
  </div>
  <p><button data-act="saveopt">Speichern</button></p>
</Box>
