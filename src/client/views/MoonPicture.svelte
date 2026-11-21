<script lang="ts">
  // The picture of a moon (#53; the HTML of moonPicture() of logic/moon.ts
  // before #337): the overview, the symbol on the Sternenkarte and its row.
  // The name is the alt text.
  let { name, size }: { name: string; size: number } = $props();
</script>

<img class="moon" src="/icons/moon.svg" alt={name} width={size} height={size} />
