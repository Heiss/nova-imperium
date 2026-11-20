<script lang="ts">
  // The confirmation of „Account löschen“ in the modal (#118, package 8). The
  // component owns the password and the busy state, so a redraw of the page
  // (the poll of the state) never touches them; `confirm` (features/
  // account-delete.ts) sends the deletion and says whether it went through.
  let {
    text,
    confirm,
  }: { text: string; confirm: (password: string) => Promise<boolean> } =
    $props();

  let password = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    if (!(await confirm(password))) busy = false;
  }
</script>

<form id="deleteaccountform" onsubmit={submit}>
  <p>{text}</p>
  <p>
    <label for="delete-account-password">Passwort zur Bestätigung</label>
    <input
      id="delete-account-password"
      type="password"
      autocomplete="current-password"
      required
      bind:value={password}
    />
  </p>
  <button class="red" type="submit" disabled={busy}
    >Account endgültig löschen</button
  >
  <button type="button" data-act="closeModal">Abbrechen</button>
</form>
