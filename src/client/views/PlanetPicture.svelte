<script lang="ts">
  // A layered planet (#61, D7; the HTML of planetHTML() of views/common.ts
  // before #337): the surface turns, the clouds drift, the atmosphere
  // breathes. main.ts sets the textures from data-surface and data-clouds (no
  // inline styles under the CSP). `still` is for small planets.
  import type { Coords } from '../../core/types.ts';
  import { planetLook } from '../logic/planet.ts';

  let { c, still = false }: { c: Coords; still?: boolean } = $props();
  const look = $derived(planetLook(c));
</script>

<div
  class="pl pl-{look.type}{still ? ' pl-still' : ''}"
  role="img"
  aria-label={look.name}
  data-surface={look.surface}
  data-clouds={look.clouds}
>
  <div class="pl-body">
    <div class="pl-surface"></div>
    <div class="pl-clouds"></div>
    <div class="pl-shade"></div>
  </div>
</div>
