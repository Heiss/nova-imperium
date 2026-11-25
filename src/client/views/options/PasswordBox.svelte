<script lang="ts">
  // „Optionen“, the box of the change of the password
  // (views/options/password.ts).
  import { optionsForm } from '../../logic/options-form.svelte.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { PasswordPart } from '../../logic/options/password.ts';

  let { page, section }: BoxProps<PasswordPart> = $props();
</script>

<Box title="Passwort ändern" {section}>
  <form id="passwordform" class="flex">
    <label for="pw_current">Bisheriges Passwort</label>
    <input
      id="pw_current"
      type="password"
      value={optionsForm.pwCurrent}
      oninput={(e) => (optionsForm.pwCurrent = e.currentTarget.value)}
      autocomplete="current-password"
      required
    />
    <label for="pw_next">Neues Passwort</label>
    <input
      id="pw_next"
      type="password"
      value={optionsForm.pwNext}
      oninput={(e) => (optionsForm.pwNext = e.currentTarget.value)}
      autocomplete="new-password"
      minlength={page.passwordMinLength}
      required
    />
    <label for="pw_confirm">Neues Passwort wiederholen</label>
    <input
      id="pw_confirm"
      type="password"
      value={optionsForm.pwConfirm}
      oninput={(e) => (optionsForm.pwConfirm = e.currentTarget.value)}
      autocomplete="new-password"
      minlength={page.passwordMinLength}
      required
    />
    <button type="submit">Passwort ändern</button>
  </form>
</Box>
