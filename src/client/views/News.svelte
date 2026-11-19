<script lang="ts">
  // „Neuigkeiten“ (#118, bundle 4; okf/architecture/patterns.md, section 9),
  // from newsPage() of logic/news.ts: the running version and every version
  // of the changelog with its date, newest first.
  import type { NewsPage } from '../logic/news.ts';

  let { page }: { page: NewsPage } = $props();
</script>

<h2>Neuigkeiten</h2>
{#if page.loading}
  <p class="dim">Neuigkeiten werden geladen …</p>
{:else}
  {#if page.running}<p class="dim">{page.running}</p>{/if}
  {#if !page.versions.length}
    <p class="dim">Noch keine Neuigkeiten.</p>
  {/if}
  {#each page.versions as version, v (v)}
    <div class="box news">
      <div class="hd">{version.title}</div>
      <div class="bd">
        {#each version.groups as group (group.label)}
          <h3>{group.label}</h3>
          <ul>
            {#each group.items as item, i (i)}<li>{item}</li>{/each}
          </ul>
        {/each}
      </div>
    </div>
  {/each}
{/if}
