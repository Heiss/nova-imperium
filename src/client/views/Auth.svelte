<script lang="ts">
  // The login, the registration with an invitation and the steps „Passwort
  // vergessen“, „Neues Passwort festlegen“ and „Anmeldecode“ (#118, bundle 7;
  // okf/architecture/patterns.md, section 9), from authPage() of
  // logic/auth.ts. The forms are sent by main.ts (`authform`, `forgotform`,
  // `resetform`, `codeform`), which reads the fields by their ids.
  import type { Snippet } from 'svelte';
  import type { AuthPage } from '../logic/auth.ts';
  import { RESEND_AFTER } from '../logic/login.ts';

  let { page }: { page: AuthPage } = $props();

  // „Code erneut senden“ comes 30 s after a code was sent, and again 30 s
  // after each new one (owner, 2026-11-25, 101b, #401).
  let canResend = $state(false);
  let sent = $state(0);
  $effect(() => {
    if (page.kind !== 'code') return;
    void sent;
    canResend = false;
    const timer = setTimeout(() => (canResend = true), RESEND_AFTER);
    return () => clearTimeout(timer);
  });
</script>

{#snippet step(title: string, form: string, button: string, input: Snippet)}
  <div class="box auth">
    <div class="hd">{title}</div>
    <div class="bd">
      <form id={form}>
        {@render input()}
        <p>
          <button type="submit">{button}</button>
          <button class="small" type="button" data-act="authback"
            >Zurück zum Login</button
          >
        </p>
      </form>
    </div>
  </div>
{/snippet}

{#snippet forgotInput()}
  <label for="recovery_email">Hinterlegte E-Mail-Adresse</label>
  <input id="recovery_email" type="email" autocomplete="email" required />
{/snippet}

{#snippet resetInput(minLength: number | undefined, app: boolean)}
  <label for="pw_next">Neues Passwort</label>
  <input
    id="pw_next"
    type="password"
    autocomplete="new-password"
    minlength={minLength}
    required
  />
  {#if app}
    <!-- With an authenticator app its code too (text 6, 104, #401). -->
    <label for="reset_code">Code aus der Authenticator-App</label>
    <input
      id="reset_code"
      inputmode="numeric"
      autocomplete="one-time-code"
      pattern="[0-9]{'{6}'}"
      required
    />
  {/if}
{/snippet}

{#snippet appInput()}
  <!-- The sign-in of an account with an authenticator app (text 5, #401). -->
  <label for="login_code">Code aus der Authenticator-App</label>
  <input
    id="login_code"
    inputmode="numeric"
    autocomplete="one-time-code"
    pattern="[0-9]{'{6}'}"
    required
  />
{/snippet}

{#snippet codeInput()}
  <p>Wir haben dir einen Code per E-Mail geschickt.</p>
  <label for="login_code">Sechsstelliger Code aus deiner E-Mail</label>
  <input
    id="login_code"
    inputmode="numeric"
    autocomplete="one-time-code"
    pattern="[0-9]{'{6}'}"
    required
  />
  {#if canResend}
    <p>
      <button
        class="small"
        type="button"
        data-act="resendcode"
        onclick={() => sent++}>Code erneut senden</button
      >
    </p>
  {/if}
{/snippet}

{#if page.kind === 'forgot'}
  {@render step(
    'Passwort vergessen',
    'forgotform',
    'Link anfordern',
    forgotInput,
  )}
{:else if page.kind === 'reset'}
  {@const minLength = page.minLength}
  {@const app = page.app}
  {#snippet input()}{@render resetInput(minLength, app)}{/snippet}
  {@render step(
    'Neues Passwort festlegen',
    'resetform',
    'Passwort speichern',
    input,
  )}
{:else if page.kind === 'code'}
  {@render step('Anmeldecode', 'codeform', 'Anmelden', codeInput)}
{:else if page.kind === 'app'}
  {@render step(
    'Code aus der Authenticator-App',
    'codeform',
    'Anmelden',
    appInput,
  )}
{:else}
  {@const reg = page.kind === 'register'}
  <div class="box auth">
    <div class="hd">{reg ? 'Neues Imperium gründen' : 'Login'}</div>
    <div class="bd">
      <form id="authform">
        <table class="kv">
          <tbody>
            <tr>
              <td><label for="a_name">Name</label></td>
              <td
                ><input
                  id="a_name"
                  maxlength="20"
                  autocomplete="username"
                  required
                /></td
              >
            </tr>
            <tr>
              <td><label for="a_pw">Passwort</label></td>
              <td
                ><input
                  id="a_pw"
                  type="password"
                  autocomplete={reg ? 'new-password' : 'current-password'}
                  minlength={page.kind === 'register'
                    ? page.minLength
                    : undefined}
                  required
                /></td
              >
            </tr>
            {#if page.kind === 'register'}
              <tr>
                <td>E-Mail</td>
                <td
                  ><input
                    id="a_email"
                    value={page.email}
                    readonly
                    aria-label="E-Mail"
                  /></td
                >
              </tr>
              <tr>
                <td><label for="a_planet">Planetenname</label></td>
                <td
                  ><input
                    id="a_planet"
                    maxlength="20"
                    value="Heimatplanet"
                  /></td
                >
              </tr>
              <tr>
                <td><label for="a_gal">Galaxie</label></td>
                <td
                  ><select id="a_gal">
                    {#each page.galaxies as galaxy (galaxy)}
                      <option value={galaxy}>{galaxy}</option>
                    {/each}
                  </select>
                  <span class="dim"
                    >gleiche wie deine Freunde = kürzere Flüge</span
                  ></td
                >
              </tr>
            {:else}
              <tr>
                <td colspan="2"
                  ><label
                    ><input id="remember-login" type="checkbox" /> Login auf diesem
                    Gerät speichern</label
                  ></td
                >
              </tr>
            {/if}
          </tbody>
        </table>
        <p>
          <button type="submit">{reg ? 'Imperium gründen' : 'Einloggen'}</button
          >
          {#if reg}
            <span class="lnk ml" data-act="authswitch"
              >Ich habe schon ein Konto</span
            >
          {:else}
            <button class="small" type="button" data-act="forgot"
              >Passwort vergessen?</button
            >
          {/if}
        </p>
        {#if !reg}
          <p>
            <button type="button" data-act="passkeyLogin"
              >Mit Passkey anmelden</button
            >
          </p>
          <p class="dim">
            Ein Konto bekommst du nur mit einer Einladung vom Admin.
          </p>
        {/if}
      </form>
    </div>
  </div>
{/if}
