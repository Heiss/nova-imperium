<script lang="ts">
  // The text of a fleet row (#118): its parts, the owner of a foreign fleet
  // in bold. Used by the fleet movements and „Gehaltene Flotten“ (#55).
  let { parts }: { parts: { text: string; bold: boolean }[] } = $props();
</script>

{#each parts as part, i (i)}{#if part.bold}<b>{part.text}</b
    >{:else}{part.text}{/if}{/each}
