---
type: log-entry
date: 2026-11-19T22:30
kind: Code
issues: [118, 81, 190, 242]
---

#118, bundle 4 (the order of the bundles of „Geklärt, Nachtrag 3“, unchanged by „Nachtrag 4“): „Neuigkeiten“ and „Nachrichten“ are Svelte components. `News.svelte` renders `newsPage()` of `logic/news.ts` (the page of #81), `Messages.svelte` renders `messagesPage()` of the new `logic/messages.ts`: the count, „Alle löschen“, the reports newest first with their marks, and the text or update-message body; both are mounted anew on every render as their HTML was, so an opened report stays open and the news render again once loaded [V]. The bodies of battle, espionage and survey reports (the survey is #190's) stay HTML for now, moved unchanged to `logic/report-body.ts` and rendered with `{@html}` [V]; making them components is left for a later step, with its own reference test. `views/news` and `views/messages` leave the HTML table, and `newsHTML()` and `updateMessageHTML()` are gone. Two property tests keep the components equal to the frozen HTML (300 states each, seed 118) with hand-built cases for the empty states; the allow list of the catalog-key test names the new file of the report type „spy“. `main.ts` stays at 1,191 lines (the limit of #242): neither view had code in it. No visible change (the label `kein-changelog`, no fragment); see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md).
