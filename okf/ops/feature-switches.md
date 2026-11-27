---
type: Policy
title: A switch for every feature
description: Every feature outside the core gets an on/off switch per round, so a round can be played with the classic rules alone or with new features; classic and comfort features included.
tags: [admin, round-settings, classic, presets]
status: draft
generated: { by: claude-code/web, at: 2026-11-27T16:00:00Z }
---

# Decisions

The owner, 2026-11-27 (259b, 260a, 261a, 262b, 263a): „für jedes Feature
was wir bauen, auch einen an und aus Schalter … Sodass man ein klassisches
… haben kann oder eben neue Features aktivieren kann.“

* **[E]** Every feature gets an on/off switch per round. This holds for new
  features, for classic features (259b) and for comfort and interface
  features, such as the Lexicanum, push or the achievements (262b).
* **[E]** Always on, without a switch, is the core of the scope in
  [Overview](/overview.md) (263a):
  * planets, resources, buildings, research, shipyard, defense;
  * galaxy, attacks, espionage, transports, colonization;
  * sign-in, account and admin.
* **[E]** The default of a new switch (261a):
  * Running universes get „An“. The update adds the feature and changes
    nothing else.
  * In „Neue Runde“ the chosen preset applies (#441). The preset
    „Klassisch“ sets the switch of every feature that is not classic to
    „Aus“.
* **[E]** Existing features without a switch get one later through one
  collection issue (260a). The assistant lists them for the owner to
  confirm, together with the marks „klassisch“ or „neu“ of #441.

# Proposals

* **[V]** A switch is a round setting like `roundMarketOn`:
  * it is a `live` row, shown in „Neue Runde“ and „Universum“;
  * it is audited like every settings save;
  * it carries its mark „klassisch“ or „neu“ (#441).
* **[V]** While a switch is off:
  * the feature is not offered: its views, menu entries and Lexicanum
    pages are hidden, as #404 does for the marketplace;
  * the server refuses its actions.
* **[V]** What happens to running state when the admin switches a feature
  off during a round is decided per feature and stated in its issue.
  Examples: running holds turn home (#440, 240a); the Börse cancels open
  orders and lets closed contracts run to their end (#386, 251).
* **[V]** Every issue of a feature names its switch, the label of the
  switch, its mark „klassisch“ or „neu“, and what switching it off during
  a round does.
* **[V]** A feature that needs another feature, such as an interception
  that needs the Auspex-Phalanx on a moon, is not offered while the other
  one is off.
