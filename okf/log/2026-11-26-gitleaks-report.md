---
type: log-entry
date: 2026-11-26T08:10
kind: Fix
---

The gitleaks step in CI no longer prints the lines of a finding. It writes a JSON report into a temporary directory of the runner and prints only the rule, the file, the line number and the commit of each finding; the report is deleted afterwards and not uploaded. The step still fails on a finding, and also when the report is missing.
