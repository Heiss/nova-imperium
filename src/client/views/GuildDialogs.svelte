<script lang="ts">
  // The three dialogs of the guilds (#163, #169), shown in the modal: handing
  // over the Leitung, dissolving the guild and the admin's look into a chat.
  // The forms are sent by features/guilds.ts (`guildtransferform`,
  // `guilddissolveform`); `closeModal` closes the dialog.
  import type {
    AdminChatPage,
    DissolvePage,
    TransferPage,
  } from '../logic/guilds.ts';
  import ChatLog from './ChatLog.svelte';

  type Dialog =
    | ({ kind: 'transfer' } & TransferPage)
    | ({ kind: 'dissolve' } & DissolvePage)
    | ({ kind: 'chat' } & AdminChatPage);

  let { dialog }: { dialog: Dialog } = $props();
</script>

{#if dialog.kind === 'transfer'}
  <h3 id="dialog-title">Leitung übergeben</h3>
  <form id="guildtransferform" data-uid={dialog.uid}>
    <p>Du übergibst die Gildenleitung an {dialog.name}.</p>
    <p>
      <label for="transfer_rank">Dein neuer Rang</label>
      <select id="transfer_rank">
        {#each dialog.ranks as rank (rank.id)}
          <option value={rank.id}>{rank.name}</option>
        {/each}
      </select>
    </p>
    <p>
      <button type="submit">Übergeben</button>
      <button type="button" data-act="closeModal">Abbrechen</button>
    </p>
  </form>
{:else if dialog.kind === 'dissolve'}
  <h3 id="dialog-title">Gilde auflösen</h3>
  <form id="guilddissolveform">
    <p>
      Alle Mitglieder verlassen die Gilde; ihre Ränge und offenen Bewerbungen
      werden gelöscht. Das kann nicht rückgängig gemacht werden.
    </p>
    <p>
      <label for="dissolve_tag"
        >Gib zur Bestätigung das Kürzel {dialog.tag} ein</label
      ><br /><input id="dissolve_tag" required autocomplete="off" data-nokeep />
    </p>
    <p>
      <button type="submit" class="red">Gilde endgültig auflösen</button>
      <button type="button" data-act="closeModal">Abbrechen</button>
    </p>
  </form>
{:else}
  <h3 id="dialog-title">Chat {dialog.heading}</h3>
  <ChatLog log={dialog.log} />
  <p><button type="button" data-act="closeModal">Schließen</button></p>
{/if}
