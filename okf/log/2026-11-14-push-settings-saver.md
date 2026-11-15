---
type: log-entry
date: 2026-11-14
kind: Fix
issues: [192, 204]
---

#192 after CodeRabbit on #204: the options save the push kinds one request at a time with the newest choice, so two quick clicks both stay (`pushSaver`, unit and E2E test); the delivery test tells the pushes apart by their text (see [Push settings per kind](/features/push-settings.md)).
