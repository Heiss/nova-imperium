<script lang="ts">
  // The resources page (#114): one row per entry with production
  // components, from producerRows() of the core; the browser computes no
  // production formula.
  import type { Readable } from 'svelte/store';
  import {
    caps,
    producerRows,
    production,
    type ProducerRow,
  } from '../../core/economy.ts';
  import { text } from '../../core/text.ts';
  import { fmt } from '../logic/format.ts';
  import type { V } from './common.ts';

  let { viewState }: { viewState: Readable<V> } = $props();

  const SHARES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
  type Column = 'm' | 'c' | 'd' | 'e';
  const COLUMNS: readonly Column[] = ['m', 'c', 'd', 'e'];
  type Flow = Partial<Record<Column, number>>;

  /** A cell: a use with a minus, made energy as good, nothing as 0. */
  function cell(made: Flow, used: Flow, column: Column) {
    const use = used[column];
    if (use !== undefined) return { value: `-${fmt(use)}`, cls: 'n bad' };
    const make = made[column];
    if (make === undefined) return { value: '0', cls: 'n' };
    return { value: fmt(make), cls: column === 'e' ? 'n good' : 'n' };
  }

  /** A building with its level, a ship in the plural with its number. */
  function label(row: ProducerRow): string {
    const t = text(row.key)!;
    return row.kind === 'ship'
      ? `${t.plural ?? t.n} (${fmt(row.level)})`
      : `${t.n} (Stufe ${row.level})`;
  }

  const name = (key: string): string => `Leistung ${text(key)?.n}`;

  const P = $derived($viewState.P);
  const pr = $derived(production(P, $viewState.s.cfg, $viewState.R.research));
  const table = $derived(
    producerRows(P, $viewState.s.cfg, $viewState.R.research),
  );
  const cp = $derived(caps(P, $viewState.s.cfg));
</script>

{#snippet cells(made: Flow, used: Flow)}
  {#each COLUMNS as column (column)}
    {@const c = cell(made, used, column)}
    <td class={c.cls}>{c.value}</td>
  {/each}
{/snippet}

{#snippet share(row: ProducerRow, set: number)}
  <td
    ><select
      data-chg="pct"
      data-k={row.key}
      data-nokeep
      aria-label={name(row.key)}
    >
      {#each SHARES as x (x)}
        <option selected={set === x}>{x}</option>
      {/each}
    </select>
    %{#if row.throttled}{' '}<span class="req"
        >gedrosselt auf {fmt(row.pct)} %</span
      >{/if}</td
  >
{/snippet}

<h2>Rohstoffe auf {P.name}</h2>
<div class="box">
  <div class="hd">
    Produktion pro Stunde (Produktionsfaktor {Math.round(pr.f * 100)} %)
  </div>
  <div class="bd">
    <table>
      <tbody>
        <tr>
          <th></th>
          <th class="n">Adamant</th>
          <th class="n">Psikristall</th>
          <th class="n">Promethium</th>
          <th class="n">Energie</th>
          <th>Leistung</th>
        </tr>
        <tr>
          <td>Grundeinkommen</td>
          {@render cells(table.base, {})}
          <td></td>
        </tr>
        {#each table.rows as row (row.key)}
          <tr>
            <td>{label(row)}</td>
            {@render cells(row.made, row.used)}
            {@render share(row, P.pct[row.key] ?? 100)}
          </tr>
        {/each}
        <tr>
          <th>Lagerkapazität</th>
          <th class="n">{fmt(cp.m)}</th>
          <th class="n">{fmt(cp.c)}</th>
          <th class="n">{fmt(cp.d)}</th>
          <th class="n">-</th>
          <th></th>
        </tr>
        <tr>
          <th>Summe / Stunde</th>
          <th class="n">{fmt(pr.m)}</th>
          <th class="n">{fmt(pr.c)}</th>
          <th class="n">{fmt(pr.d)}</th>
          <th class="n">{fmt(pr.eProd - pr.eUse)}</th>
          <th></th>
        </tr>
        <tr>
          <td>pro Tag</td>
          <td class="n">{fmt(pr.m * 24)}</td>
          <td class="n">{fmt(pr.c * 24)}</td>
          <td class="n">{fmt(pr.d * 24)}</td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
