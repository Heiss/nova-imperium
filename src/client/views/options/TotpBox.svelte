<script lang="ts">
  // „Optionen“ → „Konto“, the box „Authenticator-App“ (#401; owner,
  // 2026-11-25, text 4 and 137a): „Einrichten“ shows the QR code and the key
  // for manual entry, the first code of the app confirms it; while one is set
  // up, „Eingerichtet.“ and „Entfernen“, which asks for the password and a
  // code of the app. features/totp.ts sends the forms.
  import { qrModules, totpSetup } from '../../logic/totp-setup.svelte.ts';
  import type { TotpPart } from '../../logic/options/totp.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';

  let { page, section }: BoxProps<TotpPart> = $props();
  const modules = $derived(totpSetup.uri ? qrModules(totpSetup.uri) : null);
</script>

<Box title="Authenticator-App" {section}>
  <p>
    Scanne den QR-Code mit deiner Authenticator-App und gib den angezeigten Code
    ein. Danach brauchst du bei jeder Anmeldung mit Passwort den Code aus der
    App; eine E-Mail mit Code kommt dann nicht mehr.
  </p>
  {#if page.totp}
    <form id="totpremoveform" class="flex">
      <span data-totp="status">Eingerichtet.</span>
      <label for="totp_password">Passwort</label>
      <input
        id="totp_password"
        type="password"
        autocomplete="current-password"
        required
      />
      <label for="totp_remove_code">Code aus der Authenticator-App</label>
      <input
        id="totp_remove_code"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]{'{6}'}"
        required
      />
      <button type="submit">Entfernen</button>
    </form>
  {:else if modules && totpSetup.secret}
    {@const size = modules.length + 8}
    <svg
      class="totp-qr"
      viewBox={`0 0 ${size} ${size}`}
      width="200"
      height="200"
      role="img"
      aria-label="QR-Code"
      shape-rendering="crispEdges"
      ><rect
        width={size}
        height={size}
        fill="#fff"
      />{#each modules as row, r (r)}{#each row as dark, c (c)}{#if dark}<rect
              x={c + 4}
              y={r + 4}
              width="1"
              height="1"
              fill="#000"
            />{/if}{/each}{/each}</svg
    >
    <p>
      Schlüssel zur manuellen Eingabe: <code data-totp="secret"
        >{totpSetup.secret}</code
      >
    </p>
    <form id="totpconfirmform" class="flex">
      <label for="totp_code">Code aus der Authenticator-App</label>
      <input
        id="totp_code"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]{'{6}'}"
        required
      />
      <button type="submit">Einrichten</button>
    </form>
  {:else}
    <p>
      <button type="button" data-act="totpSetup">Einrichten</button>
    </p>
  {/if}
</Box>
