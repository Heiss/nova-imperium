---
type: log-entry
date: 2026-11-27T09:20
kind: Code
issues: [431, 417]
---

#431 built with the owner's decisions of 2026-11-27 (203b and 205a, the retrospective of 26.11.29): „Detect changes“ fails a pull request into `main` whose head commit does not contain the base commit of its `pull_request` event (`git merge-base --is-ancestor <base> <head>`), before any expensive job starts, and the error says how to fix it: `git fetch origin && git merge origin/main`, then push. The strict ruleset of `main` needs an up-to-date branch before the merge, so such a head ran its CI again after the update, for #417 up to 170 minutes a run. The proposals of the issue are built as [V]: the head and the base of the event, not the merge commit, from the checkout with the whole history; an error of the check fails it too; pull requests into `hotfix/**` and release pull requests keep their own rules; pull requests of Dependabot and Renovate are included. Tests in `src/test/ci-release.test.ts` run the shell of the step on a main that moved on, on an unknown base and on the cases left out.
