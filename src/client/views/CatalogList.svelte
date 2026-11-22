<script lang="ts">
  // The generic list of buildings, research, shipyard and defense (#118,
  // okf/architecture/patterns.md, section 9): one row per catalog entry of a
  // kind, from catalogPage() of logic/catalog-list.ts. It shows the view
  // state of the client state module; its buttons carry data-act, which
  // main.ts sends through act(). A new entry needs no new HTML.
  import { type CatalogKind, catalogPage } from '../logic/catalog-list.ts';
  import { fmt } from '../logic/format.ts';
  import {
    EMPTY,
    FILTERS,
    filterCounts,
    isTimeLine,
    rowPhase,
    SEGMENTS,
    shortLabel,
  } from '../logic/phone-build.ts';
  import { chooseFilter, phoneBuild } from '../logic/phone-build.svelte.ts';
  import { client } from '../logic/state.svelte.ts';
  import Cost from './Cost.svelte';
  import Requirements from './Requirements.svelte';

  let { kind }: { kind: CatalogKind } = $props();

  const v = $derived(client.shown);
  const page = $derived(v && catalogPage(v, kind));
  // The units with an order in the queue count as running (#189).
  const queued = $derived(new Set(v ? v.P.sq.map((q) => q.key) : []));
  const counts = $derived(
    page && !page.blocked ? filterCounts(page.rows, queued) : null,
  );

  // Phone (#189): the details of a row unfold on a tap.
  const toggle = (key: string): void => {
    phoneBuild.unfolded[key] = !phoneBuild.unfolded[key];
  };
</script>

