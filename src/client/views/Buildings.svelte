<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { BUILD } from '../../shared/catalog.ts';
  import {
    afford,
    buildTime,
    fusionUse,
    lvlCost,
    prod,
    reqMissing,
  } from '../../shared/economy.ts';
  import { explanation } from '../logic/explain.ts';
  import { iconURL } from '../logic/icons.ts';
  import { dur } from '../logic/format.ts';
  import { buildState } from '../logic/game.ts';
  import { costHTML, requirementsHTML, type V } from './common.ts';

  let { viewState }: { viewState: Readable<V> } = $props();
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
</script>

<h2>Gebäude</h2>
<div class="box">
  {#each Object.entries(BUILD) as [key, def] (key)}
    {@const { P, R, now, s } = $viewState}
    {@const level = P.b[key] ?? 0}
    {@const cost = lvlCost(def, level + 1)}
    {@const delta = energyChange($viewState, key, level)}
    {@const missing = reqMissing(def, P, R)}
    {@const status = buildState(P, R, key, missing.length)}
    {@const image = iconURL(key)}
    {@const ex = explanation(key, def, s.me.explain, $viewState.ui.openEx)}
    <div class="item" class:running={status === 'running'}>
      <div class="icon ic-b">
        {#if image}<img src={image} alt={def.n} />{:else}{def.ab}{/if}
      </div>
      <div>
        <div class="nm">
          {def.n}
          <span class="lv">{level ? `(Stufe ${level})` : ''}</span
          >{#if ex?.toggle}<button
              type="button"
              class="exq"
              id={ex.button}
              data-act="explain"
              data-k={key}
              aria-expanded={ex.open}
              aria-controls={ex.panel}
              aria-label={`Erklärung zu ${def.n}`}>?</button
            >{/if}
        </div>
        <div class="ds">{def.ds}</div>
        {@html costHTML(cost, P)}
        {#if delta !== 0}
          <div class="dim">
            Energie auf Stufe {level + 1}: {energy.format(Math.abs(delta))}
            {delta < 0 ? 'mehr Verbrauch' : 'mehr Produktion'}
          </div>
        {/if}
        {#if key === 'fusion'}
          <div class="dim">
            Deuteriumverbrauch auf Stufe {level + 1}: {energy.format(
              (fusionUse(level + 1, s.cfg) * (P.pct.fusion ?? 100)) / 100,
            )} pro Stunde
          </div>
        {/if}
        <div class="dim">Bauzeit: {dur(buildTime(cost, P, s.cfg))}</div>
        {@html requirementsHTML($viewState, def.req)}
        {#if ex}
          <div class="ex" id={ex.panel} hidden={!ex.open}><p>{ex.text}</p></div>
        {/if}
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
          <span class="req">Voraussetzungen fehlen</span>
        {:else if status === 'queueBusy'}
          <span class="dim">Bauschleife belegt</span>
        {:else if status === 'yardBusy'}
          <span class="dim">Werft arbeitet gerade</span>
        {:else if status === 'labBusy'}
          <span class="dim">Labor forscht gerade</span>
        {:else}
          <button data-act="build" data-k={key} disabled={!afford(P, cost)}>
            {level ? `Ausbauen auf Stufe ${level + 1}` : 'Bauen'}
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>
