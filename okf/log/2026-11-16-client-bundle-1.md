---
type: log-entry
date: 2026-11-16T17:00
kind: Code
issues: [118, 189, 241]
---

#118, bundle 1 (owner, 2026-11-16: this bundle next, from the bundles of „Geklärt, Nachtrag 3“): the header line, the navigation and the resource bar are Svelte components in their old places of `index.html`, `Header.svelte` from `headerLine()`, `Menu.svelte`, `TabBar.svelte` and `MoreList.svelte` with `NavLink.svelte` from `navigation()`, and `ResourceBar.svelte` from `resourceBar()`, three new pure modules of `src/client/logic/`, mounted by `src/client/views/frame.ts`; `main.ts` loses `renderPlanetHeader`, `menuBadge`, `menuLink`, `renderPhoneMenu` and the HTML of `renderMenu` and `updateBar` (1,979 to 1,875 lines); each part is mounted anew whenever its HTML was written anew, so focus and titles behave as before and nothing visible changes [V]; a property test keeps the five components equal to the frozen HTML (300 states, seed 118), and the shared normalizer leaves out an empty `class` and reads `selected=""` as `selected`; the phone view #189 builds on these components; the double display of the active planet (#241) is left as it is; no visible change, so the label `kein-changelog` and no fragment; E2E and axe tests unchanged (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
