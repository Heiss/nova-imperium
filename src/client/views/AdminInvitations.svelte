<script lang="ts">
  // The list of the open invitations in the box „Einladungen“ of the page
  // „Admin“ (#118, after bundle 7), from invitationsPage() of
  // logic/admin-panels.ts: address, creation, expiry and „Widerrufen“
  // (`data-act="revoke"`, features/admin.ts). A refusal of the server stands in
  // the place of the list.
  import { invitationsPage } from '../logic/admin-panels.ts';
  import { panels } from '../logic/admin-panels.svelte.ts';
  import AdminTable from './AdminTable.svelte';

  const shown = $derived(panels.invitations);
</script>

<div id="admin-invitations">
  {#if shown && 'list' in shown}
    <AdminTable table={invitationsPage(shown.list)} />
  {:else if shown}
    {shown.error}
  {/if}
</div>
