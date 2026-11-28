<script lang="ts">
  // „Optionen“, the box of „Keine Wachen annehmen“ (views/options/holding.ts);
  // the checkbox saves at once (features/holding.ts).
  import { HOLD_OPTION_TITLE } from '../../../core/hold-texts.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { HoldPart } from '../../logic/options/holding.ts';

  let { page, section }: BoxProps<HoldPart> = $props();
</script>

<Box title={HOLD_OPTION_TITLE} {section}>
  <label class="switch"
    ><input
      type="checkbox"
      id="o_holds"
      data-chg="holdOption"
      checked={page.refused}
    /> Keine Wachen annehmen</label
  >
</Box>
