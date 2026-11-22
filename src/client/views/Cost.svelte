<script lang="ts">
  // The cost of an entry in resources (#337; the HTML of costHTML() of
  // views/common.ts before): one part per resource with a price, each a small
  // icon and the amount, red while the planet has less. `energy` is an energy
  // production the planet must have (Gravitonforschung, #49), `production`
  // what it has. Used by the catalog lists, the requirements, the level table
  // and the Lexicanum.
  import type { Cost, Planet } from '../../core/types.ts';
  import { fmt } from '../logic/format.ts';
  import { type ResourceKey, resourceIconURL } from '../logic/icons.ts';

  let {
    cost,
    P,
    n = 1,
    energy,
  }: {
    cost: Cost;
    P: Planet;
    n?: number;
    energy?: { need: number; production: number } | undefined;
  } = $props();

  const RESOURCES: { key: ResourceKey; name: string; have: 'm' | 'c' | 'd' }[] =
    [
      { key: 'metal', name: 'Adamant', have: 'm' },
      { key: 'crystal', name: 'Psikristall', have: 'c' },
      { key: 'deuterium', name: 'Promethium', have: 'd' },
    ];

  /** The parts that cost something, then the energy production the entry needs. */
  const parts = $derived([
    ...RESOURCES.map((r, i) => ({
      key: r.key,
      name: r.name,
      amount: cost[i]! * n,
      have: P.res[r.have],
    })).filter((x) => x.amount > 0),
    ...(energy?.need
      ? [
          {
            key: 'energy' as ResourceKey,
            name: 'Energieproduktion',
            amount: energy.need,
            have: energy.production,
          },
        ]
      : []),
  ]);
</script>

<div class="cost">
  {#each parts as x (x.key)}<span
      ><img
        class="ri"
        src={resourceIconURL(x.key)}
        alt={x.name}
        width="20"
        height="20"
      /><b class={x.have >= x.amount ? '' : 'bad'}>{fmt(x.amount)}</b></span
    >{/each}
</div>
