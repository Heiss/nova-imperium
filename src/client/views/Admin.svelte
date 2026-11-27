<script lang="ts">
  // „Admin“ (#118, bundle 7; okf/architecture/patterns.md, section 9), from
  // adminPage() of logic/admin.ts: the tabs and their panels. The panels
  // „Diagnose und Protokoll“ (AdminDiagnostics), „Fehler“ (AdminErrors) and
  // the list of the invitations (AdminInvitations) fill themselves from the
  // server; what they loaded, the filters and the tab that is shown are the
  // state of logic/admin-panels.svelte.ts, which stays over a render of the
  // page (it is mounted anew on every render).
  // The ids, `data-act`s and form ids are those of features/admin.ts and
  // features/round-archive.ts; the address of the invitation is kept over a
  // redraw (the poll of the state redraws the page when another player
  // registers, and an emptied required field would swallow the click on
  // „Einladen“, #332: logic/admin-form.svelte.ts, as the message to all
  // players); a sent invitation clears it by the fresh render. The
  // settings fields show the server and keep no state of this form, because
  // a kept value could not tell a draft from a value the server changed
  // (logic/settings-draft.ts). The page is kept over a render that is not
  // fresh (#361), so the rows are keyed by the account and round of the
  // drafts: a new round draws them anew with the server's values.
  import { diagnosticTab, type AdminPage } from '../logic/admin.ts';
  import { adminForm } from '../logic/admin-form.svelte.ts';
  import { isInvalid, isOpen, setOpen } from '../logic/admin-groups.svelte.ts';
  import { panels } from '../logic/admin-panels.svelte.ts';
  import AdminBotCheck from './AdminBotCheck.svelte';
  import AdminTotp from './AdminTotp.svelte';
  import AdminDiagnostics from './AdminDiagnostics.svelte';
  import AdminErrors from './AdminErrors.svelte';
  import AdminInvitations from './AdminInvitations.svelte';
  import AdminReports from './AdminReports.svelte';
  import Box from './Box.svelte';
  import RoundArchive from './RoundArchive.svelte';

  let { page }: { page: AdminPage | null } = $props();
  /** The panel the tab shows. */
  const shown = $derived(
    diagnosticTab(panels.tab) ? 'diagnostics' : panels.tab,
  );
</script>

