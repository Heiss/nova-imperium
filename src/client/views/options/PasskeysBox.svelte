<script lang="ts">
  // „Optionen“, the box of the passkeys (views/options/passkeys.ts).
  // `#passkey-list` is a plain element: features/passkeys.ts fills it.
  import { optionsForm } from '../../logic/options-form.svelte.ts';
  import type { OptionsSection } from '../../logic/phone-options.ts';
  import Box from '../Box.svelte';

  let { section }: { section: OptionsSection } = $props();
</script>

<Box title="Passkeys" {section}>
  <p>Auf unterstützten Geräten kannst du dich mit einem Passkey anmelden.</p>
  <form id="passkeyform" class="flex">
    <label for="passkey-password">Passwort für neuen Passkey</label><input
      id="passkey-password"
      type="password"
      value={optionsForm.passkey}
      oninput={(e) => (optionsForm.passkey = e.currentTarget.value)}
      autocomplete="current-password"
      required
    /><button type="submit">Passkey hinzufügen</button>
  </form>
  <p>
    <button type="button" data-act="listPasskeys"
      >Gespeicherte Passkeys anzeigen</button
    >
  </p>
  <div id="passkey-list"></div>
</Box>
