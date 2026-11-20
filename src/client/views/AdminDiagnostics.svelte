<script lang="ts">
  // The panel „Diagnose und Protokoll“ of the page „Admin“ (#118, after
  // bundle 7): the filter of the event log and, by the tab, the event log, the
  // player records or the orders, from logic/admin-panels.ts; what it loaded
  // and what was typed into the filter is the state of
  // logic/admin-panels.svelte.ts, because the page is mounted anew on every
  // render. The ids and `data-admin`s are those the e2e tests and style.css
  // read.
  import {
    eventsPage,
    ordersPage,
    playerPage,
    statsPage,
  } from '../logic/admin-panels.ts';
  import {
    eventsPageTo,
    moderate,
    openAdminTab,
    panels,
    showEvents,
  } from '../logic/admin-panels.svelte.ts';
  import type { Players } from '../logic/types.ts';
  import AdminPager from './AdminPager.svelte';
  import AdminTable from './AdminTable.svelte';

  let { players }: { players: Players } = $props();
  const tab = $derived(panels.tab);
  const events = $derived(panels.events && eventsPage(panels.events, players));
  const record = $derived(
    panels.record && playerPage(panels.record.person, panels.record.detail),
  );
  const orders = $derived(
    panels.orders &&
      ordersPage(panels.orders.orders, panels.orders.now, players),
  );
  const fields = $derived(panels.fields);
  const limits = ['10', '25', '50', '100'];
  const outcomes = [
    ['ok', 'Erfolgreich'],
    ['rejected', 'Abgelehnt'],
    ['error', 'Fehler'],
  ];

  /** What is typed into the filter is kept over a render. */
  function typed(event: Event): void {
    const form = event.currentTarget as HTMLFormElement;
    panels.fields = Object.fromEntries(
      new FormData(form) as unknown as Iterable<[string, string]>,
    );
  }

  function moderation(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = Object.fromEntries(new FormData(form));
    if (window.confirm('Diesen Eingriff ausführen?')) void moderate(values);
  }
</script>

<form
  id="diagnostics-filter"
  hidden={tab !== 'events'}
  oninput={typed}
  onchange={typed}
  onsubmit={(event) => {
    event.preventDefault();
    void showEvents();
  }}
>
  <div class="flex">
    <label for="audit-player">Spieler</label><select
      id="audit-player"
      name="player"
      ><option value="">Alle</option
      >{#each Object.entries(players) as [id, p] (id)}<option
          value={id}
          selected={fields.player === id}>{p.name}</option
        >{/each}</select
    >
    <label
      >Aktion
      <input
        name="action"
        maxlength="40"
        placeholder="z. B. build"
        value={fields.action || undefined}
      /></label
    >
    <label for="audit-outcome">Ergebnis</label><select
      id="audit-outcome"
      name="outcome"
      ><option value="">Alle</option
      >{#each outcomes as [value, label] (value)}<option
          {value}
          selected={fields.outcome === value}>{label}</option
        >{/each}</select
    >
    <label
      >Vorgangs-ID <input
        name="requestId"
        maxlength="36"
        value={fields.requestId || undefined}
      /></label
    >
    <label
      >Planet / Flotte
      <input
        name="reference"
        maxlength="40"
        value={fields.reference || undefined}
      /></label
    >
    <label
      >Von <input
        type="date"
        name="since"
        value={fields.since || undefined}
      /></label
    >
    <label
      >Bis <input
        type="date"
        name="until"
        value={fields.until || undefined}
      /></label
    >
    <label
      >Pro Seite
      <select name="limit" onchange={() => void showEvents()}
        >{#each limits as limit (limit)}<option
            selected={limit !== limits[0] && fields.limit === limit}
            >{limit}</option
          >{/each}</select
      ></label
    >
    <button type="submit">Anzeigen</button>
  </div>
</form>
<p class="notice" role="status" hidden={panels.notice === null}>
  {panels.notice ?? ''}
</p>
<section data-admin="stats" hidden={tab !== 'players'}>
  {#if panels.stats}
    <h3>Spielaktivität</h3>
    <p class="dim">
      Heute und die letzten sechs UTC-Tage. Die aktive Zeit ist aus
      Interaktionen geschätzt.
    </p>
    <AdminTable table={statsPage(panels.stats)} />
  {/if}
</section>
<section data-admin="player" hidden={tab !== 'players'}>
  {#if record}
    <h3>{record.heading}</h3>
    <p>{record.status}</p>
    <button
      type="button"
      data-diagnostics="playerEvents"
      data-player={record.id}
      onclick={() => openAdminTab('events', record.id)}
      >Ereignisse zu diesem Spieler</button
    >
    <AdminTable table={record.days} />
    <h4>Planeten</h4>
    <AdminTable table={record.planets} />
    {#if record.moderation}
      <form id="moderation-form" class="flex" onsubmit={moderation}>
        <input type="hidden" name="player" value={record.id} />
        <label
          >Eingriff
          <select name="action"
            ><option value="revokeSessions">Sitzungen beenden</option><option
              value="ban">Sperren</option
            ><option value="unban">Freigeben</option></select
          ></label
        >
        <label
          >Sperrdauer in Stunden (0 = unbefristet)
          <input
            name="hours"
            type="number"
            min="0"
            max="720"
            value="0"
          /></label
        >
        <label>Grund <input name="reason" maxlength="200" required /></label>
        <button type="submit">Ausführen</button>
      </form>
    {/if}
  {/if}
</section>
<section data-admin="orders" hidden={tab !== 'orders'}>
  {#if orders}
    <h3>Aufträge</h3>
    <p class="dim">
      Die nächsten 100 nach Sollzeit. Gebäude, Forschung und Schiffsschmiede
      können beim Abruf des Spielzustands berechnet werden.
    </p>
    <AdminTable table={orders} />
  {/if}
</section>
<section data-admin="events" hidden={tab !== 'events'}>
  {#if events}
    <h3>Ereignisprotokoll</h3>
    <AdminPager
      pager={events.pager}
      onpage={(page) => void eventsPageTo(page)}
    />
    <AdminTable table={events.table} />
  {/if}
</section>
