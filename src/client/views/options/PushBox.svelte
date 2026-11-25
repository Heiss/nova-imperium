<script lang="ts">
  // „Optionen“, the box of the push kinds (views/options/push.ts), shown on a
  // server with Web Push only.
  import {
    PUSH_KINDS_LEGEND,
    PUSH_KINDS_NOTE,
  } from '../../logic/push-options.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { PushPart } from '../../logic/options/push.ts';

  let { page, section }: BoxProps<PushPart> = $props();
</script>

<Box title="Benachrichtigungen" {section}>
  <p>{PUSH_KINDS_NOTE}</p>
  <fieldset class="push-kinds">
    <legend>{PUSH_KINDS_LEGEND}</legend>
    {#each page.pushKinds as kind (kind.topic)}<label class="switch"
        ><input
          type="checkbox"
          id={kind.id}
          data-chg="push"
          data-k={kind.topic}
          checked={kind.checked}
        />
        {kind.label}</label
      >{/each}
  </fieldset>
</Box>
