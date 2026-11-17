<script lang="ts">
  // One article of the Lexicanum (#285), the same on the page and in the
  // side panel: the head with icon, name, abbreviation, kind, own level and
  // short text, the long text as the introduction (#63), the values of a
  // unit as in the lists, then its sections from articleView() of
  // logic/lexicanum.ts.
  import type { Planet } from '../../core/types.ts';
  import { articleHref } from '../logic/address.ts';
  import type { ArticleView } from '../logic/lexicanum.ts';
  import { costHTML } from './common.ts';
  import LevelTable from './LevelTable.svelte';
  import LexicanumText from './LexicanumText.svelte';

  let {
    article,
    P,
    panel = false,
  }: { article: ArticleView; P: Planet; panel?: boolean } = $props();

  /** Ids of the sections, apart on the page and in the panel. */
  const sectionId = (id: string): string => `${panel ? 'lxp' : 'lx'}-${id}`;
  const act = $derived(panel ? 'lexPanel' : 'lex');
</script>

<article class="lx-art" aria-labelledby={sectionId('title')}>
  <div class="lx-head" class:lx-plain={!article.icon && !article.ab}>
    {#if article.icon || article.ab}
      <div class="icon {article.cls} lx-icon">
        {#if article.icon}<img
            src={article.icon}
            alt=""
          />{:else}{article.ab}{/if}
      </div>
    {/if}
    <div>
      <h3 class="lx-title" id={sectionId('title')}>
        {article.title}
        {#if article.ab}<span class="lx-ab">{article.ab}</span>{/if}
      </h3>
      <div class="dim">
        {article.kindTitle}{#if article.own}
          · <span class="lx-have">{article.own}</span>{/if}
      </div>
      {#if article.ds}<p class="lx-ds">{article.ds}</p>{/if}
    </div>
  </div>
  {#if article.intro.length}
    <div class="lx-intro">
      {#each article.intro as text, i (i)}<p>{text}</p>{/each}
    </div>
  {/if}
  {#if article.cost}{@html costHTML(article.cost, P)}{/if}
  {#each article.lines as line, i (i)}<div class="dim">{line}</div>{/each}
  {#each article.sections as section (section.id)}
    <section
      aria-labelledby={section.title ? sectionId(section.id) : undefined}
    >
      {#if section.title}<h4 id={sectionId(section.id)}>
          {section.title}
        </h4>{/if}
      {#each section.blocks as block, i (i)}
        {#if block.t === 'text'}
          <p><LexicanumText parts={block.parts} {panel} /></p>
        {:else if block.t === 'formula'}
          <div class="lx-f">
            <span>Formel</span>
            {#each block.lines as line, j (j)}<div>{line}</div>{/each}
          </div>
        {:else if block.t === 'chips'}
          <ul class="lx-tiers">
            {#each block.items as chip, j (j)}<li>
                <b>{chip.label}</b>{chip.text}
              </li>{/each}
          </ul>
        {:else if block.t === 'stand'}
          <p class="lx-me">{block.text}</p>
        {:else if block.t === 'facts'}
          <dl class="lx-facts">
            {#each block.items as fact, j (j)}
              <dt>{fact.label}</dt>
              <dd><LexicanumText parts={fact.parts} {panel} /></dd>
            {/each}
          </dl>
        {:else if block.t === 'links'}
          <ul class="lx-links">
            {#each block.items as link (link.id)}<li>
                <a
                  class="lx-a"
                  href={articleHref(link.id)}
                  data-act={act}
                  data-a={link.id}>{link.text}</a
                >{#if link.note}<span
                    class={link.note === 'erfüllt' ? 'lx-ok' : 'lx-note'}
                    >{link.note}</span
                  >{/if}
              </li>{/each}
          </ul>
        {:else if block.t === 'levels'}
          <LevelTable table={block.table} {P} />
        {:else if block.t === 'table'}
          <div class="lx-scroll">
            <table class="lx-t">
              {#if block.caption}<caption>{block.caption}</caption>{/if}
              <thead>
                <tr>
                  {#each block.head as head, j (j)}<th
                      scope="col"
                      class:n={j > 0}>{head}</th
                    >{/each}
                </tr>
              </thead>
              <tbody>
                {#each block.rows as row, j (j)}
                  <tr class:lx-cur={row.mark}>
                    {#each row.cells as c, k (k)}
                      {#if k === 0}
                        <th scope="row"
                          >{#if c.link}<a
                              class="lx-a"
                              href={articleHref(c.link)}
                              data-act={act}
                              data-a={c.link}>{c.text}</a
                            >{:else}{c.text}{/if}</th
                        >
                      {:else}
                        <td class:n={c.num || k > 0}>{c.text}</td>
                      {/if}
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/each}
    </section>
  {/each}
</article>
