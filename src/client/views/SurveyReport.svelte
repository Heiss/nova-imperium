<script lang="ts">
  // The body of a survey report (#330), from surveyReport() of
  // logic/survey.ts: a line, and the table of a report that is not rough.
  import type { SurveyBody } from '../logic/survey.ts';

  let { body }: { body: SurveyBody } = $props();
</script>

<div>{body.head}</div>
{#if body.rows}
  <table class="mini">
    <tbody>
      {#each body.rows as [label, value] (label)}
        <tr><td>{label}</td><td>{value}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}
