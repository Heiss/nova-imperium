<script lang="ts">
  // „Authenticator-App zurücksetzen“ of the open player record (#401; owner,
  // 2026-11-25, 103c, text 7): only the admin resets a lost app, after a
  // question; the player then signs in with the password and the mail code.
  // Shown only while the player has an app.
  import { panels, resetTotp } from '../logic/admin-panels.svelte.ts';

  const record = $derived(panels.tab === 'players' ? panels.record : null);
</script>

{#if record?.detail.totp}
  <section data-admin="totp">
    <button
      type="button"
      onclick={() => {
        if (
          window.confirm(
            `Danach kann sich ${record.person.name} wieder mit Passwort und E-Mail-Code anmelden.`,
          )
        )
          void resetTotp(record.person.id);
      }}>Authenticator-App zurücksetzen</button
    >
  </section>
{/if}
