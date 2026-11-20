<script lang="ts">
  // „Marktplatz“ (#118, bundle 7; #171, okf/features/marketplace.md;
  // okf/architecture/patterns.md, section 9), from marketPage() of
  // logic/market-page.ts: the notice while the market is closed or the planet
  // has no Handelsposten, else the form: what to give, what to get, the
  // amount with „max“, the preview and „Tauschen“. features/market.ts reads
  // the form by its ids and writes the list of what to get and the preview
  // into their places while the player types. Those two lists and the preview
  // are HTML (`{@html}`) so that the form writes them with the same
  // functions.
  import type { MarketPage } from '../logic/market-page.ts';
  import Box from './Box.svelte';

  let { page }: { page: MarketPage } = $props();
</script>

<h2>Marktplatz</h2>
{#if page.kind === 'notice'}
  <div class="notice">{page.text}</div>
{:else}
  <Box title="Tauschen">
    <form id="marketform">
      <p>
        <label for="market-give">Du gibst</label>
        <select id="market-give">{@html page.giveOptions}</select>
      </p>
      <p>
        <label for="market-get">Du erhältst</label>
        <select id="market-get">{@html page.getOptions}</select>
      </p>
      <p>
        <label for="market-amount">Menge</label>
        <input
          type="number"
          id="market-amount"
          min="1"
          step="1"
          inputmode="numeric"
          autocomplete="off"
          value={page.amount}
        />
        <button type="button" data-act="marketMax">max</button>
      </p>
      <div id="market-preview" role="status">{@html page.preview}</div>
      <p>
        <button type="submit" id="market-trade" disabled={!page.ok}
          >Tauschen</button
        >
      </p>
    </form>
  </Box>
{/if}
