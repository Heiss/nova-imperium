---
type: log-entry
date: 2026-11-14
kind: Fix
issues: [209, 118]
---

review of #209 (#118): an action answers `done`, `stale` or `failed`, and `order` and `send` clear their form only on `done`, so an order's answer no longer clears the field of the planet the player switched to; a refresh that overlaps an action, or is not the newest, no longer applies its older state (both also in the base); the energy a building level needs is compared with `production()` as `energyShort()` checks it, a change of behaviour (the old view used `prod()` and showed enough energy at a throttled Fusionskraftwerk); the normalizer of the reference test keeps an escaped `<` and `&`, so an unescaped name fails it; each with a test that failed before (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
