<script lang="ts">
  // „Optionen“, the box of the main planet (views/options/main-planet.ts).
  import { isChosen } from '../../logic/form-state.svelte.ts';
  import { optionsForm } from '../../logic/options-form.svelte.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { MainPlanetPart } from '../../logic/options/main-planet.ts';

  let { page, section }: BoxProps<MainPlanetPart> = $props();
</script>

<Box title="Hauptplanet" {section}>
  <p>{page.main.intro}</p>
  <div class="flex">
    <label for="o_main">Hauptplanet</label>
    <select
      id="o_main"
      disabled={page.main.locked}
      onchange={(e) => (optionsForm.main = e.currentTarget.value)}
    >
      {#each page.main.options as option (option.id)}
        <option
          value={option.id}
          selected={isChosen(optionsForm.main, {
            value: option.id,
            selected: option.selected,
          })}>{option.label}</option
        >
      {/each}
    </select>
    <button data-act="mainPlanet" disabled={page.main.locked}>Ändern</button>
  </div>
  {#if page.main.note}<p id="o_main_lock">{page.main.note}</p>{/if}
</Box>
