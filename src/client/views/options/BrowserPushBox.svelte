<script lang="ts">
  // „Optionen“, the box of Web Push on this device
  // (views/options/browser-push.ts).
  import type { OptionsSection } from '../../logic/phone-options.ts';
  import Box from '../Box.svelte';

  let { section }: { section: OptionsSection } = $props();
</script>

<Box title="Browser-Benachrichtigungen" {section}>
  <p>Meldungen zu Aufträgen, Flotten und neuen Nachrichten auf diesem Gerät.</p>
  <button data-act="pushEnable">Aktivieren</button>
  <button data-act="pushDisable">Deaktivieren</button>
</Box>
