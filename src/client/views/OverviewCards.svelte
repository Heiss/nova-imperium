<script lang="ts">
  // Phone: the cards „Läuft“, „Achtung“ and „Bereit“ above the rest of the
  // overview (#189, D5), from overviewCards() of logic/overview-cards.ts. The
  // CSS shows them up to 760 px only (class phone-only); the desktop keeps the
  // overview as it was. A link carries data-act="nav", which main.ts handles.
  import { type CardItem, overviewCards } from '../logic/overview-cards.ts';
  import type { V } from './common.ts';
  import Due from './Due.svelte';

  let { v }: { v: V } = $props();
  const cards = $derived(overviewCards(v));
</script>

{#snippet link(to: CardItem['link'])}
  {#if to}<a href="?view={to.view}" data-act="nav" data-v={to.view}
      >{to.label}</a
    >{/if}
{/snippet}

<section class="cards phone-only" aria-label="Läuft, Achtung und Bereit">
  <div class="card run">
    <h3>Läuft</h3>
    {#if cards.running.length}
      <ul>
        {#each cards.running as item (item.label)}
          <li>
            <span class="what"
              ><span class="dim">{item.label}</span> {item.what}</span
            >
            <span class="when"
              ><Due due={item.due} />{#if item.next}{' '}(nächste){/if}</span
            >
            <progress
              max={item.max}
              value={item.value}
              aria-label="Fortschritt {item.label}"
            ></progress>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="dim">Es läuft gerade nichts.</p>
    {/if}
  </div>
  {#if cards.attention.length}
    <div class="card warn">
      <h3>Achtung</h3>
      <ul>
        {#each cards.attention as item (item.text)}
          <li>
            <span class="what bad">{item.text}</span>
            {#if item.due}<span class="when"><Due due={item.due} /></span>{/if}
            {@render link(item.link)}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if cards.ready.length}
    <div class="card go">
      <h3>Bereit</h3>
      <ul>
        {#each cards.ready as item (item.text)}
          <li>
            <span class="what">{item.text}</span>
            {@render link(item.link)}
            {#if item.select}<button
                type="button"
                class="small"
                data-act="selectPlanet"
                data-id={item.select.id}>{item.select.label}</button
              >{/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
