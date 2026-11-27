<script lang="ts">
  // The panel „Fehler“ of the page „Admin“ (issue #126; #118, after bundle 7):
  // server errors, browser errors and problem reports, newest first with the
  // paging of the event log, and the download of a ZIP for a time range
  // (default: the last 7 days). From errorsPage() of logic/admin-panels.ts;
  // what was loaded and typed is the state of logic/admin-panels.svelte.ts.
  import { lockedSubmit } from '../logic/act-lock.ts';
  import { errorsPage } from '../logic/admin-panels.ts';
  import {
    downloadErrorRange,
    errorsPageTo,
    panels,
    showErrors,
  } from '../logic/admin-panels.svelte.ts';
  import AdminPager from './AdminPager.svelte';
  import AdminTable from './AdminTable.svelte';

  const list = $derived(panels.errors && errorsPage(panels.errors));
  const kinds = [
    ['server', 'Serverfehler'],
    ['client', 'Browserfehler'],
    ['report', 'Problemmeldungen'],
  ];
  const limits = ['10', '25', '50', '100'];

  /** What is typed into a form of the panel is kept over a render. */
  const fieldsOf = (form: HTMLFormElement) =>
    Object.fromEntries(
      new FormData(form) as unknown as Iterable<[string, string]>,
    );
</script>

<form
  id="errors-download"
  class="flex"
  oninput={(e) => (panels.range = fieldsOf(e.currentTarget))}
  onsubmit={lockedSubmit(() => downloadErrorRange())}
>
  <label
    >Zeitraum von
    <input
      type="date"
      name="since"
      value={panels.range.since}
      required
    /></label
  >
  <label
    >bis <input
      type="date"
      name="until"
      value={panels.range.until}
      required
    /></label
  >
  <button type="submit">Herunterladen</button>
</form>
<p class="dim">
  ZIP mit Fehlern, Problemmeldungen und dem Ereignisprotokoll als JSON Lines,
  mit Spielernamen.
</p>
<form
  id="errors-filter"
  class="flex mt"
  onchange={(e) => {
    panels.errorFields = fieldsOf(e.currentTarget);
    void showErrors();
  }}
  onsubmit={(e) => e.preventDefault()}
>
  <label
    >Art
    <select name="kind"
      ><option value="">Alle</option
      >{#each kinds as [value, label] (value)}<option
          {value}
          selected={panels.errorFields.kind === value}>{label}</option
        >{/each}</select
    ></label
  >
  <label
    >Anzahl je Seite
    <select name="limit"
      >{#each limits as limit (limit)}<option
          selected={limit !== limits[0] && panels.errorFields.limit === limit}
          >{limit}</option
        >{/each}</select
    ></label
  >
</form>
<p class="notice" role="status" hidden={panels.errorNotice === null}>
  {panels.errorNotice ?? ''}
</p>
<div data-errors-list>
  {#if list}
    <AdminPager pager={list.pager} onpage={(page) => void errorsPageTo(page)} />
    <AdminTable table={list.table} />
  {/if}
</div>