{#snippet settingRows(rows: AdminPage['settings']['rows'])}
  <table class="kv">
    <tbody>
      {#each rows as row (`${page?.settings.owner}/${row.key}`)}
        <tr>
          <td><label for="set_{row.key}">{row.label}</label></td>
          <td>
            {#if row.choices}
              <select
                id="set_{row.key}"
                data-setting={row.key}
                aria-invalid={isInvalid(`set_${row.key}`) || undefined}
              >
                {#each row.choices as choice (choice.value)}
                  <option value={choice.value} selected={choice.selected}
                    >{choice.label}</option
                  >
                {/each}
              </select>
            {:else}
              <input
                type="number"
                id="set_{row.key}"
                data-setting={row.key}
                aria-invalid={isInvalid(`set_${row.key}`) || undefined}
                min={row.min}
                max={row.max}
                value={row.value}
              />
              <span class="dim">{row.range}</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<h2>Admin</h2>
{#if !page}
  <div class="notice">Nur für den Admin.</div>
{:else}
  <div role="tablist" aria-label="Admin-Bereiche" class="flex">
    {#each page.tabs as tab (tab.key)}
      <button
        id="admin-tab-{tab.key}"
        type="button"
        role="tab"
        aria-selected={panels.tab === tab.key}
        aria-controls="admin-panel-{tab.panel}"
        tabindex={panels.tab === tab.key ? 0 : -1}
        data-act="adminTab"
        data-tab={tab.key}>{tab.label}</button
      >
    {/each}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-diagnostics"
    role="tabpanel"
    aria-labelledby={shown === 'diagnostics'
      ? `admin-tab-${panels.tab}`
      : undefined}
    hidden={shown !== 'diagnostics'}
  >
    <Box title="Diagnose und Protokoll"
      ><div id="admin-diagnostics">
        <AdminDiagnostics players={page.players} moonCap={page.moonCap} />
      </div>
      <AdminBotCheck /><AdminTotp /></Box
    >
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-errors"
    role="tabpanel"
    aria-labelledby="admin-tab-errors"
    hidden={shown !== 'errors'}
  >
    <Box title="Fehler"><div id="admin-errors"><AdminErrors /></div></Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-reports"
    role="tabpanel"
    aria-labelledby="admin-tab-reports"
    hidden={shown !== 'reports'}
  >
    <Box title="Gemeldete Nachrichten"><AdminReports /></Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-invitations"
    role="tabpanel"
    aria-labelledby="admin-tab-invitations"
    hidden={shown !== 'invitations'}
  >
    <Box title="Einladungen">
      <form id="inviteform" class="flex">
        <label for="inv_email">E-Mail-Adresse</label>
        <input
          id="inv_email"
          type="email"
          required
          autocomplete="off"
          value={adminForm.invite}
          oninput={(e) => (adminForm.invite = e.currentTarget.value)}
        />
        <button type="submit">Einladen</button>
      </form>
      {#if page.link}
        <div class="notice mt">
          Einladungslink (gilt einmal, nur jetzt sichtbar):<br /><input
            id="inv_link"
            class="wide"
            readonly
            value={page.link}
            aria-label="Einladungslink"
          />
          <button class="small" data-act="copyLink">Kopieren</button>
        </div>
      {/if}
      <AdminInvitations />
    </Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-universe"
    role="tabpanel"
    aria-labelledby="admin-tab-universe"
    hidden={shown !== 'universe'}
  >
    <Box title="Universum">
      {#each page.settings.sections as section, i (section.heading ?? i)}
        {#if section.heading}
          <details
            class="settings-group"
            open={isOpen('universe', section.heading)}
            ontoggle={(e) =>
              setOpen('universe', section.heading!, e.currentTarget.open)}
          >
            <summary><h4>{section.heading}</h4></summary>
            {@render settingRows(section.rows)}
          </details>
        {:else}
          {@render settingRows(section.rows)}
        {/if}
      {:else}
        {@render settingRows([])}
      {/each}
      {#if page.settings.warning}
        <p class="notice" role="alert">{page.settings.warning}</p>
      {/if}
      <p class="dim">
        Änderungen wirken sofort. Laufende Bauaufträge und Flüge behalten ihre
        Endzeit.
      </p>
      <button data-act="saveSettings">Einstellungen speichern</button>
    </Box>
    <Box title="Endzeit">
      {#if page.endzeitDone}
        <p>{page.endzeitDone}</p>
      {:else}
        <p>
          Jeder Spieler mit Heimatplanet erhält einmal pro Runde die Gabe des
          Gottkaisers als Verlegung zu seinem Heimatplaneten.
        </p>
        <button class="red" data-act="endzeit">Endzeit einläuten</button>
      {/if}
    </Box>
    <Box title="Rundenberichte"><RoundArchive page={page.archive} /></Box>
    <Box title="Neue Runde">
      Alle Spieler behalten ihr Konto und bekommen einen frischen Planeten.
      <button class="red" data-act="reset">Neue Runde starten</button>
    </Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-announce"
    role="tabpanel"
    aria-labelledby="admin-tab-announce"
    hidden={shown !== 'announce'}
  >
    <Box title="Servernachricht">
      <p>
        Die Nachricht geht an alle Spieler und per Push an Geräte mit
        aktivierten Benachrichtigungen.
      </p>
      <form id="announceform">
        <label for="announce-text">Nachricht</label><br /><textarea
          id="announce-text"
          maxlength="500"
          rows="4"
          required
          value={adminForm.announce}
          oninput={(e) => (adminForm.announce = e.currentTarget.value)}
        ></textarea>
        <p><button type="submit">An alle senden</button></p>
      </form>
    </Box>
  </section>
{/if}
