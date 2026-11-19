---
type: log-entry
date: 2026-11-19T18:00
kind: Feature
issues: [193]
---

#193 built with the owner's decisions of 2026-11-14 (D1 changed: the phone stays as it is; D2: slimmer while scrolled) and of 2026-11-17 (a one-line header: the logo becomes smaller while scrolled): on the desktop the header with the resources and the side menu stay in view while the page scrolls; a header that wraps sticks with its logo line above the screen, so it is slimmer while scrolled and full again at the top, and the menu sticks below it [V]; a one-line header (the logo beside the resources, for example at 1,280 px with a short name) keeps its height and its logo goes from 22 px to 16 px, the subtitle from 13 px to 11 px, while the page is scrolled [V, the sizes]; `scroll-padding` keeps the keyboard focus clear of the header and, on the phone, of the tab bar [V]; the lengths and the two classes of `<html>` come from the new `src/client/logic/sticky-header.ts`, wired in `src/client/views/frame.ts`, so `main.ts` does not grow. Taken from the draft of 2026-11-17 on the branch `claude/sticky-header`, without its E2E test (a spec for the desktop and the phone is still to write). Checked once with the built app at 1,100 px, 1,280 px and 412 px (Playwright). See [Interface v2](/features/interface.md).
