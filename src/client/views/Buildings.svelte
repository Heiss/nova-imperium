<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { BUILD } from '../../core/catalog.ts';
  import {
    afford,
    buildTime,
    lvlCost,
    prod,
    reqMissing,
    useAt,
  } from '../../core/economy.ts';
  import { fieldsFull } from '../../core/fields.ts';
  import { energyNeed, energyShort } from '../../core/research.ts';
  import { text } from '../../core/text.ts';
  import { explanation, paragraphs } from '../logic/explain.ts';
  import { fieldsLine } from '../logic/fields.ts';
  import { iconURL } from '../logic/icons.ts';
  import { dur, fmt } from '../logic/format.ts';
  import { buildState } from '../logic/game.ts';
  import {
    costHTML,
    requirementsHTML,
    resourceName,
    type V,
  } from './common.ts';

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

  /** The energy production a level needs (Weltenschmiede, #51), if any. */
  function energyCost(v: V, key: string, level: number) {
    const need = energyNeed(BUILD[key]!, level);
    if (!need) return undefined;
    return { need, production: prod(v.P, v.s.cfg, v.R.research).eProd };
  }
</script>

<h2>Gebäude</h2>
<div class="dim" id="fields">
  {fieldsLine($viewState.P, $viewState.s.cfg)}
</div>
<div class="box">
  {#each Object.entries(BUILD) as [key, def] (key)}
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
          >{#if ex?.toggle}<button
              type="button"
              class="exq"
              id={ex.button}
              data-act="explain"
              data-k={key}
              aria-expanded={ex.open}
              aria-controls={ex.panel}
              aria-label={`Erklärung zu ${t.n}`}>?</button
            >{/if}
        </div>
        <div class="ds">{t.ds}</div>
        {@html costHTML(cost, P, 1, energyCost($viewState, key, level + 1))}
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
        {#if ex}
          <div class="ex" id={ex.panel} hidden={!ex.open}>
            {#each paragraphs(ex.text) as text, i (i)}<p>{text}</p>{/each}
          </div>
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
