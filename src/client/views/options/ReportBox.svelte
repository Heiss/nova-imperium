<script lang="ts">
  // „Optionen“, the box „Problem melden“ (views/options/report.ts).
  import { optionsForm } from '../../logic/options-form.svelte.ts';
  import Box from '../Box.svelte';
  import type { BoxProps } from './contract.ts';
  import type { ReportPart } from '../../logic/options/report.ts';

  let { page, section }: BoxProps<ReportPart> = $props();
</script>

<Box title="Problem melden" {section}>
  <form id="reportform" class="report-form">
    <input type="hidden" name="source" value="form" /><input
      type="hidden"
      name="page"
      value={page.report.page}
    /><input type="hidden" name="version" value={page.report.version} /><input
      type="hidden"
      name="requestId"
      value={page.report.requestId}
    /><input type="hidden" name="message" value="" />
    <p class="dim">{page.report.context}</p>
    <label for="reportform-text">Was ist passiert?</label><br />
    <textarea
      id="reportform-text"
      name="text"
      value={optionsForm.report}
      oninput={(e) => (optionsForm.report = e.currentTarget.value)}
      maxlength={page.report.max}
      rows="4"
      required></textarea>
    <p><button type="submit">Absenden</button></p>
  </form>
</Box>