{#if v && page}
  <h2>{page.title}</h2>
  <nav class="seg phone-only" aria-label="Bauen">
    {#each SEGMENTS as seg (seg.view)}
      {@const on = seg.view === client.ui.view}
      <a
        href={`?view=${seg.view}`}
        data-act="nav"
        data-v={seg.view}
        class:on
        aria-current={on ? 'page' : undefined}>{seg.label}</a
      >
    {/each}
  </nav>
  {#if page.blocked}
    <div class="notice">
      {page.notice}{#each page.places as place (place.id)}{' '}<button
          data-act="selectPlanet"
          data-id={place.id}>Zu {place.name}</button
        >{/each}
    </div>
  {:else}
    {#if page.line}
      <div class="dim" id={page.line.id}>{page.line.text}</div>
    {/if}
    {#if page.queue.length}
      <div class="box">
        <div class="hd">Bauauftrag der Schiffsschmiede</div>
        <div class="bd">
          <table>
            <tbody>
              {#each page.queue as order, i (i)}
                <tr>
                  <td>{order.label}</td>
                  <td class="n"
                    >{#if order.next}nächste fertig in {#if order.next.left}<span
                          class="cd"
                          data-end={order.next.end}>{order.next.left}</span
                        >{:else}<span class="dim">gleich …</span
                        >{/if}{:else}{order.each}{/if}</td
                  >
                  <td class="n"
                    ><button
                      class="small red"
                      data-act="cancelOrder"
                      data-pos={i}
                      data-k={order.key}
                      aria-label={`Abbrechen: ${order.label}`}>Abbrechen</button
                    ></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
    {#if page.warn}
      <div class="notice warn">{page.warn}</div>
    {/if}
    <div class="seg phone-only" role="group" aria-label="Filter">
      {#each FILTERS as f (f.key)}
        <button
          type="button"
          class:on={phoneBuild.filter === f.key}
          aria-pressed={phoneBuild.filter === f.key}
          onclick={() => chooseFilter(f.key)}>{f.label}</button
        >
      {/each}
    </div>
    {#if counts && counts[phoneBuild.filter] === 0}
      <p class="dim phone-only">{EMPTY[phoneBuild.filter]}</p>
    {/if}
    <div class="box catalog" data-filter={phoneBuild.filter}>
      {#each page.rows as row (row.key)}
        {@const ex = row.explanation}
        {@const lv = row.levels}
        {@const a = row.action}
        {@const open = !!phoneBuild.unfolded[row.key] || !!lv?.open}
        {@const short = a.kind === 'start' ? shortLabel(a.label) : null}
        <div
          class="item"
          class:running={row.running}
          class:open
          data-phase={rowPhase(row, queued)}
        >
          <div class="icon {row.cls}">
            {#if row.icon}<img
                src={row.icon}
                alt={row.name}
              />{:else}{row.ab}{/if}
          </div>
          <div>
            <div class="nm">
              {row.name}
              <span class="lv">{row.level}</span>{#if ex}<button
                  type="button"
                  class="exq"
                  id={ex.button}
                  data-act="explain"
                  data-k={row.key}
                  aria-expanded={ex.open}
                  aria-controls={ex.open ? ex.panel : undefined}
                  aria-label={`Erklärung zu ${row.name}`}>?</button
                >{/if}{#if lv?.button}<button
                  type="button"
                  class="lvq"
                  id={lv.button}
                  data-act="levels"
                  data-k={row.key}
                  aria-expanded={lv.open}
                  aria-controls={lv.open ? lv.panel : undefined}
                  aria-label={`Stufenübersicht zu ${row.name}`}>▤</button
                >{/if}<button
                type="button"
                class="fold phone-only"
                aria-expanded={open}
                aria-label={`Details zu ${row.name}`}
                onclick={() => toggle(row.key)}>{open ? '▴' : '▾'}</button
              >
            </div>
            {#if row.ds}
              <div class="ds">{row.ds}</div>
            {/if}
            <Cost cost={row.cost} P={v.P} energy={row.energy} />
            {#each row.lines as line, i (i)}
              <div class="dim" class:tl={isTimeLine(line)}>{line}</div>
            {/each}
            <Requirements {v} req={row.req} />
            {#if lv?.show}
              <div class="lvt" id={lv.panel}>
                {#await import('./LevelOverview.svelte') then m}
                  <m.default {v} key={row.key} />
                {/await}
              </div>
            {/if}
          </div>
          <div class="act">
            {#if a.kind === 'upgrading'}
              {a.down ? 'Rückbau' : 'Ausbau'} auf Stufe {a.level}<br />
              <span class="cd" data-end={a.end}>{a.left}</span>
              <progress
                max={a.max}
                value={a.value}
                aria-label={a.down
                  ? 'Fortschritt Rückbau'
                  : 'Fortschritt Ausbau'}
              ></progress>
              <button class="small red" data-act="cancelBuild">Abbrechen</button
              >
            {:else if a.kind === 'researching'}
              Forschung Stufe {a.level}<br />auf {a.place}<br
              />{#if a.left}<span class="cd" data-end={a.end}>{a.left}</span
                >{:else}<span class="dim">gleich …</span>{/if}<br /><button
                class="small red"
                data-act="cancelResearch">Abbrechen</button
              >
            {:else if a.kind === 'note'}
              <span class={a.cls}>{a.text}</span>
            {:else if a.kind === 'start'}
              <button data-act={a.act} data-k={row.key} disabled={a.disabled}
                ><span class:lg={!!short}>{a.label}</span>{#if short}<span
                    class="sh"
                    aria-hidden="true">{short}</span
                  >{/if}</button
              >
            {:else}
              <div class="flex center">
                <input
                  type="number"
                  min="0"
                  max={a.once ? 1 : undefined}
                  id="q_{row.key}"
                  placeholder="0"
                  aria-label="Anzahl"
                />
                <span
                  class="lnk"
                  data-act="maxq"
                  data-k={row.key}
                  data-max={a.max}>(max {fmt(a.max)})</span
                >
              </div>
              <button
                class="mt"
                data-act="order"
                data-k={row.key}
                disabled={a.disabled}>Bauen</button
              >
              {#if row.tearDown}
                <div class="tear">
                  <input
                    type="number"
                    min="1"
                    max={row.tearDown}
                    id="td_{row.key}"
                    placeholder="0"
                    aria-label={`Menge verschrotten: ${row.name}`}
                  />
                  <button
                    class="small red"
                    data-act="tearDown"
                    data-k={row.key}
                    aria-label={`Verschrotten: ${row.name}`}
                    >Verschrotten</button
                  >
                </div>
              {/if}
            {/if}{#if row.demolish}
              <br /><button class="small" data-act="demolish" data-k={row.key}
                >Zurückbauen</button
              >
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}
