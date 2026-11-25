<script lang="ts">
  // „Optionen“, the box of the installation (views/options/install.ts).
  // `#pwa-install` is a plain element: features/install.ts shows it.
  import type { OptionsSection } from '../../logic/phone-options.ts';
  import Box from '../Box.svelte';

  let { section }: { section: OptionsSection } = $props();
</script>

<Box title="App installieren" {section}>
  <p>
    Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm
    hinzufügen“. Auf iPhone und iPad öffne Nova Imperium in Safari, tippe auf
    „Teilen“ und wähle „Zum Home-Bildschirm“ und „Als Web-App öffnen“. Zum
    Spielen brauchst du eine Internetverbindung.
  </p>
  <button data-act="installApp" id="pwa-install" hidden>App installieren</button
  >
</Box>
