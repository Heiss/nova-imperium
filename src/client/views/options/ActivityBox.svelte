<script lang="ts">
  // „Optionen“, the box of the own activity (views/options/activity.ts).
  // `#own-activity` is a plain element: features/playtime.ts fills it.
  import { OWN_ACTIVITY_LOADING } from '../../logic/own-activity.ts';
  import type { OptionsSection } from '../../logic/phone-options.ts';
  import Box from '../Box.svelte';

  let { section }: { section: OptionsSection } = $props();
</script>

<Box title="Meine Aktivität &amp; Spielzeit" {section}>
  <div id="own-activity" aria-live="polite">{OWN_ACTIVITY_LOADING}</div>
  <p>
    <button type="button" data-act="reloadOwnActivity">Aktualisieren</button>
  </p>
</Box>
