<script lang="ts">
  // The generic list of buildings, research, shipyard and defense (#118,
  // okf/architecture/patterns.md, section 9): one row per catalog entry of a
  // kind, from catalogPage() of logic/catalog-list.ts. It shows the view
  // state of the client state module; its buttons carry data-act, which
  // main.ts sends through act(). A new entry needs no new HTML.
  import { type CatalogKind, catalogPage } from '../logic/catalog-list.ts';
  import { paragraphs } from '../logic/explain.ts';
  import { fmt } from '../logic/format.ts';
  import { client } from '../logic/state.svelte.ts';
  import { costHTML, requirementsHTML } from './common.ts';

  let { kind }: { kind: CatalogKind } = $props();

  const v = $derived(client.shown);
  const page = $derived(v && catalogPage(v, kind));
</script>

{#if v && page}
  <h2>{page.title}</h2>
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
    <div class="box">
      {#each page.rows as row (row.key)}
        {@const ex = row.explanation}
        {@const a = row.action}
        <div class="item" class:running={row.running}>
          <div class="icon {row.cls}">
            {#if row.icon}<img
                src={row.icon}
                alt={row.name}
              />{:else}{row.ab}{/if}
          </div>
          <div>
            <div class="nm">
              {row.name}
              <span class="lv">{row.level}</span>{#if ex?.toggle}<button
                  type="button"
                  class="exq"
                  id={ex.button}
                  data-act="explain"
                  data-k={row.key}
                  aria-expanded={ex.open}
                  aria-controls={ex.panel}
                  aria-label={`Erklärung zu ${row.name}`}>?</button
                >{/if}
            </div>
            {#if row.ds}
              <div class="ds">{row.ds}</div>
            {/if}
            {@html costHTML(row.cost, v.P, 1, row.energy)}
            {#each row.lines as line, i (i)}
              <div class="dim">{line}</div>
            {/each}
            {@html requirementsHTML(v, row.req)}
            {#if ex}
              <div class="ex" id={ex.panel} hidden={!ex.open}>
                {#each paragraphs(ex.text) as text, i (i)}<p>{text}</p>{/each}
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
                >{a.label}</button
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
            {/if}
            {#if row.demolish}
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
