<script lang="ts">
  // A frozen copy of src/client/views/Buildings.svelte before #118, for
  // src/test/catalog-list-reference.test.ts: CatalogList must render the
  // buildings as it did. Only the import paths changed, and resourceName()
  // of views/common.ts is copied below. One change on purpose (review of
  // #209, 2026-11-14): the energy a level needs is compared with
  // production(), as energyShort() does, not with prod(). A second one
  // (#202, 2026-11-17): a running demolition reads „Rückbau“ instead of
  // „Ausbau“, and a building with a level on a planet with a free build
  // queue offers „Zurückbauen“. One of #285 (B2): the „?“ opens the
  // Lexicanum, so no text unfolds below the entry and the „?“ shows in
  // every mode but „Ausblenden“. And one with the Raketenkrypta (#54): a
  // building that stores missiles shows the places they take, marked
  // below. And one of #187: the ▤ of the level overview next to the „?“,
  // and the box for its table below the entry (the table loads on demand,
  // so it is not drawn here). And one of #189, the phone layer: the switch
  // between the four lists, the filter, the phase of every row, the fold
  // button, the time line marked and the short label of a level button; the
  // CSS shows them on a phone only. Do not change it otherwise.
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
  import { levelsRow } from '../../client/logic/level-mode.ts';
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

  // #189: how many rows the filter „Baubar“ shows; a row is „open“ unless
  // its requirements are missing or its upgrade runs.
  const openRows = $derived(
    Object.entries(BUILD)
      .filter(([k]) => buildable(k, $viewState.P.kind))
      .filter(([key, def]) => {
        const { P, R, s } = $viewState;
        const level = P.b[key] ?? 0;
        const status = buildState(
          P,
          R,
          key,
          reqMissing(def, P, R).length,
          fieldsFull(P, s.cfg),
          energyShort(def, level + 1, P, s.cfg, R.research),
        );
        return status !== 'running' && status !== 'missing';
      }).length,
  );

  /** The energy production a level needs (Weltenschmiede, #51), if any. */
  function energyCost(v: V, key: string, level: number) {
    const need = energyNeed(BUILD[key]!, level);
    if (!need) return undefined;
    return { need, production: production(v.P, v.s.cfg, v.R.research).eProd };
  }
</script>

<h2>Gebäude</h2>
<nav class="seg phone-only" aria-label="Bauen">
  <a href="?view=buildings" data-act="nav" data-v="buildings">Gebäude</a><a
    href="?view=research"
    data-act="nav"
    data-v="research">Forschung</a
  ><a href="?view=shipyard" data-act="nav" data-v="shipyard">Schiffsschmiede</a
  ><a href="?view=defense" data-act="nav" data-v="defense">Abwehr</a>
</nav>
<div class="dim" id="fields">
  {fieldsLine($viewState.P, $viewState.s.cfg)}
</div>
<div class="seg phone-only" role="group" aria-label="Filter">
  <button type="button" class="on" aria-pressed="true">Baubar</button><button
    type="button"
    aria-pressed="false">Alle</button
  ><button type="button" aria-pressed="false">Läuft</button>
</div>
{#if openRows === 0}
  <p class="dim phone-only">
    Nichts ist baubar. „Alle“ zeigt auch, was noch fehlt.
  </p>
{/if}
<div class="box catalog" data-filter="open">
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
    {@const lv = levelsRow(key, t.n, s.me.levelTable, $viewState.ui.openLv)}
    {@const phase =
      status === 'running'
        ? 'running'
        : status === 'missing'
          ? 'locked'
          : 'open'}
    {@const open = !!lv?.open}
    <div
      class="item"
      class:running={status === 'running'}
      class:open
      data-phase={phase}
    >
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
            >{/if}{#if lv?.button}<button
              type="button"
              class="lvq"
              id={lv.button}
              data-act="levels"
              data-k={key}
              aria-expanded={lv.open}
              aria-controls={lv.open ? lv.panel : undefined}
              aria-label={`Stufenübersicht zu ${t.n}`}>▤</button
            >{/if}<button
            type="button"
            class="fold phone-only"
            aria-expanded={open}
            aria-label={`Details zu ${t.n}`}>{open ? '▴' : '▾'}</button
          >
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
        <div class="dim tl">Bauzeit: {dur(buildTime(cost, P, s.cfg))}</div>
        {@html requirementsHTML($viewState, def.req)}
        {#if lv?.show}<div class="lvt" id={lv.panel}></div>{/if}
      </div>
      <div class="act">
        {#if status === 'running' && P.bq}
          <!-- #202: „Rückbau“ for a demolition. -->
          {P.bq.back ? 'Rückbau' : 'Ausbau'} auf Stufe {P.bq.lvl}<br />
          <span class="cd" data-end={P.bq.end}>{dur(P.bq.end - now)}</span>
          <progress
            max={P.bq.end - P.bq.start}
            value={Math.min(now - P.bq.start, P.bq.end - P.bq.start)}
            aria-label={P.bq.back
              ? 'Fortschritt Rückbau'
              : 'Fortschritt Ausbau'}
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
          {#if level}
            <button
              data-act="build"
              data-k={key}
              disabled={!afford(P, cost)}
              aria-label={`Ausbauen auf Stufe ${level + 1}`}
              ><span class="lg">Ausbauen auf Stufe {level + 1}</span><span
                class="sh"
                aria-hidden="true">▲ {level + 1}</span
              ></button
            >
          {:else}
            <button data-act="build" data-k={key} disabled={!afford(P, cost)}
              ><span>Bauen</span></button
            >
          {/if}
        {/if}
        <!-- #202: „Zurückbauen“ on a planet, with a level and a free queue. -->
        {#if P.kind === 'planet' && level > 0 && !P.bq}
          <br /><button class="small" data-act="demolish" data-k={key}
            >Zurückbauen</button
          >
        {/if}
      </div>
    </div>
  {/each}
</div>
