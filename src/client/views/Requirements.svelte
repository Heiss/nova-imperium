<script lang="ts">
  // All unmet requirements of an entry, indirect ones included (#64; the HTML
  // of requirementsHTML() of views/common.ts before #337). Everything is built
  // and researched on the shown planet (#49): each line says why it waits, or
  // what its next level costs, and offers „Jetzt bauen“ / „Jetzt forschen“ when
  // it can start now.
  import { production } from '../../core/economy.ts';
  import {
    needState,
    type Places,
    unmetRequirements,
  } from '../../core/requirements.ts';
  import type { Requirements } from '../../core/types.ts';
  import type { V } from './common.ts';
  import Cost from './Cost.svelte';

  let { v, req }: { v: V; req: Requirements | undefined } = $props();

  /** The unmet requirements with their state, and the energy production of the planet for the cost line. */
  const needs = $derived.by(() => {
    const pl: Places = { here: v.P, research: v.R, cfg: v.s.cfg };
    return unmetRequirements(req, pl).map((n) => {
      const st = needState(n, pl);
      return {
        n,
        st,
        energy: st.energy
          ? {
              need: st.energy,
              production: production(v.P, v.s.cfg, v.R.research).eProd,
            }
          : undefined,
      };
    });
  });
</script>

{#if needs.length}<div class="needs">
    <div class="needs-h">Benötigt:</div>
    <ul>
      {#each needs as { n, st, energy } (`${n.kind}:${n.key}`)}<li
          class="need {st.ready ? 'ready' : 'missing'}"
        >
          <div>
            <b class="need-nm">{n.name}</b
            >{` – Stufe ${n.level} (aktuell ${n.have})`}{#if n.via}{' '}<span
                class="via">· für {n.via}</span
              >{/if}
            <div class="why">
              {#if !st.ready}{st.reason}{:else if st.busy}{st.busy}{:else}{`Stufe ${n.have + 1}: `}<Cost
                  cost={st.cost}
                  P={v.P}
                  {energy}
                />{/if}
            </div>
          </div>
          {#if st.ready}<button
              class="small go"
              data-act={n.kind === 'b' ? 'build' : 'research'}
              data-k={n.key}
              disabled={!!st.busy}
              >{n.kind === 'b' ? 'Jetzt bauen' : 'Jetzt forschen'}</button
            >{/if}
        </li>{/each}
    </ul>
  </div>{/if}
