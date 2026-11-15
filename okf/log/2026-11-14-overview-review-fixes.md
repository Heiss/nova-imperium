---
type: log-entry
date: 2026-11-14
kind: Fix
issues: [210, 118]
---

review of #210 (CodeRabbit): the normalizer of the reference tests of #118 (`src/test/markup.ts`) decoded `&quot;` also inside attribute values, so `alt="x&quot; title=&quot;y"` equalled `alt="x" title="y"` and a place name whose quotes lost their escaping in `alt` could pass; it now decodes `&quot;` only in the text between the tags and keeps it escaped in a value (`&gt;` and `&#39;` are decoded in both); the self-test has the unequal case, the overview's generated names include one that becomes an attribute without the escaping, and its frozen view has its own copy of the moon picture; a planted break (the quote escaping removed from `moonPicture`) fails the test (see [Test strategy](/ops/testing.md)).
