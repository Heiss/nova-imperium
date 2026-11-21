<script lang="ts">
  // The list of the reported private messages in the tab „Gemeldete
  // Nachrichten“ of the page „Admin“ (#226, owner, 2026-11-21, Q24), from
  // reportsPage() of logic/admin-panels.ts: only what a recipient reported,
  // each opening of the tab is an entry of the audit log. The text is shown as
  // text. A refusal of the server stands in the place of the list.
  import { reportsPage } from '../logic/admin-panels.ts';
  import { panels } from '../logic/admin-panels.svelte.ts';
  import AdminTable from './AdminTable.svelte';

  const shown = $derived(panels.messageReports);
</script>

<div id="admin-message-reports">
  {#if shown && 'list' in shown}
    <AdminTable table={reportsPage(shown.list)} />
  {:else if shown}
    {shown.error}
  {/if}
</div>
