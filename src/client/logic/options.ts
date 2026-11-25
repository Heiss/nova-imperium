// What the page „Optionen“ shows (#118, bundle 5; okf/architecture/
// patterns.md, sections 9 and 16): since #378 the parts of its boxes, each
// declared with its data in its own module of views/options/ (`optionBoxes`),
// put together by views/options/boxes.ts. The component Options renders it.
// The ids and `data-act`s belong to features/ (options.ts, playtime.ts,
// passkeys.ts, install.ts, push.ts, report-problem.ts, round-archive.ts) and
// to main.ts (the forms and `o_anim`); the boxes that a feature fills after
// the render (`#own-activity`, `#passkey-list`) are plain elements of their
// components.
export { optionsPage, type OptionsPage } from '../views/options/boxes.ts';
export {
  deleteAccountDialogText,
  deleteAccountText,
} from './delete-account.ts';
