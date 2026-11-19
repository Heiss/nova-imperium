<script lang="ts">
  // „Optionen“ (#118, bundle 5; okf/architecture/patterns.md, section 9),
  // from optionsPage() of logic/options.ts. The ids, the `data-act`s and the
  // forms are those that features/ and main.ts read (options.ts, playtime.ts,
  // passkeys.ts, install.ts, push.ts, report-problem.ts, round-archive.ts).
  // `#own-activity`, `#passkey-list` and `#pwa-install` are plain elements: a
  // feature fills or shows them after each render.
  import { PUSH_KINDS_LEGEND, PUSH_KINDS_NOTE } from '../logic/push-options.ts';
  import { OWN_ACTIVITY_LOADING } from '../logic/own-activity.ts';
  import type { OptionsPage } from '../logic/options.ts';
  import Box from './Box.svelte';

  let { page }: { page: OptionsPage } = $props();
</script>

<h2>Optionen</h2>
<Box title="Optionen">
  <div class="flex">
    Spähschädel pro Auspex-Erkundung von der Sternenkarte:
    <input
      type="number"
      id="o_probes"
      min="1"
      value={page.probes}
      aria-label="Spähschädel pro Auspex-Erkundung"
    />
  </div>
  <div class="flex mt">
    <label for="o_explain">(?)-Symbol:</label>
    <select id="o_explain">
      {#each page.explain as choice (choice.value)}
        <option value={choice.value} selected={choice.selected}
          >{choice.label}</option
        >
      {/each}
    </select>
  </div>
  <div class="flex mt">
    <label for="o_levels">Stufenübersicht:</label>
    <select id="o_levels">
      {#each page.levels as choice (choice.value)}
        <option value={choice.value} selected={choice.selected}
          >{choice.label}</option
        >
      {/each}
    </select>
  </div>
  <p><button data-act="saveopt">Speichern</button></p>
</Box>
<Box title="Hauptplanet">
  <p>{page.main.intro}</p>
  <div class="flex">
    <label for="o_main">Hauptplanet</label>
    <select id="o_main" disabled={page.main.locked}>
      {#each page.main.options as option (option.id)}
        <option value={option.id} selected={option.selected}
          >{option.label}</option
        >
      {/each}
    </select>
    <button data-act="mainPlanet" disabled={page.main.locked}>Ändern</button>
  </div>
  {#if page.main.note}<p id="o_main_lock">{page.main.note}</p>{/if}
</Box>
<Box title="Urlaubsmodus">
  <p>{page.vacation}</p>
  <p>
    Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und
    weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.
  </p>
  <button data-act="startVacation">Urlaubsmodus aktivieren</button>
</Box>
<Box title="Meine Aktivität &amp; Spielzeit">
  <div id="own-activity" aria-live="polite">{OWN_ACTIVITY_LOADING}</div>
  <p>
    <button type="button" data-act="reloadOwnActivity">Aktualisieren</button>
  </p>
</Box>
<Box title="Rundenarchiv">{@html page.archive}</Box>
<Box title="Darstellung">
  <label class="switch"
    ><input type="checkbox" id="o_anim" checked={page.animations} /> Animationen</label
  >
  <p class="dim">
    Planeten drehen sich, Wolken ziehen. Gilt für dieses Gerät; ist im System
    „Bewegung reduzieren“ eingestellt, bleibt alles ruhig.
  </p>
</Box>
<Box title="Passwort ändern">
  <form id="passwordform" class="flex">
    <label for="pw_current">Bisheriges Passwort</label>
    <input
      id="pw_current"
      type="password"
      autocomplete="current-password"
      required
    />
    <label for="pw_next">Neues Passwort</label>
    <input
      id="pw_next"
      type="password"
      autocomplete="new-password"
      minlength={page.passwordMinLength}
      required
    />
    <label for="pw_confirm">Neues Passwort wiederholen</label>
    <input
      id="pw_confirm"
      type="password"
      autocomplete="new-password"
      minlength={page.passwordMinLength}
      required
    />
    <button type="submit">Passwort ändern</button>
  </form>
</Box>
<Box title="Passkeys">
  <p>Auf unterstützten Geräten kannst du dich mit einem Passkey anmelden.</p>
  <form id="passkeyform" class="flex">
    <label for="passkey-password">Passwort für neuen Passkey</label><input
      id="passkey-password"
      type="password"
      autocomplete="current-password"
      required
    /><button type="submit">Passkey hinzufügen</button>
  </form>
  <p>
    <button type="button" data-act="listPasskeys"
      >Gespeicherte Passkeys anzeigen</button
    >
  </p>
  <div id="passkey-list"></div>
</Box>
<Box title="App installieren">
  <p>
    Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm
    hinzufügen“. Auf iPhone und iPad öffne Nova Imperium in Safari, tippe auf
    „Teilen“ und wähle „Zum Home-Bildschirm“ und „Als Web-App öffnen“. Zum
    Spielen brauchst du eine Internetverbindung.
  </p>
  <button data-act="installApp" id="pwa-install" hidden>App installieren</button
  >
</Box>
{#if page.pushKinds}
  <Box title="Benachrichtigungen">
    <p>{PUSH_KINDS_NOTE}</p>
    <fieldset class="push-kinds">
      <legend>{PUSH_KINDS_LEGEND}</legend>
      {#each page.pushKinds as kind (kind.topic)}<label class="switch"
          ><input
            type="checkbox"
            id={kind.id}
            data-chg="push"
            data-k={kind.topic}
            checked={kind.checked}
          />
          {kind.label}</label
        >{/each}
    </fieldset>
  </Box>
{/if}
<Box title="Browser-Benachrichtigungen">
  <p>Meldungen zu Aufträgen, Flotten und neuen Nachrichten auf diesem Gerät.</p>
  <button data-act="pushEnable">Aktivieren</button>
  <button data-act="pushDisable">Deaktivieren</button>
</Box>
<Box title="Problem melden">
  <form id="reportform" class="report-form">
    <input type="hidden" name="source" value="form" /><input
      type="hidden"
      name="page"
      value={page.report.page}
    /><input type="hidden" name="version" value={page.report.version} /><input
      type="hidden"
      name="requestId"
      value={page.report.requestId}
    /><input type="hidden" name="message" value="" />
    <p class="dim">{page.report.context}</p>
    <label for="reportform-text">Was ist passiert?</label><br />
    <textarea
      id="reportform-text"
      name="text"
      maxlength={page.report.max}
      rows="4"
      required></textarea>
    <p><button type="submit">Absenden</button></p>
  </form>
</Box>
<Box title="Account löschen">
  <p>{page.deleteAccount}</p>
  <button type="button" class="red" data-act="deleteAccount"
    >Account löschen</button
  >
</Box>
<p>
  Tempo, Größe und alle Einstellungen dieser Runde stehen im Lexicanum:
  <a
    class="lx-a"
    href={page.universe.href}
    data-act="lex"
    data-a={page.universe.article}>Dieses Universum</a
  >.
</p>
