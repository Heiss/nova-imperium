<script lang="ts">
  // „Optionen“, the box „Account löschen“ (views/options/delete-account.ts).
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { DeleteAccountPart } from '../../logic/options/delete-account.ts';

  let { page, section }: BoxProps<DeleteAccountPart> = $props();
</script>

<Box title="Account löschen" {section}>
  <p>{page.deleteAccount}</p>
  <button type="button" class="red" data-act="deleteAccount"
    >Account löschen</button
  >
</Box>
