<script lang="ts">
  // „Optionen“, the box of the vacation mode (views/options/vacation.ts).
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { VacationPart } from '../../logic/options/vacation.ts';

  let { page, section }: BoxProps<VacationPart> = $props();
</script>

<Box title="Urlaubsmodus" {section}>
  <p>{page.vacation}</p>
  <p>
    Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und
    weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.
  </p>
  <button data-act="startVacation">Urlaubsmodus aktivieren</button>
</Box>
