<script lang="ts">
  // „Optionen“ (#118, bundle 5; okf/architecture/patterns.md, sections 9 and
  // 16), from optionsPage() of logic/options.ts. Each box is declared with
  // its section, its component and its data in its own module of
  // views/options/ (`optionBoxes`, #378); this component draws them in their
  // order and names none. The ids, the `data-act`s and the forms of the boxes
  // are those that features/ and main.ts read. On a phone (#189) a switch of
  // five sections shows some of the boxes (`data-sec`); the desktop shows
  // them all as before. The fields keep what the player typed or chose in
  // logic/options-form.svelte.ts (#332).
  import type { OptionsPage } from '../logic/options.ts';
  import { OPTION_SECTIONS } from '../logic/phone-options.ts';
  import { phoneOptions } from '../logic/phone-options.svelte.ts';
  import { BOXES } from './options/boxes.ts';

  let { page }: { page: OptionsPage } = $props();
</script>

<h2>Optionen</h2>
<div class="seg phone-only" role="group" aria-label="Bereich">
  {#each OPTION_SECTIONS as s (s.key)}
    <button
      type="button"
      class:on={phoneOptions.section === s.key}
      aria-pressed={phoneOptions.section === s.key}
      onclick={() => (phoneOptions.section = s.key)}>{s.label}</button
    >
  {/each}
</div>
<div class="opt" data-section={phoneOptions.section}>
  {#each BOXES as box (box.key)}
    {#if box.shown?.(page) ?? true}
      <box.component {page} section={box.section} />
    {/if}
  {/each}
</div>
