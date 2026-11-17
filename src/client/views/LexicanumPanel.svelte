<script lang="ts">
  // The side panel of the Lexicanum on a desktop (#285): the „?“ of a list
  // entry opens its article over the list, in place of the text that
  // unfolded below the entry (#63). No search (E); „Im Lexicanum öffnen“
  // opens the same article on the page; Esc and „Schließen“ close it and
  // give the focus back to the „?“. Loaded as its own chunk (#242).
  import { tick } from 'svelte';
  import { articleHref } from '../logic/address.ts';
  import { PANEL_ID } from '../logic/explain.ts';
  import { articleView } from '../logic/lexicanum.ts';
  import { client } from '../logic/state.svelte.ts';
  import { lex } from './lexicanum-state.svelte.ts';
  import { closePanel } from './lexicanum-nav.ts';
  import LexicanumArticle from './LexicanumArticle.svelte';

  const v = $derived(client.shown);
  const article = $derived(v && lex.panel ? articleView(lex.panel, v) : null);
  let panel: HTMLElement | undefined = $state();

  // A new article takes the focus, as a page would (keyboard, screen reader).
  $effect(() => {
    if (article?.id) void tick().then(() => panel?.focus());
  });

  function onkeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && lex.panel) closePanel();
  }
</script>

<svelte:window {onkeydown} />

{#if v && article}
  <aside
    class="lx-drawer"
    id={PANEL_ID}
    tabindex="-1"
    aria-labelledby="lxp-title"
    bind:this={panel}
  >
    <div class="lx-dhead">
      <div class="lx-crumb">
        Lexicanum › <b>{article.title}</b>
      </div>
      <div class="flex">
        <a
          class="lx-a"
          href={articleHref(article.id)}
          data-act="lex"
          data-a={article.id}>Im Lexicanum öffnen ↗</a
        >
        <button type="button" class="small" data-act="lexClose"
          >Schließen</button
        >
      </div>
    </div>
    <div class="lx">
      <LexicanumArticle {article} P={v.P} panel />
    </div>
  </aside>
{/if}
