<script lang="ts">
  // „Optionen“, the box of the display (views/options/display.ts); main.ts
  // applies `o_anim`.
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { DisplayPart } from '../../logic/options/display.ts';

  let { page, section }: BoxProps<DisplayPart> = $props();
</script>

<Box title="Darstellung" {section}>
  <label class="switch"
    ><input type="checkbox" id="o_anim" checked={page.animations} /> Animationen</label
  >
  <p class="dim">
    Planeten drehen sich, Wolken ziehen. Gilt für dieses Gerät; ist im System
    „Bewegung reduzieren“ eingestellt, bleibt alles ruhig.
  </p>
</Box>
