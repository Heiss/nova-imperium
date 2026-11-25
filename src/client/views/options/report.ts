// „Optionen“: the form „Problem melden“ (features/report-problem.ts sends it);
// its data is in logic/options/report.ts.
import { reportForm } from '../../logic/options/report.ts';
import ReportBox from './ReportBox.svelte';
import { optionBox } from './contract.ts';

export const optionBoxes = [
  optionBox({
    key: 'report',
    order: 120,
    section: 'other',
    component: ReportBox,
    data: reportForm,
  }),
];
