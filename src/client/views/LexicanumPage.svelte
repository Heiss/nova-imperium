<script lang="ts">
  // The page of the Lexicanum (#285): the path, the search, and the start
  // page (the boxes „Einstieg“, „Regeln“ and „Häufige Fragen“ of #288 and
  // #289, then „Nachschlagen“ with the kinds and „Begriffe A–Z“), a list, or an
  // article with „Auf dieser Seite“ and the other articles of its kind.
  // The address holds the article (lexicanum-state.svelte.ts), so a link
  // can be shared and „back“ works. Loaded as its own chunk (#242).
  import { articleHref } from '../logic/address.ts';
  import { crumbs, page } from '../logic/lexicanum.ts';
  import { client } from '../logic/state.svelte.ts';
  import { lex } from './lexicanum-state.svelte.ts';
  import LexicanumArticle from './LexicanumArticle.svelte';
  import LexicanumSearch from './LexicanumSearch.svelte';

  const v = $derived(client.shown);
  const p = $derived(v && page(lex.article, v));
</script>

{#snippet items(
  list: { id: string; title: string; ab?: string; line: string }[],
)}
  <ul class="bd lx-list">
    {#each list as item (item.id)}
      <li>
        <a
          class="lx-a"
          href={articleHref(item.id)}
          data-act="lex"
          data-a={item.id}>{item.title}</a
        >{#if item.ab}
          <span class="lx-ab">{item.ab}</span>{/if}
        {#if item.line}<span class="dim"> · {item.line}</span>{/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if v && p}
  <div class="lx">
    <h2>Lexicanum</h2>
    <div class="lx-top">
      <div class="lx-crumb">
        {#each crumbs(p) as crumb, i (i)}{#if i}{' › '}{/if}{#if crumb.id !== null}<a
              class="lx-a"
              href={articleHref(crumb.id)}
              data-act="lex"
              data-a={crumb.id}>{crumb.text}</a
            >{:else}<b aria-current="page">{crumb.text}</b>{/if}{/each}
      </div>
      <LexicanumSearch />
    </div>
    {#if p.t === 'start'}
      {#each p.boxes as box (box.kind)}
        <div class="box">
          <h3 class="hd">{box.title}</h3>
          {@render items(box.items)}
        </div>
      {/each}
      <div class="box">
        <h3 class="hd">Nachschlagen</h3>
        <div class="bd lx-cats">
          {#each p.tiles as tile (tile.id)}
            <a
              class="lx-cat"
              href={articleHref(tile.id)}
              data-act="lex"
              data-a={tile.id}><b>{tile.title}</b><span>{tile.note}</span></a
            >
          {/each}
        </div>
      </div>
    {:else if p.t === 'list'}
      <div class="box">
        <h3 class="hd">{p.title}</h3>
        {@render items(p.items)}
      </div>
    {:else}
      <div class="lx-cols">
        <LexicanumArticle article={p.article} P={v.P} />
        <aside class="lx-side">
          {#if p.article.sections.some((s) => s.title)}
            <nav class="lx-toc" aria-labelledby="lx-toc-title">
              <b id="lx-toc-title">Auf dieser Seite</b>
              {#each p.article.sections as section (section.id)}{#if section.title}<a
                    href="#lx-{section.id}">{section.title}</a
                  >{/if}{/each}
            </nav>
          {/if}
          <nav class="lx-toc" aria-labelledby="lx-kind-title">
            <b id="lx-kind-title">{p.article.kindTitle}</b>
            {#each p.article.siblings as sibling (sibling.id)}
              <a
                href={articleHref(sibling.id)}
                class:on={sibling.id === p.article.id}
                aria-current={sibling.id === p.article.id ? 'page' : undefined}
                data-act="lex"
                data-a={sibling.id}>{sibling.title}</a
              >
            {/each}
          </nav>
        </aside>
      </div>
    {/if}
  </div>
{/if}
