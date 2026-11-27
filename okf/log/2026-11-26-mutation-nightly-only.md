---
type: log-entry
date: 2026-11-26T23:59
kind: Code
issues: [370, 424]
---

#370 built with the owner's decisions of 2026-11-26 (189a, 190a, 191a, 194a via 197b, 195a, 196c, 200a, 201a): a pull request into main mutates only the files it changes, at any size, since `PARTIAL_LIMIT` is gone (#424 had run the complete run for 13 files). `scripts/mutation-partial.ts parts` splits the set into one part for each 12 files begun, at most 12, by the weights of the last complete run, which „Detect changes“ restores read only from the cache of main. The matrix job „Mutation tests (changed files, part N of M)“ runs each part, and „Mutation tests (changed files)“ merges and checks them under its old name. While the newest completed scheduled run of `mutation.yml` on main is red or missing (`scripts/mutation-nightly.ts`; a cancelled run does not count, every error of the lookup counts as missing), a pull request with a non-empty set runs the complete run instead, and the CI Gate prints the run it looked at. A push to main runs no mutation job (`mutation=nightly`): the gate prints the proof of the pull request, or that the nightly run tests the tree. Pushes to hotfix branches and pull requests into them keep their rules, and a release needs no extra mutation condition.
