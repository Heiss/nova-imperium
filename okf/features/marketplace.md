---
type: feature
title: Marketplace
description: Exchange resources at ratios the admin sets per pair, with moving prices, the building Handelsposten that lowers the fee, a cap by the free storage and a limit per player per day (issue #171).
---

# Marketplace

Issue #171 („Geklärt“, owner, 2026-11-17, label `ready`). The rules are in
`src/core/market.ts` (pure integer functions), the texts both sides share in
`src/core/market-text.ts`, the action in `src/server/game/market.ts`, the
view in `src/client/views/market.ts`. Out of scope (the issue): trading
between players, and the races of #154.

# Decisions

* **[E]** A player can always exchange one resource for another at ratios
  the admin sets; the admin can switch the market off for a round; it is on
  by default in a new round (owner, 2026-11-13, D6 2026-11-17). Free: no
  premium, only the ratio and the fee.
* **[E]** D1: moving prices. The ratios of the admin are the base prices.
  Each exchange shifts the price of its pair by a share of the amount
  traded, and the price drifts back to the base over a set time. Step and
  drift time are per-round admin values.
* **[E]** D2: a ratio per pair, six numbers; the panel warns when a round
  trip would gain resources.
* **[E]** D3: the building „Handelsposten“; level 1 is needed, higher levels
  lower the fee. Art as for other new buildings.
* **[E]** D4: the result is capped by the free storage of the target; the
  preview shows the cap.
* **[E]** D5: a limit per player per day, a per-round admin value.
* **[E]** X1: the per-round values are set in „Neue Runde“ and stay editable
  during the round (all ten are `live` rows of the universe settings).
* **[E]** Adamant, Psikristall and Promethium can be traded; energy cannot.
* **[E]** Changes of the market settings are in the audit log: the action
  `settings` records the whole universe before and after, `reset` the rules
  of the round before and after; an exchange is a game action with its
  amounts (`planet`, `give`, `get`, `given`, `got`, `fee`, `capped`,
  `price`).

# Built [V]

Everything below the decisions is a proposal for the owner to confirm in the
pull request.

* **[V]** Where: on the shown planet, with its stock and storage; the
  Handelsposten of that planet counts (a moon cannot hold one).
* **[V]** A ratio is the amount got per 1,000 given, a whole number from 1 to
  100,000; the pair is ordered (`mc` is Adamant for Psikristall). Defaults
  from the example of the issue, Adamant 1, Psikristall 2, Promethium 3,
  each rounded down: `mc` 500, `md` 333, `cm` 2000, `cd` 666, `dm` 3000,
  `dc` 1500 (no round trip gains).
* **[V]** Result = ⌊amount · ratio · price · (1000 − fee) / 10¹²⌋ with the
  ratio per 1,000, the price in millionths of the base and the fee in
  thousandths. Integers only (BigInt), every division rounds down.
* **[V]** Price: only the pair that was exchanged falls, by
  price′ = ⌊price · 10⁶ / (10⁶ + step · given)⌋, never below 0 and never above
  the base; the reverse pair keeps its price, so movement never creates a
  gain. Step: whole „Promille je 1.000 getauschte Einheiten“, 1 to 1,000,
  default 5 (20,000 given lower the price by about 10 %). The price drifts
  back in a straight line over „Preiserholung (Stunden)“, 1 to 720, default
  24, rounded so it is never above the line; one drift time after the last
  exchange it is at the base. The stored price is relative to the base, so a
  change of a ratio during the round applies at once, and a change of the
  drift time applies to the stored prices.
* **[V]** The price is shared by all players (the classic market); the
  amount of the day is the player's.
* **[V]** Fee of the Handelsposten: 10 % at level 1, one percentage point
  less per level, 0 from level 11. Cost 5,000 / 10,000 / 5,000, factor 2,
  needs the Servitorenschmiede at level 4, planets only, order 170 (last
  building). Abbreviation „HP“.
* **[V]** The cap (D4): when the result would exceed the free storage, the
  result is the free storage and only the least amount that gives it is
  taken; the surplus stays with the player. A free storage of 0 refuses.
* **[V]** The limit (D5): the amount given, all resources added, per UTC day
  (like the daily reward), 1 to 10,000,000, default 100,000. An exchange
  over the rest of the day is refused, the cap is applied first.
* **[V]** The switch is the number 1 (Ja) or 0 (Nein), because a switch of
  the registry cannot be `live`.
* **[V]** The warning: round trips through two or three resources whose
  ratios multiply to more than 1,000 to the power of their length, at fee 0
  (the lowest fee) and at the base price; shown in the universe settings
  below the table. A set that is warned about can gain; the admin may save it.
* **[V]** The view „Marktplatz“ after „Rohstoffe“ in the menu, under „Mehr“ on
  a phone; closed while the market is off.
* **[V]** Existing universes start with the market on and the defaults;
  nobody has a Handelsposten there yet.

# Settings of the round

All in one fieldset „Marktplatz“ of the dialog „Neue Runde“ and all `live`,
registered in `src/core/market.ts` (`order` 320 to 410, key `roundMarket…`).

| Key | Label | Range | Default | Order |
|---|---|---|---|---|
| `roundMarketOn` | Marktplatz aktiv | 0 / 1 (Nein / Ja) | 1 | 320 |
| `roundMarketMc` | Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant) | 1 to 100,000 | 500 | 330 |
| `roundMarketMd` | … Adamant → Promethium (Promethium je 1.000 Adamant) | 1 to 100,000 | 333 | 340 |
| `roundMarketCm` | … Psikristall → Adamant (Adamant je 1.000 Psikristall) | 1 to 100,000 | 2000 | 350 |
| `roundMarketCd` | … Psikristall → Promethium (Promethium je 1.000 Psikristall) | 1 to 100,000 | 666 | 360 |
| `roundMarketDm` | … Promethium → Adamant (Adamant je 1.000 Promethium) | 1 to 100,000 | 3000 | 370 |
| `roundMarketDc` | … Promethium → Psikristall (Psikristall je 1.000 Promethium) | 1 to 100,000 | 1500 | 380 |
| `roundMarketStep` | Marktplatz Preisschritt (Promille je 1.000 getauschte Einheiten) | 1 to 1,000 | 5 | 390 |
| `roundMarketDrift` | Marktplatz Preiserholung (Stunden) | 1 to 720 | 24 | 400 |
| `roundMarketLimit` | Marktplatz Tageslimit je Spieler (Einheiten) | 1 to 10,000,000 | 100,000 | 410 |

