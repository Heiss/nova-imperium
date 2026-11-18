<script lang="ts">
  // A frozen copy of src/client/views/Buildings.svelte before #118, for
  // src/test/catalog-list-reference.test.ts: CatalogList must render the
  // buildings as it did. Only the import paths changed, and resourceName()
  // of views/common.ts is copied below. One change on purpose (review of
  // #209, 2026-11-14): the energy a level needs is compared with
  // production(), as energyShort() does, not with prod(). One of #285
  // (B2): the „?“ opens the Lexicanum, so no text unfolds below the entry
  // and the „?“ shows in every mode but „Ausblenden“. And one with the
  // Raketenkrypta (#54): a building that stores missiles shows the places
  // they take, marked below. Do not change it otherwise.
  import type { Readable } from 'svelte/store';
  import { BUILD, buildable, SILO } from '../../core/catalog.ts';
  import { siloUse } from '../../core/yard.ts';
  import {
    afford,
    buildTime,
    lvlCost,
    prod,
    production,
    reqMissing,
    useAt,
  } from '../../core/economy.ts';
  import { fieldsFull } from '../../core/fields.ts';
  import { energyNeed, energyShort } from '../../core/research.ts';
  import { text } from '../../core/text.ts';
  import { explanation } from '../../client/logic/explain.ts';
  import { fieldsLine } from '../../client/logic/fields.ts';
  import { iconURL } from '../../client/logic/icons.ts';
  import { dur, fmt } from '../../client/logic/format.ts';
  import { buildState } from './states.ts';
  import {
    costHTML,
    requirementsHTML,
    type V,
  } from '../../client/views/common.ts';

  let { viewState }: { viewState: Readable<V> } = $props();
  const resourceName = (r: string): string =>
    ['Adamant', 'Psikristall', 'Promethium'][['m', 'c', 'd'].indexOf(r)]!;
  const energy = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  function energyChange(v: V, key: string, level: number): number {
    const { P, R, s } = v;
    const current = prod(P, s.cfg, R.research);
    const next = prod(
      { ...P, b: { ...P.b, [key]: level + 1 } },
      s.cfg,
      R.research,
    );
    return next.eProd - current.eProd - (next.eUse - current.eUse);
  }

  /** The energy production a level needs (Weltenschmiede, #51), if any. */
  function energyCost(v: V, key: string, level: number) {
    const need = energyNeed(BUILD[key]!, level);
    if (!need) return undefined;
    return { need, production: production(v.P, v.s.cfg, v.R.research).eProd };
  }
</script>

<h2>Gebäude</h2>
<div class="dim" id="fields">
  {fieldsLine($viewState.P, $viewState.s.cfg)}
</div>
<div class="box">
  <!-- Only what stands on this place: a planet or a moon (#53). -->
  {#each Object.entries(BUILD).filter( ([k]) => buildable(k, $viewState.P.kind) ) as [key, def] (key)}
    {@const { P, R, now, s } = $viewState}
    {@const level = P.b[key] ?? 0}
    {@const cost = lvlCost(def, level + 1)}
    {@const delta = energyChange($viewState, key, level)}
    {@const missing = reqMissing(def, P, R)}
    {@const full = fieldsFull(P, s.cfg)}
    {@const short = energyShort(def, level + 1, P, s.cfg, R.research)}
    {@const status = buildState(P, R, key, missing.length, full, short)}
    {@const image = iconURL(key)}
    {@const t = text(key)!}
    {@const ex = explanation(key, t, s.me.explain, $viewState.ui.openEx)}
    <div class="item" class:running={status === 'running'}>
      <div class="icon ic-b">
        {#if image}<img src={image} alt={t.n} />{:else}{t.ab}{/if}
      </div>
      <div>
        <div class="nm">
          {t.n}
          <span class="lv">{level ? `(Stufe ${level})` : ''}</span
          >{#if ex}<button
              type="button"
              class="exq"
              id={ex.button}
              data-act="explain"
              data-k={key}
              aria-expanded={ex.open}
              aria-controls={ex.open ? ex.panel : undefined}
              aria-label={`Erklärung zu ${t.n}`}>?</button
            >{/if}
        </div>
        <div class="ds">{t.ds}</div>
        {@html costHTML(cost, P, 1, energyCost($viewState, key, level + 1))}
        <!-- Changed on purpose (#54): the places of the missiles. -->
        {#if Object.hasOwn(SILO, key)}
          <div class="dim">
            Belegt: {fmt(siloUse(P).used)} / {fmt(siloUse(P).places)} Plätze
          </div>
        {/if}
        {#if delta !== 0}
          <div class="dim">
            Energie auf Stufe {level + 1}: {energy.format(Math.abs(delta))}
            {delta < 0 ? 'mehr Verbrauch' : 'mehr Produktion'}
          </div>
        {/if}
        {#each Object.entries(useAt(key, level + 1, P, s.cfg, R.research)) as [res, use] (res)}
          <div class="dim">
            {resourceName(res)}verbrauch auf Stufe {level + 1}: {energy.format(
              use,
            )} pro Stunde
          </div>
        {/each}
        <div class="dim">Bauzeit: {dur(buildTime(cost, P, s.cfg))}</div>
        {@html requirementsHTML($viewState, def.req)}
      </div>
      <div class="act">
        {#if status === 'running' && P.bq}
          Ausbau auf Stufe {P.bq.lvl}<br />
          <span class="cd" data-end={P.bq.end}>{dur(P.bq.end - now)}</span>
          <progress
            max={P.bq.end - P.bq.start}
            value={Math.min(now - P.bq.start, P.bq.end - P.bq.start)}
            aria-label="Fortschritt Ausbau"
          ></progress>
          <button class="small red" data-act="cancelBuild">Abbrechen</button>
        {:else if status === 'missing'}
          <span class="req">Das Wissen ist noch verschlossen</span>
        {:else if status === 'queueBusy'}
          <span class="dim">Bauschleife belegt</span>
        {:else if status === 'yardBusy'}
          <span class="dim">Schiffsschmiede arbeitet gerade</span>
        {:else if status === 'labBusy'}
          <span class="dim">Scholarium forscht gerade</span>
        {:else if status === 'full'}
          <span class="req">Keine freien Felder.</span>
        {:else if status === 'noEnergy'}
          <span class="req">Zu wenig Energie: es fehlen {fmt(short)}</span>
        {:else}
          <button data-act="build" data-k={key} disabled={!afford(P, cost)}>
            {level ? `Ausbauen auf Stufe ${level + 1}` : 'Bauen'}
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>
