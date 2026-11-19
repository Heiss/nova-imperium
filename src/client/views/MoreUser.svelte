<script lang="ts">
  // Phone: the commander and „Logout“ at the top of the sheet „Mehr“ (#189,
  // D1: they left the header), above the list. „Logout“ carries data-act, which main.ts
  // handles.
  import type { Navigation } from '../logic/navigation.ts';

  let { nav }: { nav: Navigation } = $props();
</script>

<span>Kommandant <b>{nav.commander}</b></span><button
  type="button"
  data-act="logout"
  onclick={() => document.querySelector<HTMLDialogElement>('#more')?.close()}
  >Logout</button
>
