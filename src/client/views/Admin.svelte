<script lang="ts">
  // „Admin“ (#118, bundle 7; okf/architecture/patterns.md, section 9), from
  // adminPage() of logic/admin.ts: the tabs and their panels. The panels
  // „Diagnose und Protokoll“, „Fehler“ and the list of the invitations are
  // plain elements (`#admin-diagnostics`, `#admin-errors`,
  // `#admin-invitations`): views/admin-panel.ts mounts them after the render,
  // keeps them over a redraw and shows the tab (`aria-selected`, `hidden`).
  // The ids, `data-act`s and form ids are those of features/admin.ts and
  // features/round-archive.ts; the address of the invitation is kept over a
  // redraw (the poll of the state redraws the page when another player
  // registers, and an emptied required field would swallow the click on
  // „Einladen“); a sent invitation clears it by the fresh render. The
  // settings fields are `data-nokeep` because
  // a kept value could not tell a draft from a value the server changed
  // (logic/settings-draft.ts).
  import type { AdminPage } from '../logic/admin.ts';
  import Box from './Box.svelte';
  import RoundArchive from './RoundArchive.svelte';

  let { page }: { page: AdminPage | null } = $props();
</script>

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
        aria-selected="false"
        aria-controls="admin-panel-{tab.panel}"
        tabindex="-1"
        data-act="adminTab"
        data-tab={tab.key}>{tab.label}</button
      >
    {/each}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section id="admin-panel-diagnostics" role="tabpanel" hidden>
    <Box title="Diagnose und Protokoll"><div id="admin-diagnostics"></div></Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-errors"
    role="tabpanel"
    aria-labelledby="admin-tab-errors"
    hidden
  >
    <Box title="Fehler"><div id="admin-errors"></div></Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-invitations"
    role="tabpanel"
    aria-labelledby="admin-tab-invitations"
    hidden
  >
    <Box title="Einladungen">
      <form id="inviteform" class="flex">
        <label for="inv_email">E-Mail-Adresse</label>
        <input id="inv_email" type="email" required autocomplete="off" />
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
            data-nokeep
          />
          <button class="small" data-act="copyLink">Kopieren</button>
        </div>
      {/if}
      <div id="admin-invitations"></div>
    </Box>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section
    id="admin-panel-universe"
    role="tabpanel"
    aria-labelledby="admin-tab-universe"
    hidden
  >
    <Box title="Universum">
      <table class="kv">
        <tbody>
          {#each page.settings.rows as row (row.key)}
            <tr>
              <td><label for="set_{row.key}">{row.label}</label></td>
              <td>
                {#if row.choices}
                  <select id="set_{row.key}" data-setting={row.key} data-nokeep>
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
                    min={row.min}
                    max={row.max}
                    value={row.value}
                    data-nokeep
                  />
                  <span class="dim">{row.range}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
    hidden
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
          required></textarea>
        <p><button type="submit">An alle senden</button></p>
      </form>
    </Box>
  </section>
{/if}
