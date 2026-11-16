<script lang="ts">
  // The header line (#118, bundle 1; okf/architecture/patterns.md,
  // section 9): from headerLine() of logic/header.ts. „Logout“ carries
  // data-act and the list „Aktiver Planet“ its id; main.ts handles both.
  import type { HeaderLine } from '../logic/header.ts';

  let { line }: { line: HeaderLine } = $props();
</script>

<b>{line.name}</b>
{line.position} · Kommandant <b>{line.commander}</b> ·
<span class="lnk" data-act="logout">Logout</span>{#if line.places.length}{' '}·
  <select id="planet_select" aria-label="Aktiver Planet"
    >{#each line.places as place (place.id)}<option
        value={place.id}
        selected={place.selected}>{place.label}</option
      >{/each}</select
  >{/if}
