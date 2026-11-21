<script lang="ts">
  // The body of a battle, espionage or survey report (#330).
  import type { ReportBody } from '../logic/report-body.ts';
  import BattleReport from './BattleReport.svelte';
  import SpyReport from './SpyReport.svelte';
  import SurveyReport from './SurveyReport.svelte';

  let { body }: { body: ReportBody } = $props();
</script>

{#if body.kind === 'battle'}
  <BattleReport {body} />
{:else if body.kind === 'survey'}
  <SurveyReport {body} />
{:else}
  <SpyReport {body} />
{/if}
