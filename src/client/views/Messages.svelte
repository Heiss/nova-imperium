<script lang="ts">
  // „Nachrichten“ (#118, bundle 4; okf/architecture/patterns.md, section 9),
  // from messagesPage() of logic/messages.ts: the reports, newest first. The
  // buttons carry data-act (features/reports.ts). The bodies of battle,
  // espionage and survey reports are components (#330, ReportBody.svelte).
  import type { MessagesPage } from '../logic/messages.ts';
  import ReportBody from './ReportBody.svelte';

  // `heading` is false inside the tabs of MessagesTabs, which has the heading.
  let { page, heading = true }: { page: MessagesPage; heading?: boolean } =
    $props();
</script>

{#if heading}<h2>Nachrichten</h2>{/if}
<div class="box">
  <div class="hd flex between">
    Berichte ({page.count})
    {#if page.count}<button class="small red" data-act="delall"
        >Alle löschen</button
      >{/if}
  </div>
  {#each page.rows as report (report.id)}
    <div
      class="rep {report.fresh ? 'new' : ''} {report.open ? 'open' : ''}"
      id="rep_{report.id}"
    >
      <div class="t" data-act="toggleRep" data-id={report.id}>
        <b>{report.title}</b><span class="dim"
          >{report.time}
          <span class="lnk" data-act="delrep" data-id={report.id}>löschen</span
          ></span
        >
      </div>
      <div class="b">
        {#if report.body.kind === 'report'}
          <ReportBody body={report.body.body} />
        {:else if report.body.kind === 'update'}
          <div>
            {#each report.body.lines as line, i (i)}{#if i}<br
                />{/if}{line}{/each}
          </div>
          <p>
            <a href={report.body.link} data-act="nav" data-v="news"
              >Zu den Neuigkeiten</a
            >
          </p>
        {:else}
          <div>{report.body.text}</div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="bd dim">Keine Nachrichten.</div>
  {/each}
</div>
