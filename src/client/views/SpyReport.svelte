<script lang="ts">
  // The body of an espionage report (#330), from reportBody() of
  // logic/report-body.ts.
  import type { SpyBody } from '../logic/report-body.ts';

  let { body }: { body: SpyBody } = $props();
</script>

<div>{body.head}<br /><b>{body.res}</b></div>
{#each body.sections as section (section.title)}
  <div class="mt">
    <b>{section.title}</b><br
    />{#each section.entries as entry, i (i)}{#if i}<br
        />{/if}{#if entry.label !== null}{entry.label +
          ': '}{/if}{#if entry.list !== null}{entry.list}{:else}<span
          class="dim">keine</span
        >{/if}{/each}
  </div>
{/each}
<div class="dim mt">
  Chance auf Auspex-Abwehr: {body.counter} %{#if body.lost}{' – '}<span
      class="bad">deine Spähschädel wurden zerstört!</span
    >{/if}{#if body.hint}{' · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.'}{/if}
</div>
