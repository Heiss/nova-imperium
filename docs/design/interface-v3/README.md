# Interface v3 — four directions and one shared interaction language

Design exploration, 2026-11-16. **[V]** All visual directions, layouts and sample values are proposals. This is a design package, not a shipped interface or a gameplay recording. No game code or rules change here.

## Confirmed brief [E]

- Explore a substantially modernized Nova Imperium UI/UX, including disruptive alternatives.
- Players can switch between **Modern and Classic at any time**.
- Integrate the galaxy map (#160) and ground troops / siege (#155) in the same visual and interaction language.
- Include **animated WebP**, readable and openable on GitHub on a phone.

The word *Classic* below describes a presentation, not a different rule set or an older executable. It must remain a supported, complete way to play.

## View the studies

Open `index.html` from a repository checkout in a browser for a local comparison gallery. No build, service or external font request. The gallery switches **illustrations**, not live game views. Static images and animations are also directly available in `screenshots/`.

| Direction | Desktop | Phone | Central hypothesis |
|---|---|---|---|
| A — Imperiale Brücke | [Desktop](screenshots/a-bridge-desktop.webp) | [Phone](screenshots/a-phone.webp) | Prioritize the next meaningful decision for short, asynchronous visits. |
| B — Sektor-Atlas | [Desktop](screenshots/b-atlas-desktop.webp) | [Phone](screenshots/b-phone.webp) | Keep spatial tasks on the map; act through an object inspector. |
| C — Operationsdeck | [Desktop](screenshots/c-operations-desktop.webp) | [Phone](screenshots/c-phone.webp) | Compare many colonies, queues and deadlines without repeated navigation. |
| D — Imperiums-Chronik | [Desktop](screenshots/d-chronicle-desktop.webp) | [Phone](screenshots/d-phone.webp) | Help returning players understand their empire through a concise, atmospheric briefing. |

### Animated storyboards

- [Four directions](screenshots/design-tour.webp): four held, readable overview compositions.
- [Map → planet → siege → Classic → Modern](screenshots/map-to-siege-and-classic.webp): object context and the same three planned orders survive the presentation switch.
- [Phone build flow](screenshots/phone-build-flow.webp): browse → inspect effect/cost → explicit build → server-confirmed state.
- [Phone Modern ↔ Classic](screenshots/phone-modern-classic.webp): tactical viewport ↔ command list, same unit and draft.

The Modern/Classic animation compares two presentation presets; it does not mandate that a global presentation switch changes the independently stored board/list preference. The Classic tactical view extends the existing bronze/serif language; it is not a screenshot of a shipped v2 siege.

The flow animations use tap highlights and held states. They are **illustrated navigation storyboards**, not screen recordings, functional prototypes, measurements or proof of implemented seamless zoom. Each state has a still export; motion must never be required to understand the design.

## Evidence from current Nova

Baseline: `main` commit `f4cfd34cd0045ade9d3f776a328351b5833d9996` (2026-11-16). Source inspection, not a fresh production usability test. Historical measurements in #189 are not new measurements and some bugs in that issue have already been fixed.

| Current implementation | Assessment | v3 opportunity |
|---|---|---|
| `src/client/static/style.css`: dark bronze, gold, Cinzel + EB Garamond; 11–12 px small button text and decorated headings throughout | A deliberate identity, not inherently outdated. Small decorative labels are harder to scan; actual contrast and target compliance require measurement. | Keep Cinzel for identity, retain original art, test a neutral UI font for controls/numbers. Body text 16–18 px as a starting point, adjustable. |
| `src/client/views/index.ts`: long menu; four fixed mobile destinations plus More | Bottom navigation is already present. Related growth tasks sit on separate destinations; strategic navigation competes with meta pages. | Group by task while keeping every destination discoverable. |
| `CatalogList.svelte`: each entry exposes image, short text, costs, extra lines, prerequisites and action | Rich context, but accumulated reading/scroll cost, especially on phones. | A compact list with visible costs, level, duration and blocker; expand effects/explanation locally. Keep an All filter. |
| `Overview.svelte`: fleets, planet facts, activities | Already useful live information. Static facts compete with decisions and cross-colony attention needs. | Briefing + active queues + actionable alerts + colony overview, with facts still available. |
| `main.ts`: resource production/capacity in native `title` on a non-focusable resource div | Touch and keyboard cannot rely on that hover discovery. This is not automatically a violation of WCAG 1.4.13; native tooltips are explicitly excepted there. | Tappable/focusable resource inspector with stock, rate, capacity and explanation of estimates. |
| `views/fleet.ts`: two broad sections containing ship table and target/mission/cargo/preview | Flight preview exists already. The whole form is exposed at once. Some max/all actions are clickable spans. | Inline steps on phones; a simultaneous editor/preview on desktop; native buttons, contextual errors and deliberate final send. |
| `main.ts`: HTML rendering beside Svelte mounts, manual input restoration; overview remounts | Existing preservation is intentional. Additional presentations increase the number of places in which a draft could be lost. | Continue #118 toward shared typed state and view models; presentation adapters consume the same actions. |
| `main.ts`: general modal uses a role=dialog div and class changes; More uses native dialog | The inspected general modal helper does not itself implement focus containment/restoration. This needs a runtime accessibility check. | One accessible dialog contract, keyboard flow, escape/dismiss rules and return focus. |
| `style.css`: focus-visible styles, mobile safe areas, reduced-motion rules; menu hints and completion notices | Existing strengths to retain. | Expand their coverage consistently, not describe them as missing. |
| Header/sidebar scrolling is tracked in #193; lighter mobile interface in #189 | Existing work, not a new duplicate feature. | This issue is the overarching v3 exploration, linked to these implementation items. |

## Research and what is inferred from it

Sources checked 2026-11-16. Summaries below are paraphrases. **The recommended Nova layouts are design inferences, not findings that the sources tested Nova or prove a particular layout wins.**

| Primary source | Relevant observation | Proposed use in Nova |
|---|---|---|
| [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum/) | WCAG 2.2 AA uses 24×24 CSS px with defined spacing/other exceptions; 44×44 is the enhanced target criterion, not the universal AA minimum. | Aim for 44–48 px touch areas on important controls; separately test actual conformance. Compact desktop remains possible. |
| [W3C — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum/) | Sticky UI must not completely obscure the focused component at AA. | Reserve scroll space around resource header, mobile dock and action tray; prefer the whole focused control visible. |
| [W3C — Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Custom temporary content has dismissal/hover/persistence conditions; browser-native title tooltips are excepted. | Essential resource facts and blocker reasons must be available by tap/keyboard, not only hover. |
| [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Advanced or less common information can be revealed on demand. | Expand descriptions/level tables; retain costs, consequences, hazards and important restrictions in the decision context. |
| [NN/g — Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/) | Feedback helps users know whether an action was received and what state the system is in. | Explicit draft, sending, server-confirmed, failed and stale states. A local countdown reaching zero must await reconciliation before claiming completion. |
| [EVE Online — UI Tips and Tricks](https://support.eveonline.com/hc/en-us/articles/7264100568220-User-Interface-Tips-and-Tricks) | Its Photon UI documents compact mode, adjustable margins and alternate icon/list displays. | Treat density and presentation as preferences. Do not hide expertise behind one compulsory sparse layout. |
| [Factorio — Friday Facts #380, Remote view](https://www.factorio.com/blog/post/fff-380) | A remote view combines map interaction with persistent location selection across planets/platforms. | Keep active colony, inspected target and return location explicit while using the map as a working environment. |
| [Game Accessibility Guidelines — Full list](https://gameaccessibilityguidelines.com/full-list/) | Recommends legible type, large spaced touch controls, contextual help and access via suitable input methods. | A tactical list and keyboard/tap commands accompany the hex view; no essential drag/hover-only operation. |

## Four deliberately different directions [V]

### A — Imperiale Brücke

A command center for asynchronous play: *What changed? What needs me? What completes next?* The central surface contains a short briefing, a bounded attention list and colony status. A single alert links to the exact planet, report or order. The original bronze/gold language and icons remain; numerical UI gets calmer typography.

- Best for: quick visits on the train, newer players, remembering a plan after several hours.
- Cost: ranking alerts can hide information or create a feeling of compulsory tasks. Keep an unfiltered activity view and player-chosen pins; do not automatically reorder controls while someone is interacting.
- Map/siege: open in the same shell with the same object inspector. Urgency is contextual and fact-based, not a permanent red badge on every menu.

### B — Sektor-Atlas

The map becomes a working surface. Universe → galaxy → system → planet → own building surface is one spatial journey. A selected object opens the same inspector on desktop and a bottom sheet on phones. Fleet and supply planning start from a target, not from an empty coordinate form.

- Best for: exploration, fleet planning, guild geography, planetary operations and connecting #160 to #155.
- Cost: camera motion, hidden state and graphics load. Keep direct search, bookmarks, list access and return history. Map geometry does not redefine classic flight distances.
- Siege: the planet inspector offers Orbit / Surface / Siege context; the tactical board is a distinct workspace in the same design language. Do not silently change the global clock or imply the map is paused.

### C — Operationsdeck

A compact colony matrix plus an event timeline: compare queues, resources, free capacity and supply without touring every planet. The phone uses stacked colony records, not an unreadable miniature spreadsheet.

- Best for: many colonies, experienced players and short precision tasks.
- Cost: too much density and notification overload. Offer comfortable density; avoid tiny text and horizontal page scrolling.
- Map/siege: clicking a colony or deadline focuses the same target inspector or command queue. Context survives the round trip.

### D — Imperiums-Chronik

A narrated, deterministic return briefing: completed research, returning ships, a colony under pressure. Atmospheric chapter titles and a strong planet image preserve the fiction. Narrative is derived from known events; no generative service or new knowledge required.

- Best for: immersion, onboarding, returning after a break, a personal account of the round.
- Cost: decorative space and obstructing experts. Make it skippable; never put urgent actions behind a story sequence. This is not the post-round report feature.
- Map/siege: each story item is a deep link to the same target and action as the operational views.

**Initial recommendation [V]: A as the everyday home, B as the spatial workspace, C as an optional empire overview, D as an optional return briefing.** First evaluate the four compositions before deciding which parts to combine. Their names do not imply shipping four independent frontends.

## Shared design and interaction language [V]

### Identity and tokens

- Original application icons and planet SVG textures; no replacement stock space illustrations.
- Dark bronze/charcoal surfaces, gold brand/primary action/selection, restrained borders; Cinzel for major headings and a neutral system sans for dense operational text. Classic can keep the current font stack.
- Gold selection is **independent of allegiance**. Own = blue circle, guild = green diamond, enemy = coral diamond with hostile label, neutral = muted circle; unknown = question mark/dashed boundary plus report age. Avoid interpreting every other player as an enemy.
- Amber = attention/pending deadline; red = danger/destructive consequence; green = success. Every state also has text/shape. Resource colors retain their existing meaning in explicitly labeled resource contexts.
- Shared scale: 4/8/12/16/24/32 px spacing, 16–18 px body starting point, tabular numbers, 44–48 px important touch targets, configurable comfortable/compact density. These are proposed tokens, not measured conformance results.
- On narrow screens, put changing details in a bottom sheet/inline section, not a narrow copy of the desktop sidebar. Retain coordinates and the target's name above the action.

### Common components

`ResourceStrip`, `ColonySwitcher`, `ObjectBreadcrumb`, `TargetInspector`, `StatusChip`, `ReportAge`, `Deadline`, `QueueEditor`, `ActionTray`, `CostEffectPreview`, `ViewModeSwitch`, `EmptyState` and `ConnectionState` should be shared contracts. They are proposed component responsibilities, not existing exported APIs.

The same interaction applies at every scale:

1. Select an object (system, planet, fleet, building, unit, tile).
2. Inspect its identity, source/age of knowledge and relevant state.
3. Preview an available action, costs and consequences.
4. Edit a local draft when appropriate.
5. Explicitly commit an irreversible action and show the server result.

Selection never sends a fleet or an order. A preview is never displayed as committed reality. The selected tactical path uses the same gold emphasis as the selected galaxy target; the action tray occupies the same role even when its contents change.

## Integration contract with #160 [E + V]

Read the issue **and its later comments**: the initial fixed zoom proposal was superseded.

**Already decided in #160 [E]:** free zoom inside levels; seamless endless zoom rather than level fades; real game planet textures; one level deeper to the building view of an own planet (#158); the map is the default for new players; Classic table preference is stored per player on the server. Foreign ships/defense come **only from the player's own espionage reports younger than 24 h**. At 24 h and older show unknown, not zero; do not substitute guild intelligence.

**v3 extension [V]:** one target identity and route across map/list, explicit active-origin colony versus inspected target, same inspector and action tray as colony/ground views. Pointer-centered zoom, drag pan, touch pan/zoom, visible +/−, keyboard actions and a list alternative; back returns to camera center, zoom and selection. Reduced motion jumps directly to the destination. A large map gets its own intentional pan region; the surrounding page must still fit 360 px.

Map drawings are schematic: system positions and route strokes do not redefine distance, imply new vision, grant territory bonuses or decide M1–M6. A deep link includes the selected object and view context; do not expose secret information through hidden DOM/URLs or preloaded data.

## Integration contract with #155 [E + V]

The issue remains an idea; its turn model, time bank, capture rules and several field/ability rules are unresolved. The sample `20:37`, `03:20`, hit points and move paths in this package **do not settle those decisions**. The sample order list contains three of the proposed maximum ten planned orders.

Shared workspace:

- `Planet [g:s:p] → Orbit / Surface / Siege`; breadcrumb and browser-back restore the previous map position.
- Siege summary: role (attacker/defender), phase, deadline, time bank if adopted, supply and estimated exhaustion, infrastructure damage, production/build lock, report age.
- Board: legible units, allegiance shape, selected tile/unit, reachable area, cost and consequence preview, terrain explanation, planned-path numbering matching the command list.
- Order queue: add/edit/remove/reorder using buttons as well as optional drag; separate **draft → review → send → server accepted → executing → resolved**.
- Stale revision/reconnect: keep the draft, explain conflicts, revalidate against the current board. Never resend automatically or imply a past local preview is authoritative.
- Supply: launch from the same target inspector into the common fleet editor; return to the same siege and draft.
- Classic: a classic-styled tactical board plus an equivalent coordinate/unit/order editor. No auto-resolve substitute and no loss of control over terrain/abilities. The artboard shows the queue aspect, not a completed accessible combat UI.
- Mobile: a readable **portion** of the hex board with explicit pan/zoom and a separate command list. Never shrink the entire battlefield to fit the phone.

## Experiments to decide with players [V]

A small formative study with 5–8 invited players (experienced and new, including phone use) is enough to discover problems; it does not establish statistical superiority. Counterbalance design order. Use the same seeded tasks/data. Record only with consent; do not add behavioral tracking to production for this exploration.

| Experiment | Alternatives | Identical task | Observe / decide |
|---|---|---|---|
| E1 — entry point | A briefing / B map / C matrix / D chronicle | Return after 8 h; find the threatened colony, idle queue and completed research | Task success, time to first correct action, wrong turns, confidence. |
| E2 — construction | Always-expanded rows / compact rows with details / cards | Pick a mine upgrade and state its effect and resulting energy | Missed energy cost, scrolling, accuracy; do not optimize clicks alone. |
| E3 — fleet editor | All-at-once desktop panel / staged mobile editor | Plan supply to the selected besieged colony with limited cargo/fuel | Wrong origin/target, invalid cargo, time and correction rate. |
| E4 — map transition | Map + inspector / Classic table + same inspector | Find a target, inspect old intelligence, open siege, return | Can users distinguish report age, active origin and selected target? |
| E5 — order queue | Board + side queue / mobile board + list / Classic coordinate editor | Plan three moves, edit the second, switch view, continue | Order accuracy, accidental sends, lost selection/draft. |
| E6 — density | Comfortable / compact, independent of Modern/Classic | Compare five colonies and fix one supply issue | Legibility and precision, not the number of visible widgets. |
| E7 — navigation | Five mobile tabs as proposed / current tabs / optional pinned destination | Find research, map, reports and a siege | Discoverability; whether the bell hides reports too much. |
| E8 — motion | Camera motion / reduced-motion jump | Universe → own planet → surface, then back | Orientation, motion comfort, touch errors; retain accepted seamless geometry when animated. |
| E9 — return briefing | D before normal entry / optional D / no D | Resume after a long gap | Recall, speed to action, whether story adds value or friction. |
| E10 — bold extension | Temporary split view: map + fleet draft + siege queue | Plan reinforcement while checking the active ground draft | Is a pinned context useful on desktop? On phone use returnable steps, not three tiny panes. |

Further sketches worth testing after a favorite emerges: a temporal lens for *known* queued events (not predicted enemy activity), player-pinned plans with no automation, and a focus mode that hides decorative chrome during tactical planning. Radial action menus and mandatory drag-to-order are not proposed defaults because discovery and touch/keyboard equivalence would need strong evidence.

No measured benefit is claimed for any experiment. The rendered package illustrates E1, E2, E4 and E5; E3/E6/E7/E8/E9/E10 describe follow-up prototypes, not implemented experiments.

## Modern / Classic contract [E + V]

**[E]** Always reachable switching. **[V]** Implement it as a labeled two-state control in the global shell (also within mobile map/board focus views), not a buried options-only switch. Persist the account default on the server; an optional explicit device override can be evaluated separately. This proposal extends #160's already-decided per-player map preference rather than erasing it.

Three independent axes, not one overloaded toggle:

1. **Presentation:** Modern / Classic (navigation/layout/style).
2. **Local representation:** map/list, board/commands, comfortable/compact.
3. **Rules/features:** round settings and permissions, unaffected by presentation.

Compatibility for existing players: migrate the Classic-map preference specified in #160, if already implemented, to the equivalent local map representation; store it independently of the new global mode. A user can use Modern with the table or Classic with the map. New players keep #160's map default; global v3 default for existing/new players is a separate decision.

Mode switching preserves current route, origin colony, inspected target, map camera, selected object/unit/tile, filters, expanded item, scroll anchor, fleet quantity/cargo and tactical draft. Scroll positions may map by item ID rather than raw pixels. If a dialog is open, preserve its draft and logical step, restore appropriate focus in the destination view; no duplicate mounted hidden UI. Unsaved drafts are scoped to account/round/planet or siege revision; clear them on logout, account change and invalidated round, and warn before discarding stale incompatible orders. An in-flight request is reconciled exactly once across the switch; presentation must not replay it. Switches never send/cancel orders, spend resources or restart a timer.

Classic is feature-complete, including new siege/map functions, and receives accessibility/bug fixes. It is not frozen v2 with a feature paywall. A shared action/state layer prevents duplicate rule validation. One canonical `GameState` and action dispatch, shared view models, two shell/presentation adapters; continue the Svelte direction of #118. No framework migration is required for v3.

## Evaluation and implementation gates [V]

- Choose direction and navigation with the owner after reviewing these studies; no implied approval of new game mechanics.
- Scope view inventory: sign-in/invitation; home/briefing; colonies & planet/moon; buildings/research/yard/defense; resources/market if enabled; fleet editor & movements; map/list & target inspector; siege status/board/command queue/report; reports/messages; guild; rewards; highscore; help/options/account; admin. Future mechanics appear only when enabled and authorized.
- First vertical slice: overview + build detail + fleet draft + mode switch. Reuse #189/#193 work instead of silently superseding their decisions.
- Second slice: #160 map/list contract and shared inspector; third: #155 tactical prototype after rules are decided.
- Before review of game implementation: repository CI Gate, existing tests, equivalent rules/actions in both modes, meaningful E2E for mode switch and draft retention, axe plus manual keyboard/screen-reader/touch checks.
- Widths 360/390/430/768/1280; 200% text zoom; long names, many colonies, empty/loading/offline/error/stale states. No page-level horizontal overflow; intentional map pan has controls and an alternative.
- Deep link, reload, browser back, device handoff, own intel at 23:59 versus 24:00, server authorization, no hidden future/enemy data.
- Mode-switch matrix covers open dialogs, selected terrain/ability, draft fleet/order, request in flight, reconnect, account switch and round reset. Assertions include no extra mutation request.
- Performance targets are **proposed budgets**, not measured results: interactions should give immediate local feedback, map render work should cull offscreen objects and scale detail; measure representative older phones before choosing SVG/canvas. No claim that all galaxies can animate at a fixed frame rate.

## Reproduce

`python3 docs/design/interface-v3/render_studies.py` from the repository root. Requires Pillow and fontTools with WOFF2/Brotli support, Node with sharp available through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. The environment used an existing system fontTools/Brotli interpreter to convert the original WOFF2 fonts once into `/tmp/nova-v3-render`; no package or game dependency was installed.

The script's outputs are raster artboards. It checks no game behavior. The final review inspected compositions and decoded all WebP frames. A production browser render, automated accessibility conformance and player evaluation remain work for the implementation/prototype phase.
