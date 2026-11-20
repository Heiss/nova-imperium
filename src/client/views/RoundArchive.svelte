<script lang="ts">
  // The round archive (#235; #118, bundle 7; okf/architecture/patterns.md,
  // section 9), from archivePage() of logic/round-archive.ts: the content of
  // the box „Rundenarchiv“ of „Optionen“ and of the admin box
  // „Rundenberichte“. The `data-act`s are those of features/round-archive.ts;
  // the classes of the tables (`scores`, `kv`, `n`, `me`) those of style.css.
  import type { ArchivePage } from '../logic/round-archive.ts';
  import RoundRewind from './RoundRewind.svelte';

  let { page }: { page: ArchivePage } = $props();
  const body = $derived(page.body);
</script>

{#snippet facts(list: [string, string][])}
  <table class="kv">
    <tbody>
      {#each list as [name, value] (name)}
        <tr><td>{name}</td><td>{value}</td></tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#if page.close}
  <p>
    „Runde abschließen“ speichert die laufende Runde im Archiv. Das Spiel läuft
    danach weiter, bis du eine neue Runde startest; „Neue Runde“ schließt eine
    noch laufende Runde selbst ab. Die Endzeit schließt keine Runde ab.
  </p>
  <p><button class="red" data-act="roundClose">Runde abschließen</button></p>
{/if}
{#if body.kind === 'participant'}
  {@const who = body.participant}
  <p>
    <button class="small" data-act="roundPersonBack">Zurück zum Bericht</button>
  </p>
  <h3 id="round-participant-h" tabindex="-1">{who.heading}</h3>
  {#if who.banner}<div class="notice">{who.banner}</div>{/if}
  {@render facts(who.facts)}
  <h4>Planeten und Monde</h4>
  <table class="scores">
    <tbody>
      <tr><th>Ort</th><th>Gebäude</th><th>Schiffe</th><th>Verteidigung</th></tr>
      {#each who.places as place (place.where)}
        <tr
          ><td>{place.where}</td><td>{place.buildings}</td><td>{place.ships}</td
          ><td>{place.defense}</td></tr
        >
      {/each}
    </tbody>
  </table>
{:else if body.kind === 'report'}
  {@const report = body.report}
  <p>
    <button class="small" data-act="roundBack">Zurück zum Archiv</button
    >{#if report.refresh !== null}{' '}<button
        class="small"
        data-act="roundRefresh"
        data-round={report.refresh}>Vorschau aktualisieren</button
      >{/if}
  </p>
  <h3 id="round-report-h" tabindex="-1">{report.heading}</h3>
  {#if report.banner}<div class="notice">{report.banner}</div>{/if}
  {@render facts(report.facts)}
  <div class="flex" role="group" aria-labelledby="round-report-h">
    {#each report.categories as category (category.key)}
      <button
        type="button"
        data-act="roundCat"
        data-cat={category.key}
        aria-pressed={category.pressed}>{category.label}</button
      >
    {/each}
  </div>
  <table class="scores">
    <tbody>
      <tr>
        <th class="n">Platz</th><th>Spieler</th><th class="n"
          >{report.column}</th
        ><th class="n">Wirtschaft/h</th><th class="n">Planeten</th><th class="n"
          >Monde</th
        >{#if report.playtime}<th class="n">Spielzeit</th>{/if}<th>Gilde</th
        >{#if report.detail}<th></th>{/if}
      </tr>
      {#each report.rows as row (row.place)}
        <tr class={row.me ? 'me' : ''}>
          <td class="n">{row.place}</td><td>{row.name}</td><td class="n"
            >{row.points}</td
          ><td class="n">{row.economy}</td><td class="n">{row.planets}</td><td
            class="n">{row.moons}</td
          >{#if row.played !== null}<td class="n">{row.played}</td>{/if}<td
            >{row.guild}</td
          >{#if report.detail}<td
              ><button
                class="small"
                data-act="roundPerson"
                data-round={report.round}
                data-seat={row.seat}>Einblick</button
              ></td
            >{/if}
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="dim">{report.note}</div>
  {#if report.playtimeNote}
    {#if report.playtimeNote.block === 'div'}
      <div class="dim">{report.playtimeNote.text}</div>
    {:else}
      <p class="dim">{report.playtimeNote.text}</p>
    {/if}
  {/if}
  {#if report.guilds.length}
    <h4>Gilden</h4>
    <table class="scores">
      <tbody>
        <tr
          ><th>Gilde</th><th class="n">Mitglieder</th><th class="n"
            >Punkte (Summe)</th
          ></tr
        >
        {#each report.guilds as guild (guild.name)}
          <tr
            ><td>{guild.name}</td><td class="n">{guild.members}</td><td
              class="n">{guild.points}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  {/if}
  <details>
    <summary>Einstellungen dieser Runde</summary>
    {#if report.rules.length}
      <ul>
        {#each report.rules as rule (rule)}<li>{rule}</li>{/each}
      </ul>
    {:else}
      <p class="dim">Alle Einstellungen standen auf der Voreinstellung.</p>
    {/if}
  </details>
{:else if body.kind === 'rewind'}
  <RoundRewind page={body.rewind} />
{:else if body.kind === 'error'}
  <p class="notice">{body.message}</p>
{:else if body.kind === 'loading'}
  <p class="dim">Das Archiv wird geladen …</p>
{:else}
  {#if page.intro}
    <p>
      Jede beendete Runde, an der du teilgenommen hast, bleibt hier mit ihrem
      Bericht stehen. Die laufende Runde ist bis zu ihrem Ende gesperrt.
    </p>
  {/if}
  {#if body.rounds.length}
    <table class="scores">
      <tbody>
        <tr><th class="n">Runde</th><th>Zeitraum</th><th>Stand</th><th></th></tr
        >
        {#each body.rounds as round (round.number)}
          <tr>
            <td class="n">{round.number}</td><td>{round.span}</td><td
              >{round.status}</td
            ><td
              >{#if round.open}<button
                  class="small"
                  data-act="roundOpen"
                  data-round={round.number}>Bericht öffnen</button
                >{/if}{#if round.rewind}{' '}<button
                  class="small"
                  data-act="rewindOpen"
                  data-round={round.number}>Rewind ansehen</button
                >{/if}{#if round.remove}{' '}<button
                  class="small red"
                  data-act="roundDelete"
                  data-round={round.number}>Löschen</button
                >{/if}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="dim">Noch keine Runde im Archiv.</p>
  {/if}
  {#if body.history.length}
    <h3>Rundenvergleich</h3>
    <table class="scores">
      <tbody>
        <tr>
          <th class="n">Runde</th><th class="n">Tage</th><th class="n"
            >Teilnehmer</th
          ><th>Sieger (Punkte)</th><th class="n">Dein Platz</th><th class="n"
            >Deine Punkte</th
          ><th class="n">Wirtschaft/h</th><th class="n">Planeten</th><th
            >Einstellungen</th
          >
        </tr>
        {#each body.history as h (h.number)}
          <tr>
            <td class="n">{h.number}</td><td class="n">{h.days}</td><td
              class="n">{h.participants}</td
            ><td>{h.winner}</td><td class="n">{h.place}</td><td class="n"
              >{h.points}</td
            ><td class="n">{h.economy}</td><td class="n">{h.planets}</td><td
              >{h.settings}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}
