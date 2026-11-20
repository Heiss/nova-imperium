---
type: log-entry
date: 2026-11-20T02:00
kind: Feature
issues: [189]
---

#189 built for the phone (up to 760 px, the desktop as before): „Optionen“ in five sections with a switch („Spiel“, „Runde“, „Konto“, „Gerät“, „Weiteres“) that shows the boxes of one section [V, the names and the grouping; no section is called „Hilfe“ since the page is „Optionen“]; every id, `data-act` and form stays in the page, `Box.svelte` takes an optional `section`, the CSS hides the other sections (`logic/phone-options.ts`); and the filter of the four lists is kept on the device in `localStorage` (`nova.build.filter`, try/catch, „Baubar“ without a stored value) [V]. The reference test of „Optionen“ expects the frozen boxes with the switch, the container and the sections. See [Interface v2](/features/interface.md).