# Texts

* **[V]** From the issue body, which stays [V] (owner, 2026-11-17): „Der Marktplatz ist in dieser
  Runde geschlossen.“, the menu „Marktplatz“, „Du gibst“, „Du erhältst“,
  „Gebühr“, „Tauschen“, „Marktplatz aktiv“, the section „Marktplatz“ of the
  admin settings.
* **[V]** Refusals (`src/core/market-text.ts`, server and browser alike):
  „Auf diesem Planeten fehlt ein Handelsposten.“, „Diese Rohstoffe lassen
  sich nicht tauschen.“, „Bitte eine ganze Menge von mindestens 1 angeben.“,
  „So viel hast du auf diesem Planeten nicht.“, „Das Lager für <Rohstoff> ist
  voll.“, „Tageslimit erreicht: Heute kannst du noch <n> tauschen.“, „Für
  diese Menge bekommst du nichts.“. Done: „<n> <Rohstoff> gegen <m>
  <Rohstoff> getauscht.“ and, when capped, „ Das Lager für <Rohstoff> ist
  jetzt voll.“
* **[V]** View: „Menge“, „max“, „Kurs“, „Heute noch“, „Begrenzt durch das
  freie Lager: Du gibst nur <n> <Rohstoff> ab.“, „Baue ihn unter
  „Gebäude“.“; admin warning „Achtung: Ein Tausch im Kreis bringt selbst ohne
  Gebühr Gewinn: <Kreis>; …. Bitte die Kurse anpassen.“ The labels of the
  settings are in the table above.
* **[V]** The article of the Handelsposten in the Lexicanum
  ([Lexicanum texts](/features/lexicanum-texts.md)) and its short and long
  text (`src/features/market/texts.de.ts`).

# Rounding and the property test

Every product is an integer, every division rounds down, a price is never
above its base and a fee never below 0. So an exchange never gives more than
the ratio says, and a chain of exchanges returns at most what it started
with for every ratio set the panel does not warn about. The property tests in
`src/core/market.test.ts` (fast-check) play random sequences (pair, share,
hours between, level, step, drift, storage) and check that the value of the
stock never rises for ratios derived from values, that the start resource
ends at most as it began for any ratios without a warning, that a round trip
at fee 0 never returns more when the ratios multiply to at most 1,000², and
that the result is the exact floor. **[U]** Ratios the panel warns about can
gain by design (D2 only warns); the property holds for the others.

# Seams for later work

* Vacation mode (#223): every own action is refused in vacation; `trade` is
  on no allow list, nothing to build now.
* Demolition (#202): a torn-down Handelsposten lowers its level; the market
  reads the level at every exchange, so nothing to change.
* Highscore categories (#78): the market adds no points; the amounts given
  are in the audit log.

# Open points

* The dialog „Neue Runde“ shows no warning about gaining ratios, only the
  universe settings do.
* The market is shared; whether the price should be per player is not
  decided (options in the pull request).
