<script lang="ts">
  // „Marktplatz“ (#118, bundle 7; #171, okf/features/marketplace.md;
  // okf/architecture/patterns.md, section 9), from marketPage() of
  // logic/market-page.ts: the notice while the market is closed or the planet
  // has no Handelsposten, else the form: what to give, what to get, the
  // amount with „max“, the preview and „Tauschen“. The fields are the state of
  // logic/market-form.svelte.ts (#332): the form binds them, the preview
  // follows them, and features/market.ts reads them when „Tauschen“ sends and
  // writes the amount for „max“. The preview is MarketPreview.svelte (#337).
  import { RES_NAME, TRADED } from '../../core/market.ts';
  import type { Res } from '../../core/market.ts';
  import { chooseGive, draft } from '../logic/market-form.svelte.ts';
  import type { MarketPage } from '../logic/market-page.ts';
  import { fixed, preview, targets } from '../logic/market.ts';
  import Box from './Box.svelte';
  import MarketPreview from './MarketPreview.svelte';

  let { page }: { page: MarketPage } = $props();
  // Never gets what it gives: the first other resource then.
  const shown = $derived(fixed(draft));
</script>

<h2>Marktplatz</h2>
{#if page.kind === 'notice'}
  <div class="notice">{page.text}</div>
{:else}
  {@const p = preview(page.market, shown)}
  <Box title="Tauschen">
    <form id="marketform">
      <p>
        <label for="market-give">Du gibst</label>
        <select id="market-give" bind:value={() => draft.give, chooseGive}>
          {#each TRADED as r (r)}<option value={r}>{RES_NAME[r]}</option>{/each}
        </select>
      </p>
      <p>
        <label for="market-get">Du erhältst</label>
        <select
          id="market-get"
          bind:value={() => shown.get, (r: Res) => (draft.get = r)}
        >
          {#each targets(shown.give) as r (r)}<option value={r}
              >{RES_NAME[r]}</option
            >{/each}
        </select>
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
          value={draft.amount}
          oninput={(e) => (draft.amount = e.currentTarget.value)}
        />
        <button type="button" data-act="marketMax">max</button>
      </p>
      <div id="market-preview" role="status"><MarketPreview {p} /></div>
      <p>
        <button type="submit" id="market-trade" disabled={!p.ok}
          >Tauschen</button
        >
      </p>
    </form>
  </Box>
{/if}
