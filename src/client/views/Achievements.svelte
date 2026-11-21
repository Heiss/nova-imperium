<script lang="ts">
  // „Achievements“ and, in a round with the daily reward only,
  // „Belohnungen“ (#118, bundle 5; okf/architecture/patterns.md, section 9),
  // from achievementsPage() of logic/achievements.ts: the daily reward, the
  // filter and the groups. The filter keeps its fields in
  // logic/achievement-filter.svelte.ts (#332); the filtering, the buttons and
  // the ids belong to features/achievements.ts, the attributes `data-later`, `data-fold` and
  // `data-all` to the phone layout of style.css (#189).
  import { achievementFilter } from '../logic/achievement-filter.svelte.ts';
  import type { AchievementsPage } from '../logic/achievements.ts';

  let { page }: { page: AchievementsPage } = $props();
</script>

<h2>{page.title}</h2>
{#if page.daily}
  <div class="box">
    <div class="hd">Tägliche Belohnung</div>
    <div class="bd">
      <p>{page.daily.streak}</p>
      <p>{page.daily.day}</p>
      <p data-daily-reward>
        {page.daily.today}
        {#if page.daily.claimed}<b>Abgeholt</b>{:else}<button
            data-act="dailyClaim">Tagesbelohnung abholen</button
          >{/if}
      </p>
      <p>{page.daily.tomorrow}</p>
    </div>
  </div>
{/if}
{#if page.list}
  <div class="box">
    <div class="hd">Filtern</div>
    <div class="bd">
      <div class="flex">
        <label for="achievement_search">Suchen</label>
        <input
          id="achievement_search"
          type="search"
          bind:value={achievementFilter.search}
        />
        <label for="achievement_category">Kategorie</label>
        <select
          id="achievement_category"
          bind:value={achievementFilter.category}
        >
          <option value="">Alle</option>
          {#each page.list.filter.categories as choice (choice.key)}
            <option value={choice.key}>{choice.label}</option>
          {/each}
        </select>
        <label for="achievement_status">Status</label>
        <select id="achievement_status" bind:value={achievementFilter.status}>
          <option value="">Alle</option>
          {#each page.list.filter.statuses as choice (choice.key)}
            <option value={choice.key}>{choice.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>
  {#each page.list.groups as group (group.status)}
    <section
      data-achievement-group
      data-fold={group.fold?.group}
      data-all={group.fold?.all ? '' : undefined}
    >
      <div class="box">
        <div class="hd">{group.title}</div>
        <div class="bd">
          {#if group.fold}<button
              type="button"
              class="fold-all phone-only"
              data-act="achFold"
              data-g={group.fold.group}
              aria-expanded={group.fold.all}>{group.fold.label}</button
            >{/if}{#each group.rows as row (row.id)}
            <article
              data-achievement
              data-later={row.later ? '' : undefined}
              data-category={row.category}
              data-status={row.status}
              data-search={row.search}
            >
              <p>
                <b>{row.title}</b> · {row.label} · {row.progress} / {row.target}<br
                />
                <span class="dim">Belohnung: {row.reward}</span>
                {#if row.status === 'ready'}<button
                    data-act="achievementClaim"
                    data-id={row.id}>Abholen</button
                  >{/if}
              </p>
            </article>
          {:else}
            <p>Keine Einträge.</p>
          {/each}
        </div>
      </div>
    </section>
  {/each}
{/if}
