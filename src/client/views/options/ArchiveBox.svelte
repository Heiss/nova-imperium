<script lang="ts">
  // „Optionen“, the box of the archive of the rounds (views/options/archive.ts).
  import Box from '../Box.svelte';
  import RoundArchive from '../RoundArchive.svelte';
  import type { ArchivePart } from '../../logic/options/archive.ts';
  import type { BoxProps } from './contract.ts';

  let { page, section }: BoxProps<ArchivePart> = $props();
</script>

<Box title="Rundenarchiv" {section}><RoundArchive page={page.archive} /></Box>
